/**
 * BDTD Scraper Service
 *
 * Uses BDTD (Biblioteca Digital Brasileira de Teses e Dissertações) VuFind REST API
 * directly — no browser required. The API returns structured JSON.
 *
 * Institution filter: `filter[]=institution:UFMS` (5 334 records as of 2025)
 *
 * Year enrichment: for each UFMS repository URL in the result, fetches the
 * DSpace item page (server-rendered HTML with Dublin Core meta tags) to extract
 * year, abstract, advisor, and keywords. Done in small parallel batches.
 */

import { DegreeLevel } from '@prisma/client'
import { upsertAcademicWithDissertation } from '@/lib/academic-upsert'
import type { ScraperOptions, ScraperResult } from './types'

const BDTD_API = 'https://bdtd.ibict.br/vufind/api/v1/search'
const PAGE_SIZE = 100 // VuFind supports up to 100
const ENRICH_CONCURRENCY = 5 // parallel UFMS repo fetches

// Institution codes in BDTD (ID prefix = institution code)
const INSTITUTIONS: Record<string, string> = {
  UFMS: 'Universidade Federal de Mato Grosso do Sul',
}

interface BDTDRecord {
  id: string
  title: string
  authors: {
    primary: Record<string, unknown>
    secondary: unknown[]
    corporate: unknown[]
  }
  formats: string[]
  subjects: string[][]
  urls: Array<{ url: string; desc: string }>
}

interface EnrichedRecord {
  name: string
  title: string
  year: number | null
  institution: string
  degreeLevel: DegreeLevel
  advisor?: string
  abstract?: string
  keywords: string[]
  url?: string
}

function authorFromRecord(record: BDTDRecord): string {
  const keys = Object.keys(record.authors?.primary ?? {})
  return keys[0] ?? 'Unknown'
}

function degreeLevelFromFormats(formats: string[]): DegreeLevel {
  const f = (formats ?? []).join(' ').toLowerCase()
  if (f.includes('doctoral') || f.includes('doutorado') || f.includes('phd')) return 'PHD'
  return 'MASTERS'
}

function keywordsFromSubjects(subjects: string[][]): string[] {
  return (subjects ?? [])
    .flatMap((s) => s)
    .map((k) => k.trim())
    .filter((k) => k.length > 2 && k.length < 100)
    .slice(0, 10)
}

function ufmsRepoUrlFromRecord(record: BDTDRecord): string | null {
  const url = record.urls?.find(
    (u) => u.url?.includes('repositorio.ufms.br/handle/')
  )?.url
  return url ?? null
}

/**
 * Fetch Dublin Core metadata from a UFMS DSpace item page.
 * Pages are server-rendered HTML (no JS required).
 */
async function fetchUFMSMeta(
  repoUrl: string
): Promise<{ year: number | null; abstract?: string; advisor?: string; keywords: string[] }> {
  try {
    const resp = await fetch(repoUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!resp.ok) return { year: null, keywords: [] }

    const html = await resp.text()

    // Extract Dublin Core meta tags
    // Use a simple approach: find name="X" content="Y" with a stable regex
    const metaMap = new Map<string, string[]>()
    // Match all meta tags with name + content attributes (DSpace uses double quotes)
    const metaRe = /<meta\s+name="([^"]+)"\s+content="([^"]+)"/gi
    let mm: RegExpExecArray | null
    while ((mm = metaRe.exec(html)) !== null) {
      const key = mm[1].toLowerCase()
      const val = mm[2]
      if (!metaMap.has(key)) metaMap.set(key, [])
      metaMap.get(key)!.push(val)
    }

    const getMeta = (name: string): string | undefined =>
      metaMap.get(name.toLowerCase())?.[0]

    const getAllMeta = (name: string): string[] =>
      metaMap.get(name.toLowerCase()) ?? []

    const issuedStr = getMeta('DCTERMS.issued') ?? getMeta('DC.date')
    const yearMatch = issuedStr?.match(/\d{4}/)
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null

    const abstract = getMeta('DCTERMS.abstract') ?? getMeta('DC.description')
    const advisor = getMeta('DC.contributor.advisor') ?? getMeta('DC.contributor')

    const keywords = [
      ...getAllMeta('DC.subject'),
      ...getAllMeta('citation_keywords'),
    ]
      .flatMap((k) => k.split(/[;,]/))
      .map((k) => k.trim())
      .filter((k) => k.length > 2 && k.length < 100)
      .slice(0, 10)

    return { year, abstract, advisor, keywords }
  } catch {
    return { year: null, keywords: [] }
  }
}

/**
 * Process a batch of records, enriching with UFMS meta concurrently.
 */
async function enrichBatch(records: BDTDRecord[]): Promise<EnrichedRecord[]> {
  const results: EnrichedRecord[] = []

  for (let i = 0; i < records.length; i += ENRICH_CONCURRENCY) {
    const chunk = records.slice(i, i + ENRICH_CONCURRENCY)

    const enriched = await Promise.all(
      chunk.map(async (record) => {
        const repoUrl = ufmsRepoUrlFromRecord(record)
        let meta: Awaited<ReturnType<typeof fetchUFMSMeta>> = {
          year: null,
          keywords: [],
        }

        if (repoUrl) {
          meta = await fetchUFMSMeta(repoUrl)
        }

        const baseKeywords = keywordsFromSubjects(record.subjects)

        return {
          name: authorFromRecord(record),
          title: record.title,
          year: meta.year,
          institution: 'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL',
          degreeLevel: degreeLevelFromFormats(record.formats),
          advisor: meta.advisor,
          abstract: meta.abstract,
          keywords: [...new Set([...baseKeywords, ...meta.keywords])],
          url: repoUrl ?? record.urls?.[0]?.url,
        } satisfies EnrichedRecord
      })
    )

    results.push(...enriched)
  }

  return results
}

async function fetchBDTDPage(
  institutionCode: string,
  page: number
): Promise<{ records: BDTDRecord[]; total: number }> {
  const params = new URLSearchParams({
    lookfor: '',
    type: 'AllFields',
    limit: String(PAGE_SIZE),
    page: String(page),
  })
  params.append('filter[]', `institution:${institutionCode}`)

  const url = `${BDTD_API}?${params}`
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124' },
    signal: AbortSignal.timeout(30_000),
  })

  if (!resp.ok) throw new Error(`BDTD API HTTP ${resp.status}`)

  const data = await resp.json()
  return {
    records: (data.records ?? []) as BDTDRecord[],
    total: data.resultCount ?? 0,
  }
}

export async function runBdtdScrape(options?: ScraperOptions): Promise<ScraperResult> {
  const startTime = Date.now()
  let totalCreated = 0
  let totalSkipped = 0
  let totalErrors = 0
  let totalFetched = 0
  const errorMessages: string[] = []
  const onProgress = options?.onProgress
  const { limit, dryRun } = options ?? {}

  try {
    const modeTag = dryRun ? ' [DRY RUN — sem gravação]' : ''
    onProgress?.(`🚀 BDTD scrape via VuFind API${modeTag}`)
    if (limit) onProgress?.(`🔢 Limite: ${limit} registros da fonte`)

    for (const [code, label] of Object.entries(INSTITUTIONS)) {
      if (options?.signal?.aborted) break
      if (limit && totalFetched >= limit) break

      onProgress?.(`\n🏛️  ${label} (${code})`)

      let page = 1
      let total = -1
      let pageFetched = 0

      while (true) {
        if (options?.signal?.aborted) break
        if (limit && totalFetched >= limit) break

        try {
          const { records, total: batchTotal } = await fetchBDTDPage(code, page)

          if (total < 0) {
            total = batchTotal
            onProgress?.(`   📊 ${total} records found`)
          }

          if (records.length === 0) break

          // Trim batch to respect limit
          const remaining = limit ? limit - totalFetched : records.length
          const batch = records.slice(0, remaining)

          onProgress?.(`   📄 Page ${page} (${pageFetched + batch.length}/${total}) — enriching...`)

          const enriched = await enrichBatch(batch)

          for (const item of enriched) {
            if (!item.title || !item.name) continue
            totalFetched++

            if (dryRun) {
              onProgress?.(`   👤 ${item.name} | ${item.institution} | ${item.degreeLevel} | ${item.year ?? '?'}`)
              onProgress?.(`      "${item.title.slice(0, 80)}"`)
              continue
            }

            try {
              const result = await upsertAcademicWithDissertation(
                {
                  name: item.name,
                  institution: item.institution,
                  graduationYear: item.year ?? 0,
                  degreeLevel: item.degreeLevel,
                },
                {
                  title: item.title,
                  defenseYear: item.year ?? 0,
                  institution: item.institution,
                  abstract: item.abstract,
                  advisorName: item.advisor,
                  keywords: item.keywords,
                  sourceUrl: item.url,
                },
                { source: 'BDTD', scrapedAt: new Date() }
              )

              if (result.dissertationCreated) {
                totalCreated++
                if (totalCreated % 100 === 0) {
                  onProgress?.(`   ✅ ${totalCreated} new records saved...`)
                }
              } else {
                totalSkipped++
              }
            } catch (err: any) {
              totalErrors++
              errorMessages.push(`${item.name}: ${err.message}`)
            }
          }

          pageFetched += batch.length
          page++

          if (limit && totalFetched >= limit) break
          if (pageFetched >= total) break

          // Polite delay between pages
          await new Promise((r) => setTimeout(r, 500))
        } catch (err: any) {
          totalErrors++
          errorMessages.push(`${code} page ${page}: ${err.message}`)
          onProgress?.(`   ❌ Page error: ${err.message}`)
          break
        }
      }

      if (!dryRun) onProgress?.(`   📈 ${code} done: ${totalCreated} total new`)
    }

    if (dryRun) {
      onProgress?.(`\n✅ Dry run completo — ${totalFetched} registros lidos, nenhum gravado.`)
    } else {
      onProgress?.(`\n🎉 BDTD complete!`)
      onProgress?.(`📊 New: ${totalCreated} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`)
    }
  } catch (err: any) {
    totalErrors++
    errorMessages.push(err.message)
    onProgress?.(`❌ Fatal: ${err.message}`)
  }

  return {
    success: totalErrors === 0,
    totalCreated,
    totalSkipped,
    totalErrors,
    duration: Date.now() - startTime,
    errorMessages: totalErrors > 0 ? errorMessages : undefined,
  }
}
