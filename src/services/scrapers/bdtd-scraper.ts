/**
 * BDTD Scraper Service
 *
 * Searches Biblioteca Digital Brasileira de Teses e Dissertacoes (BDTD)
 * for theses/dissertations from Mato Grosso do Sul institutions and saves to database.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { DegreeLevel } from '@prisma/client'
import { upsertAcademicWithDissertation } from '@/lib/academic-upsert'
import type { ScraperOptions, ScraperResult } from './types'

// BDTD - Biblioteca Digital Brasileira de Teses e Dissertacoes
const BDTD_BASE_URL = 'https://bdtd.ibict.br'
const BDTD_SEARCH_URL = `${BDTD_BASE_URL}/vufind/Search/Results`

// Target institutions in Mato Grosso do Sul
const INSTITUTIONS_MS = [
  'Universidade Federal de Mato Grosso do Sul',
  'Universidade Catolica Dom Bosco',
  'Universidade Estadual de Mato Grosso do Sul',
  'Instituto Federal de Mato Grosso do Sul',
]

interface BDTDResult {
  name: string
  title: string
  year: number
  institution: string
  degreeLevel: DegreeLevel
  advisor?: string
  abstract?: string
  url?: string
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

async function searchBDTD(
  institution: string,
  page: Page,
  onProgress?: (msg: string) => void
): Promise<BDTDResult[]> {
  onProgress?.(`🔍 Searching BDTD for ${institution}...`)

  try {
    // Navigate to BDTD search page
    const searchUrl = `${BDTD_SEARCH_URL}?lookfor=${encodeURIComponent(institution)}&type=AllFields`
    onProgress?.(`🌐 Navigating to BDTD (5 minute timeout)...`)

    await page.goto(searchUrl, {
      waitUntil: 'networkidle',
      timeout: 300000, // 5 minutes
    })

    onProgress?.(`✅ Page loaded`)

    // Wait for results to load
    await page.waitForSelector('.result, .no-results', { timeout: 30000 }).catch(() => {})

    // Check if there are no results
    const noResults = await page.locator('.no-results').count()
    if (noResults > 0) {
      onProgress?.(`ℹ️  No results found`)
      return []
    }

    // Extract results from the page
    const results: BDTDResult[] = []

    // Get all result items
    const resultItems = await page.locator('.result').all()
    onProgress?.(`📚 Found ${resultItems.length} result items on page`)

    for (let i = 0; i < resultItems.length; i++) {
      const item = resultItems[i]

      try {
        // Extract title
        const titleEl = item.locator('.result-title, h3 a, .title a').first()
        const title = await titleEl.textContent().catch(() => '')

        // Extract author
        const authorEl = item.locator('.result-author, .author').first()
        const author = await authorEl.textContent().catch(() => '')

        // Extract year
        const yearEl = item.locator('.result-year, .year, .publishDate').first()
        const yearText = await yearEl.textContent().catch(() => '')
        const yearMatch = yearText?.match(/\d{4}/)
        const year = parseInt(yearMatch?.[0] || new Date().getFullYear().toString(), 10)

        // Extract URL
        const url = await titleEl.getAttribute('href').catch(() => '')
        const fullUrl = url?.startsWith('http') ? url : `${BDTD_BASE_URL}${url}`

        // Extract institution from result (might be different from search term)
        const instEl = item.locator('.result-institution, .institution').first()
        const inst = await instEl.textContent().catch(() => institution)

        if (!title || !author) {
          continue
        }

        // Determine degree level from title or context
        const titleLower = title.toLowerCase()
        const degreeLevel: DegreeLevel =
          titleLower.includes('doutorado') || titleLower.includes('doctor') || titleLower.includes('phd')
            ? 'PHD'
            : 'MASTERS'

        results.push({
          name: author.trim(),
          title: title.trim(),
          year,
          institution: (inst || institution).trim(),
          degreeLevel,
          url: fullUrl,
        })

      } catch (error: any) {
        onProgress?.(`⚠️  Error extracting result ${i + 1}: ${error.message}`)
      }
    }

    onProgress?.(`✅ Extracted ${results.length} valid results`)

    return results

  } catch (error: any) {
    onProgress?.(`❌ ${error.message}`)
    return []
  }
}

/**
 * Run BDTD scraper to collect dissertations from MS institutions
 */
export async function runBdtdScrape(
  options?: ScraperOptions
): Promise<ScraperResult> {
  const startTime = Date.now()
  let totalCreated = 0
  let totalSkipped = 0
  let totalErrors = 0
  const errorMessages: string[] = []

  const onProgress = options?.onProgress

  try {
    onProgress?.('🚀 Starting BDTD data collection')
    onProgress?.(`🏛️  Institutions: ${INSTITUTIONS_MS.length}`)

    const context = await getBrowserContext()
    const page = await context.newPage()

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
        const results = await searchBDTD(institution, page, onProgress)
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
              },
              {
                title: result.title,
                defenseYear: result.year,
                institution: result.institution,
                abstract: result.abstract,
                advisorName: result.advisor,
                sourceUrl: result.url,
                keywords: [],
              },
              {
                source: 'BDTD',
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
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown'
        totalErrors++
        errorMessages.push(`${institution}: ${errorMsg}`)
        onProgress?.(`❌ ${errorMsg}`)
      }
    }

    await page.close()

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
