/**
 * Sucupira Scraper Service
 *
 * Uses CAPES Open Data CKAN API directly (no browser).
 * Filters by SG_UF_IES='MS' to capture ALL Mato Grosso do Sul institutions
 * regardless of name variants (FUNDAÇÃO UNIVERSIDADE... vs UNIVERSIDADE...).
 *
 * NOTE: On Windows, Node.js defaults to IPv6 which times out for CAPES API.
 * We force IPv4-first DNS resolution at module load time.
 */

import dns from 'dns'
import { DegreeLevel } from '@prisma/client'
import { upsertAcademicWithDissertation } from '@/lib/academic-upsert'
import type { ScraperOptions, ScraperResult } from './types'

// Force IPv4 — CAPES API's IPv6 address times out from this network
dns.setDefaultResultOrder('ipv4first')

const CAPES_API = 'https://dadosabertos.capes.gov.br/api/3/action/datastore_search'
const BATCH_SIZE = 100

// Resource IDs per year (CAPES Open Data CKAN)
const RESOURCE_IDS: Record<string, string> = {
  '2024': '87133ba7-ac99-4d87-966e-8f580bc96231',
  '2023': 'b69baf26-8d02-4c10-ba39-7e9ab799e6ed',
  '2022': '78f73608-6f5e-463c-ba79-0bff4f8a578d',
}

interface CAPESRecord {
  NM_DISCENTE?: string
  NM_PRODUCAO?: string
  AN_BASE?: string | number
  NM_ENTIDADE_ENSINO?: string
  NM_GRAU_ACADEMICO?: string
  NM_ORIENTADOR?: string
  DS_RESUMO?: string
  DS_ABSTRACT?: string
  DS_PALAVRA_CHAVE?: string
  DS_KEYWORD?: string
  NM_AREA_CONHECIMENTO?: string
  DS_URL_TEXTO_COMPLETO?: string
  SG_UF_IES?: string
}

async function fetchCAPESBatch(
  resourceId: string,
  offset: number,
  onProgress?: (msg: string) => void
): Promise<{ records: CAPESRecord[]; total: number }> {
  const params = new URLSearchParams({
    resource_id: resourceId,
    filters: JSON.stringify({ SG_UF_IES: 'MS' }),
    limit: String(BATCH_SIZE),
    offset: String(offset),
  })

  const url = `${CAPES_API}?${params}`

  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) {
    throw new Error(`CAPES API HTTP ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(`CAPES API error: ${JSON.stringify(data.error)}`)
  }

  return {
    records: data.result?.records ?? [],
    total: data.result?.total ?? 0,
  }
}

function mapCAPESRecord(record: CAPESRecord): {
  name: string
  title: string
  year: number
  institution: string
  degreeLevel: DegreeLevel
  advisor?: string
  abstract?: string
  researchField?: string
  sourceUrl?: string
  keywords: string[]
} {
  const degree = (record.NM_GRAU_ACADEMICO ?? '').toLowerCase()
  const degreeLevel: DegreeLevel =
    degree.includes('doutorado') || degree.includes('phd') ? 'PHD' : 'MASTERS'

  const keywordsRaw = record.DS_PALAVRA_CHAVE ?? record.DS_KEYWORD ?? ''
  const keywords = keywordsRaw
    ? keywordsRaw.split(/[,;]/).map((k) => k.trim()).filter(Boolean)
    : []

  return {
    name: record.NM_DISCENTE ?? 'Unknown',
    title: record.NM_PRODUCAO ?? 'No title',
    year: parseInt(String(record.AN_BASE ?? new Date().getFullYear()), 10),
    institution: record.NM_ENTIDADE_ENSINO ?? 'UFMS',
    degreeLevel,
    advisor: record.NM_ORIENTADOR || undefined,
    abstract: (record.DS_RESUMO ?? record.DS_ABSTRACT) || undefined,
    researchField: record.NM_AREA_CONHECIMENTO || undefined,
    sourceUrl: record.DS_URL_TEXTO_COMPLETO || undefined,
    keywords,
  }
}

async function scrapeYear(
  year: string,
  resourceId: string,
  options: ScraperOptions | undefined,
  counters: { created: number; skipped: number; errors: number; fetched: number },
  errorMessages: string[]
): Promise<void> {
  const onProgress = options?.onProgress
  const { limit, dryRun } = options ?? {}

  onProgress?.(`\n📅 Year ${year}...`)

  let offset = 0
  let total = -1

  while (true) {
    if (options?.signal?.aborted) {
      onProgress?.('⏸️  Cancelled')
      break
    }
    if (limit && counters.fetched >= limit) break

    try {
      const { records, total: batchTotal } = await fetchCAPESBatch(resourceId, offset, onProgress)

      if (total < 0) {
        total = batchTotal
        onProgress?.(`   📊 ${total} MS records for ${year}`)
      }

      if (records.length === 0) break

      for (const record of records) {
        if (limit && counters.fetched >= limit) break
        if (!record.NM_PRODUCAO || !record.NM_DISCENTE) continue

        counters.fetched++
        const mapped = mapCAPESRecord(record)

        if (dryRun) {
          onProgress?.(`   👤 ${mapped.name} | ${mapped.institution} | ${mapped.degreeLevel} | ${mapped.year}`)
          onProgress?.(`      "${mapped.title.slice(0, 80)}"`)
          continue
        }

        try {
          const result = await upsertAcademicWithDissertation(
            {
              name: mapped.name,
              institution: mapped.institution,
              graduationYear: mapped.year,
              degreeLevel: mapped.degreeLevel,
              researchField: mapped.researchField,
            },
            {
              title: mapped.title,
              defenseYear: mapped.year,
              institution: mapped.institution,
              abstract: mapped.abstract,
              advisorName: mapped.advisor,
              keywords: mapped.keywords,
              sourceUrl: mapped.sourceUrl,
            },
            { source: 'CAPES', scrapedAt: new Date() }
          )

          if (result.dissertationCreated) {
            counters.created++
            if (counters.created % 50 === 0) {
              onProgress?.(`   ✅ ${counters.created} new so far...`)
            }
          } else {
            counters.skipped++
          }
        } catch (err: any) {
          counters.errors++
          errorMessages.push(`${record.NM_DISCENTE}: ${err.message}`)
        }
      }

      offset += BATCH_SIZE
      if (limit && counters.fetched >= limit) break
      if (offset >= total) break

      // Small delay to avoid hammering CAPES API
      await new Promise((r) => setTimeout(r, 300))
    } catch (err: any) {
      onProgress?.(`   ❌ Batch error at offset ${offset}: ${err.message}`)
      counters.errors++
      errorMessages.push(`Year ${year} offset ${offset}: ${err.message}`)
      break
    }
  }

  if (!dryRun) onProgress?.(`   📈 ${year} done: ${counters.created} new (running total)`)
}

export async function runSucupiraScrape(options?: ScraperOptions): Promise<ScraperResult> {
  const startTime = Date.now()
  const counters = { created: 0, skipped: 0, errors: 0, fetched: 0 }
  const errorMessages: string[] = []
  const onProgress = options?.onProgress

  try {
    const modeTag = options?.dryRun ? ' [DRY RUN — sem gravação]' : ''
    onProgress?.(`🚀 Sucupira scrape via CAPES Open Data API${modeTag}`)
    onProgress?.(`📌 State filter: SG_UF_IES=MS (all Mato Grosso do Sul institutions)`)
    if (options?.limit) onProgress?.(`🔢 Limite: ${options.limit} registros da fonte`)
    onProgress?.(`📅 Years: ${Object.keys(RESOURCE_IDS).join(', ')}`)

    for (const [year, resourceId] of Object.entries(RESOURCE_IDS)) {
      if (options?.signal?.aborted) break
      if (options?.limit && counters.fetched >= options.limit) break

      await scrapeYear(year, resourceId, options, counters, errorMessages)
    }

    if (options?.dryRun) {
      onProgress?.(`\n✅ Dry run completo — ${counters.fetched} registros lidos, nenhum gravado.`)
    } else {
      onProgress?.(`\n🎉 Complete!`)
      onProgress?.(`📊 New: ${counters.created} | Skipped: ${counters.skipped} | Errors: ${counters.errors}`)
    }
  } catch (err: any) {
    counters.errors++
    errorMessages.push(err.message)
    onProgress?.(`❌ Fatal: ${err.message}`)
  }

  return {
    success: counters.errors === 0,
    totalCreated: counters.created,
    totalSkipped: counters.skipped,
    totalErrors: counters.errors,
    duration: Date.now() - startTime,
    errorMessages: counters.errors > 0 ? errorMessages : undefined,
  }
}
