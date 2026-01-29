import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { logWorkerActivity } from '@/lib/worker-logger'
import { shouldWorkerRun } from '@/lib/worker-control'
import { upsertAcademicWithDissertation } from '@/lib/academic-upsert'
import { DegreeLevel } from '@prisma/client'

// UFMS Repository (DSpace)
const UFMS_BASE = 'https://repositorio.ufms.br'
const UFMS_COLLECTION = `${UFMS_BASE}/handle/123456789/52` // Theses/dissertations defended at UFMS

// Shared browser instance
let browser: Browser | null = null
let browserContext: BrowserContext | null = null

async function getBrowserContext() {
  if (!browser) {
    try {
      await logWorkerActivity('ufms', 'info', '🌐 Launching Chrome browser...')
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
      })
      await logWorkerActivity('ufms', 'success', '✅ Chrome launched')
    } catch {
      try {
        browser = await chromium.launch({ headless: false })
        await logWorkerActivity('ufms', 'success', '✅ Chromium launched')
      } catch {
        throw new Error('No browser available')
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

async function scrapeUFMSRepository(page: Page, maxPages: number = 5): Promise<UFMSResult[]> {
  const fs = await import('fs/promises')
  const logFile = 'logs/ufms-worker-detailed.txt'

  const log = async (msg: string) => {
    const timestamp = new Date().toISOString()
    const logLine = `${timestamp} | ${msg}\n`
    await fs.mkdir('logs', { recursive: true }).catch(() => {})
    await fs.appendFile(logFile, logLine).catch(() => {})
    console.log(msg)
  }

  await log('═══════════════════════════════════════════════════════════════')
  await log('🌐 STARTING UFMS REPOSITORY SCRAPE')
  await log(`📚 Collection: Teses e dissertações defendidas na UFMS`)
  await logWorkerActivity('ufms', 'info', `    🔍 Scraping UFMS repository...`)

  const results: UFMSResult[] = []

  try {
    // Navigate to UFMS collection
    await log(`\n📡 Navigating to: ${UFMS_COLLECTION}`)
    await page.goto(UFMS_COLLECTION, {
      waitUntil: 'networkidle',
      timeout: 300000, // 5 minutes
    })
    await log(`✅ Page loaded`)

    // Process multiple pages
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      await log(`\n📄 Processing page ${pageNum}/${maxPages}`)

      // Wait for items to load
      await page.waitForSelector('.artifact-title, .ds-artifact-item', { timeout: 30000 }).catch(() => {})

      // Get all items on this page
      const items = await page.locator('.ds-artifact-item, .artifact-title').all()
      await log(`   Found ${items.length} items on page ${pageNum}`)

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        try {
          // Extract title and link
          const titleLink = item.locator('a').first()
          const title = await titleLink.textContent().catch(() => '')
          const href = await titleLink.getAttribute('href').catch(() => '')
          const itemUrl = href?.startsWith('http') ? href : `${UFMS_BASE}${href}`

          if (!title || !href) {
            await log(`   ⏭️  Skipping item ${i + 1} - no title or link`)
            continue
          }

          await log(`\n   [${i + 1}/${items.length}] Opening: ${title.substring(0, 60)}...`)

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
          metadata.year = parseInt(dateStr.match(/\d{4}/)?.[0] || new Date().getFullYear().toString(), 10)

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

          await log(`      👤 Author: ${metadata.author}`)
          await log(`      📅 Year: ${metadata.year}`)
          await log(`      🎓 Degree: ${degreeLevel}`)
          if (metadata.advisor) {
            await log(`      👨‍🏫 Advisor: ${metadata.advisor}`)
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
          await log(`   ❌ Error processing item ${i + 1}: ${error.message}`)
        }
      }

      // Check if there's a next page
      const nextButton = page.locator('a:has-text("Próximo"), a:has-text("Next")').first()
      const hasNext = await nextButton.count() > 0

      if (hasNext && pageNum < maxPages) {
        await log(`   ➡️  Going to next page...`)
        await nextButton.click()
        await page.waitForLoadState('networkidle', { timeout: 60000 })
      } else {
        await log(`   ℹ️  No more pages`)
        break
      }
    }

    await log(`\n✅ Scraped ${results.length} total dissertations/theses`)
    await log('═══════════════════════════════════════════════════════════════\n')

    return results

  } catch (error: any) {
    await log(`\n❌ ERROR: ${error.message}`)
    await log('═══════════════════════════════════════════════════════════════\n')
    return results
  }
}

async function processUFMSScrape() {
  const shouldRun = await shouldWorkerRun('ufms')
  if (!shouldRun) {
    await logWorkerActivity('ufms', 'info', '⏸️  Worker is paused')
    return
  }

  await logWorkerActivity('ufms', 'success', '🚀 Starting UFMS repository scrape')

  let totalCreated = 0
  let totalUpdated = 0
  let totalSkipped = 0

  try {
    const context = await getBrowserContext()
    const page = await context.newPage()

    const startTime = Date.now()
    const results = await scrapeUFMSRepository(page, 5) // Scrape first 5 pages
    const duration = Date.now() - startTime

    await logWorkerActivity('ufms', 'info', `⏱️  Scraping completed in ${duration}ms`)
    await logWorkerActivity('ufms', 'success', `✅ Found ${results.length} dissertations/theses`)

    if (results.length > 0) {
      await logWorkerActivity('ufms', 'info', `💾 Saving to database...`)

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
            await logWorkerActivity('ufms', 'success', `✅ New: ${result.name}`)
            totalCreated++
          } else if (upsertResult.academicUpdated) {
            await logWorkerActivity('ufms', 'info', `🔄 Updated: ${result.name}`)
            totalUpdated++
          } else {
            await logWorkerActivity('ufms', 'info', `⏭️  Exists: ${result.name}`)
            totalSkipped++
          }
        } catch (error: any) {
          await logWorkerActivity('ufms', 'error', `❌ Failed to save ${result.name}: ${error.message}`)
        }
      }
    }

    await page.close()

  } catch (error: any) {
    await logWorkerActivity('ufms', 'error', `❌ Fatal error: ${error.message}`)
  }

  await logWorkerActivity('ufms', 'success', `\n🎉 UFMS scraping complete!`)
  await logWorkerActivity('ufms', 'success', `   📊 New: ${totalCreated}`)
  await logWorkerActivity('ufms', 'success', `   🔄 Updated: ${totalUpdated}`)
  await logWorkerActivity('ufms', 'success', `   ⏭️  Skipped: ${totalSkipped}`)

  // Close browser
  if (browserContext) {
    await browserContext.close()
    browserContext = null
  }
  if (browser) {
    await browser.close()
    browser = null
  }
  await logWorkerActivity('ufms', 'info', '✅ Browser closed')
}

const ufmsWorker = new Worker(
  'scraper',
  async (job) => {
    try {
      await logWorkerActivity('ufms', 'info', `📥 Received job: ${job.name} (ID: ${job.id})`)

      if (job.name === 'ufms-scrape') {
        await logWorkerActivity('ufms', 'success', '✅ Starting UFMS scrape job...')
        await processUFMSScrape()
      } else {
        await logWorkerActivity('ufms', 'info', `⏭️  Ignoring job: ${job.name} (not for UFMS)`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      await logWorkerActivity('ufms', 'error', `❌ Job failed: ${errorMsg}`)
      // Close browser on error to prevent resource leaks
      if (browserContext) {
        await browserContext.close().catch(() => {})
        browserContext = null
      }
      if (browser) {
        await browser.close().catch(() => {})
        browser = null
      }
      throw error // Re-throw so BullMQ marks job as failed
    }
  },
  { connection, concurrency: 1 }
)

ufmsWorker.on('completed', async (job) => {
  await logWorkerActivity('ufms', 'info', `✓ Job ${job.id} done`)
})

ufmsWorker.on('failed', async (job, err) => {
  await logWorkerActivity('ufms', 'error', `✗ Job ${job?.id} failed: ${err.message}`)
})

process.on('SIGTERM', async () => {
  if (browserContext) await browserContext.close()
  if (browser) await browser.close()
  await ufmsWorker.close()
})

logWorkerActivity('ufms', 'success', 'UFMS worker ready (Universidade Federal de MS)')

export default ufmsWorker
