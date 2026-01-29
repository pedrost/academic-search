/**
 * Sucupira Scraper Service
 *
 * Searches CAPES Open Data API for dissertations/theses from
 * Mato Grosso do Sul institutions and saves to database.
 */

import { chromium, Browser, BrowserContext } from 'playwright'
import { DegreeLevel } from '@prisma/client'
import { upsertAcademicWithDissertation } from '@/lib/academic-upsert'
import type { ScraperOptions, ScraperResult } from './types'

// CAPES Open Data API (CKAN)
const CAPES_API_BASE = 'https://dadosabertos.capes.gov.br/api/3/action'

// Resource IDs for recent thesis/dissertation data (2021-2024)
const RESOURCE_IDS = {
  '2024': '87133ba7-ac99-4d87-966e-8f580bc96231',
  '2023': 'b69baf26-8d02-4c10-ba39-7e9ab799e6ed',
  '2022': '78f73608-6f5e-463c-ba79-0bff4f8a578d',
  '2021': '068003e4-196c-41f4-8c35-1f7c94b4e55c',
}

// Target institutions in Mato Grosso do Sul
const INSTITUTIONS_MS = [
  'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL',
  'UNIVERSIDADE CATÓLICA DOM BOSCO',
  'UNIVERSIDADE ESTADUAL DE MATO GROSSO DO SUL',
  'INSTITUTO FEDERAL DE MATO GROSSO DO SUL',
]

interface SucupiraResult {
  name: string
  title: string
  year: number
  institution: string
  degreeLevel: DegreeLevel
  advisor?: string
  abstract?: string
  researchField?: string
  sourceUrl?: string
  keywords?: string[]
}

// Shared browser instance for the scrape session
let browser: Browser | null = null
let browserContext: BrowserContext | null = null

async function getBrowserContext(): Promise<BrowserContext> {
  if (!browser) {
    try {
      // Try Chrome first (preferred)
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
      })
    } catch (chromeError) {
      try {
        // Fallback to Chromium
        browser = await chromium.launch({
          headless: false,
        })
      } catch (chromiumError) {
        throw new Error('No browser available. Install Chrome or run: npx playwright install chromium')
      }
    }
  }

  if (!browserContext) {
    browserContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    })
  }

  return browserContext
}

async function searchCAPESDataStore(
  institution: string,
  limit: number,
  onProgress?: (msg: string) => void
): Promise<SucupiraResult[]> {
  onProgress?.(`🌐 Querying CAPES API for ${institution}...`)

  try {
    const searchUrl = `${CAPES_API_BASE}/datastore_search`
    const resourceId = RESOURCE_IDS['2024']

    const filters = JSON.stringify({
      'NM_ENTIDADE_ENSINO': institution
    })

    const fullUrl = `${searchUrl}?resource_id=${resourceId}&filters=${encodeURIComponent(filters)}&limit=${limit}`

    const context = await getBrowserContext()
    const page = await context.newPage()

    await page.evaluate((inst) => {
      document.title = `CAPES Scraper - ${inst}`
    }, institution).catch(() => {})

    onProgress?.(`🌐 Opening browser (5 minute timeout)...`)

    const response = await page.goto(fullUrl, {
      waitUntil: 'networkidle',
      timeout: 300000, // 5 minutes - CAPES server is very slow
    })

    if (!response || response.status() !== 200) {
      await page.close()
      onProgress?.(`❌ HTTP ${response?.status() || 'no response'}`)
      return []
    }

    // Extract JSON from page
    const content = await page.content()
    const jsonMatch = content.match(/<pre>(.*?)<\/pre>/s)

    if (!jsonMatch) {
      await page.close()
      onProgress?.(`❌ Could not extract JSON from response`)
      return []
    }

    const data = JSON.parse(jsonMatch[1])
    await page.close()

    if (!data.success || !data.result?.records) {
      onProgress?.(`ℹ️  No records for ${institution}`)
      return []
    }

    const records = data.result.records
    onProgress?.(`✅ Found ${records.length} records`)

    // Transform API data to our format
    const results: SucupiraResult[] = []

    for (const record of records) {
      const name = record.NM_DISCENTE || 'Unknown'
      const title = record.NM_PRODUCAO || 'No title'
      const year = parseInt(record.AN_BASE || new Date().getFullYear(), 10)
      const inst = record.NM_ENTIDADE_ENSINO || institution
      const degree = (record.NM_GRAU_ACADEMICO || '').toLowerCase()
      const advisor = record.NM_ORIENTADOR || undefined
      const abstract = record.DS_RESUMO || undefined
      const researchField = record.NM_AREA_CONHECIMENTO || undefined
      const sourceUrl = record.DS_URL_TEXTO_COMPLETO || undefined
      const keywordsRaw = record.DS_PALAVRA_CHAVE || ''
      const keywords = keywordsRaw ? keywordsRaw.split(',').map((k: string) => k.trim()).filter(Boolean) : []

      const degreeLevel = degree.includes('doutorado') || degree.includes('phd') ? 'PHD' : 'MASTERS'

      results.push({
        name,
        title,
        year,
        institution: inst,
        degreeLevel,
        advisor,
        abstract,
        researchField,
        sourceUrl,
        keywords,
      })
    }

    return results

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.(`❌ ${errorMsg}`)
    return []
  }
}

/**
 * Run Sucupira scraper to collect dissertations from MS institutions
 */
export async function runSucupiraScrape(
  options?: ScraperOptions
): Promise<ScraperResult> {
  const startTime = Date.now()
  let totalCreated = 0
  let totalSkipped = 0
  let totalErrors = 0
  const errorMessages: string[] = []

  const limit = options?.limit || 100
  const onProgress = options?.onProgress

  try {
    onProgress?.('🚀 Starting Sucupira data collection via CAPES Open Data API')
    onProgress?.(`🏛️  Institutions: ${INSTITUTIONS_MS.length}`)

    for (let i = 0; i < INSTITUTIONS_MS.length; i++) {
      const institution = INSTITUTIONS_MS[i]

      // Check for cancellation
      if (options?.signal?.aborted) {
        onProgress?.('⏸️  Cancelled by user')
        break
      }

      onProgress?.(`\n[${i + 1}/${INSTITUTIONS_MS.length}] 🏛️  ${institution}`)

      try {
        const startInst = Date.now()
        const results = await searchCAPESDataStore(institution, limit, onProgress)
        const duration = Date.now() - startInst

        onProgress?.(`⏱️  Completed in ${duration}ms`)

        if (results.length === 0) {
          onProgress?.(`ℹ️  No results`)
          continue
        }

        let created = 0
        let skipped = 0

        onProgress?.(`💾 Saving to database (smart deduplication)...`)

        for (const result of results) {
          try {
            const upsertResult = await upsertAcademicWithDissertation(
              {
                name: result.name,
                institution: result.institution,
                graduationYear: result.year,
                degreeLevel: result.degreeLevel,
                researchField: result.researchField || 'UNKNOWN',
              },
              {
                title: result.title,
                defenseYear: result.year,
                institution: result.institution,
                abstract: result.abstract,
                advisorName: result.advisor,
                keywords: result.keywords || [],
                sourceUrl: result.sourceUrl,
              },
              {
                source: 'CAPES',
                scrapedAt: new Date(),
              }
            )

            if (upsertResult.dissertationCreated) {
              onProgress?.(`✅ New: ${result.name} (${result.year})`)
              created++
              totalCreated++
            } else {
              skipped++
            }

          } catch (error: any) {
            totalErrors++
            const errorMsg = `Failed to save ${result.name}: ${error.message}`
            errorMessages.push(errorMsg)
            onProgress?.(`❌ ${errorMsg}`)
          }
        }

        totalSkipped += skipped
        onProgress?.(`📈 Batch complete: ${created} new, ${skipped} duplicates`)

        // Rate limiting between institutions
        if (i < INSTITUTIONS_MS.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown'
        totalErrors++
        errorMessages.push(`${institution}: ${errorMsg}`)
        onProgress?.(`❌ ${errorMsg}`)
      }
    }

    onProgress?.(`\n🎉 Scraping complete!`)
    onProgress?.(`📊 Total new academics: ${totalCreated}`)
    onProgress?.(`⏭️  Total duplicates: ${totalSkipped}`)
    onProgress?.(`🏛️  Institutions processed: ${INSTITUTIONS_MS.length}`)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    totalErrors++
    errorMessages.push(errorMsg)
    onProgress?.(`❌ Fatal error: ${errorMsg}`)
  } finally {
    // Clean up browser resources
    if (browserContext) {
      await browserContext.close().catch(() => {})
      browserContext = null
    }
    if (browser) {
      await browser.close().catch(() => {})
      browser = null
    }
    onProgress?.('✅ Browser closed')
  }

  return {
    success: totalErrors === 0,
    totalCreated,
    totalSkipped,
    totalErrors,
    duration: Date.now() - startTime,
    errorMessages: totalErrors > 0 ? errorMessages : undefined
  }
}
