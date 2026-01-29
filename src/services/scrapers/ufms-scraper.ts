/**
 * UFMS Scraper Service
 *
 * Searches UFMS institutional repository for theses/dissertations
 * and saves to database.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { DegreeLevel } from '@prisma/client'
import { upsertAcademicWithDissertation } from '@/lib/academic-upsert'
import type { ScraperOptions, ScraperResult } from './types'

// UFMS Repository (DSpace)
const UFMS_REPO_URL = 'https://repositorio.ufms.br/handle/123456789/52' // Theses/dissertations defended at UFMS

interface UFMSResult {
  name: string
  title: string
  year: number
  degreeLevel: DegreeLevel
  advisor?: string
  abstract?: string
  url?: string
  keywords?: string[]
}

// Shared browser instance for the scrape session
let browser: Browser | null = null
let browserContext: BrowserContext | null = null

async function getBrowser(): Promise<BrowserContext> {
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

async function scrapeUFMSRepository(
  page: Page,
  maxPages: number,
  onProgress?: (msg: string) => void
): Promise<UFMSResult[]> {
  onProgress?.('🌐 Starting UFMS repository scrape')
  onProgress?.(`📚 Collection: Teses e dissertações defendidas na UFMS`)

  const results: UFMSResult[] = []

  try {
    // Navigate to UFMS collection
    onProgress?.(`📡 Navigating to: ${UFMS_REPO_URL}`)
    await page.goto(UFMS_REPO_URL, {
      waitUntil: 'networkidle',
      timeout: 300000, // 5 minutes
    })
    onProgress?.(`✅ Page loaded`)

    // Process multiple pages
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      onProgress?.(`📄 Processing page ${pageNum}/${maxPages}`)

      // Wait for items to load
      await page.waitForSelector('.artifact-title, .ds-artifact-item', { timeout: 30000 }).catch(() => {})

      // Get all items on this page
      const items = await page.locator('.ds-artifact-item, .artifact-title').all()
      onProgress?.(`   Found ${items.length} items on page ${pageNum}`)

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        try {
          // Extract title and link
          const titleLink = item.locator('a').first()
          const title = await titleLink.textContent().catch(() => '')
          const href = await titleLink.getAttribute('href').catch(() => '')
          const itemUrl = href?.startsWith('http') ? href : `https://repositorio.ufms.br${href}`

          if (!title || !href) {
            onProgress?.(`   ⏭️  Skipping item ${i + 1} - no title or link`)
            continue
          }

          onProgress?.(`   [${i + 1}/${items.length}] Opening: ${title.substring(0, 60)}...`)

          // Navigate to item page to get full details
          const itemPage = await browserContext!.newPage()
          await itemPage.goto(itemUrl, { timeout: 60000 })

          // Extract metadata
          const metadata: any = {}

          // Author
          const authorEl = itemPage.locator('meta[name="DC.creator"], meta[name="citation_author"]').first()
          metadata.author = await authorEl.getAttribute('content').catch(() => '')

          // Date
          const dateEl = itemPage.locator('meta[name="DC.date"], meta[name="citation_publication_date"]').first()
          const dateStr = await dateEl.getAttribute('content').catch(() => '')
          metadata.year = parseInt(dateStr?.match(/\d{4}/)?.[0] || new Date().getFullYear().toString(), 10)

          // Advisor
          const advisorEl = itemPage.locator('meta[name="DC.contributor.advisor"]').first()
          metadata.advisor = await advisorEl.getAttribute('content').catch(() => '')

          // Abstract
          const abstractEl = itemPage.locator('meta[name="DC.description.abstract"], meta[name="citation_abstract"]').first()
          metadata.abstract = await abstractEl.getAttribute('content').catch(() => '')

          // Keywords/subjects
          const keywords: string[] = []
          const keywordEls = await itemPage.locator('meta[name="DC.subject"]').all()
          for (const kw of keywordEls) {
            const val = await kw.getAttribute('content').catch(() => '')
            if (val) keywords.push(val)
          }

          // Determine degree level
          const titleLower = title.toLowerCase()
          const degreeLevel: DegreeLevel =
            titleLower.includes('doutorado') || titleLower.includes('doctor') || keywords.some(k => k.toLowerCase().includes('doutorado'))
              ? 'PHD'
              : 'MASTERS'

          onProgress?.(`      👤 Author: ${metadata.author}`)
          onProgress?.(`      📅 Year: ${metadata.year}`)
          onProgress?.(`      🎓 Degree: ${degreeLevel}`)
          if (metadata.advisor) {
            onProgress?.(`      👨‍🏫 Advisor: ${metadata.advisor}`)
          }

          results.push({
            name: metadata.author || 'Unknown',
            title,
            year: metadata.year,
            degreeLevel,
            advisor: metadata.advisor,
            abstract: metadata.abstract,
            url: itemUrl,
            keywords,
          })

          await itemPage.close()

          // Small delay to avoid hammering the server
          await new Promise((resolve) => setTimeout(resolve, 1000))

        } catch (error: any) {
          onProgress?.(`   ❌ Error processing item ${i + 1}: ${error.message}`)
        }
      }

      // Check if there's a next page
      const nextButton = page.locator('a:has-text("Próximo"), a:has-text("Next")').first()
      const hasNext = await nextButton.count() > 0

      if (hasNext && pageNum < maxPages) {
        onProgress?.(`   ➡️  Going to next page...`)
        await nextButton.click()
        await page.waitForLoadState('networkidle', { timeout: 60000 })
      } else {
        onProgress?.(`   ℹ️  No more pages`)
        break
      }
    }

    onProgress?.(`✅ Scraped ${results.length} total dissertations/theses`)
    return results

  } catch (error: any) {
    onProgress?.(`❌ ERROR: ${error.message}`)
    return results
  }
}

/**
 * Run UFMS scraper to collect dissertations from institutional repository
 */
export async function runUfmsScrape(
  options?: ScraperOptions
): Promise<ScraperResult> {
  const startTime = Date.now()
  let totalCreated = 0
  let totalSkipped = 0
  let totalErrors = 0
  const errorMessages: string[] = []

  const maxPages = options?.limit ? Math.ceil(options.limit / 20) : 5 // Estimate ~20 items per page
  const onProgress = options?.onProgress

  try {
    onProgress?.('🚀 Starting UFMS repository scrape')

    const context = await getBrowser()
    const page = await context.newPage()

    // Check for cancellation
    if (options?.signal?.aborted) {
      onProgress?.('⏸️  Cancelled by user')
      await page.close()
      return {
        success: false,
        totalCreated: 0,
        totalSkipped: 0,
        totalErrors: 0,
        duration: Date.now() - startTime,
      }
    }

    const results = await scrapeUFMSRepository(page, maxPages, onProgress)

    onProgress?.(`✅ Found ${results.length} dissertations/theses`)

    if (results.length > 0) {
      onProgress?.(`💾 Saving to database...`)

      for (const result of results) {
        try {
          const upsertResult = await upsertAcademicWithDissertation(
            {
              name: result.name,
              institution: 'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL',
              graduationYear: result.year,
              degreeLevel: result.degreeLevel,
            },
            {
              title: result.title,
              defenseYear: result.year,
              institution: 'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL',
              abstract: result.abstract,
              advisorName: result.advisor,
              sourceUrl: result.url,
              keywords: result.keywords || [],
            },
            {
              source: 'UFMS',
              scrapedAt: new Date(),
            }
          )

          if (upsertResult.dissertationCreated) {
            onProgress?.(`✅ New: ${result.name}`)
            totalCreated++
          } else if (upsertResult.academicUpdated) {
            onProgress?.(`🔄 Updated: ${result.name}`)
            totalSkipped++
          } else {
            onProgress?.(`⏭️  Exists: ${result.name}`)
            totalSkipped++
          }
        } catch (error: any) {
          totalErrors++
          const errorMsg = `Failed to save ${result.name}: ${error.message}`
          errorMessages.push(errorMsg)
          onProgress?.(`❌ ${errorMsg}`)
        }
      }
    }

    await page.close()

    onProgress?.(`\n🎉 UFMS scraping complete!`)
    onProgress?.(`📊 New: ${totalCreated}`)
    onProgress?.(`🔄 Skipped: ${totalSkipped}`)

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
