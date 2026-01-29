import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { logWorkerActivity } from '@/lib/worker-logger'
import { shouldWorkerRun } from '@/lib/worker-control'
import { upsertAcademicWithDissertation } from '@/lib/academic-upsert'
import { DegreeLevel } from '@prisma/client'

// BDTD - Biblioteca Digital Brasileira de Teses e Dissertações
const BDTD_BASE = 'https://bdtd.ibict.br'
const BDTD_SEARCH = `${BDTD_BASE}/vufind/Search/Results`

// Target institutions in Mato Grosso do Sul
const INSTITUTIONS_MS = [
  'Universidade Federal de Mato Grosso do Sul',
  'Universidade Católica Dom Bosco',
  'Universidade Estadual de Mato Grosso do Sul',
  'Instituto Federal de Mato Grosso do Sul',
]

// Shared browser instance
let browser: Browser | null = null
let browserContext: BrowserContext | null = null

async function getBrowserContext() {
  if (!browser) {
    try {
      await logWorkerActivity('bdtd', 'info', '🌐 Launching Chrome browser (visible mode)...')
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
      })
      await logWorkerActivity('bdtd', 'success', '✅ Chrome browser launched')
    } catch (chromeError) {
      try {
        await logWorkerActivity('bdtd', 'info', '⚠️  Chrome not found, trying Chromium...')
        browser = await chromium.launch({
          headless: false,
        })
        await logWorkerActivity('bdtd', 'success', '✅ Chromium browser launched')
      } catch (chromiumError) {
        await logWorkerActivity('bdtd', 'error', '❌ BROWSER LAUNCH FAILED')
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

async function searchBDTD(institution: string, page: Page): Promise<BDTDResult[]> {
  const fs = await import('fs/promises')
  const logFile = 'logs/bdtd-worker-detailed.txt'

  const log = async (msg: string) => {
    const timestamp = new Date().toISOString()
    const logLine = `${timestamp} | ${msg}\n`
    await fs.mkdir('logs', { recursive: true }).catch(() => {})
    await fs.appendFile(logFile, logLine).catch(() => {})
    console.log(msg)
  }

  await log('═══════════════════════════════════════════════════════════════')
  await log('🌐 STARTING BDTD SEARCH')
  await log(`🏛️  Institution: ${institution}`)
  await logWorkerActivity('bdtd', 'info', `    🔍 Searching BDTD for ${institution}...`)

  try {
    // Navigate to BDTD search page
    const searchUrl = `${BDTD_SEARCH}?lookfor=${encodeURIComponent(institution)}&type=AllFields`
    await log(`\n📡 Navigating to: ${searchUrl}`)

    await page.goto(searchUrl, {
      waitUntil: 'networkidle',
      timeout: 300000, // 5 minutes
    })

    await log(`✅ Page loaded`)

    // Wait for results to load
    await page.waitForSelector('.result, .no-results', { timeout: 30000 }).catch(() => {})

    // Check if there are no results
    const noResults = await page.locator('.no-results').count()
    if (noResults > 0) {
      await log(`⚠️  No results found for ${institution}`)
      await logWorkerActivity('bdtd', 'info', `    ℹ️  No results`)
      return []
    }

    // Extract results from the page
    const results: BDTDResult[] = []

    // Get all result items
    const resultItems = await page.locator('.result').all()
    await log(`\n📚 Found ${resultItems.length} result items on page`)

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
        const year = parseInt(yearText.match(/\d{4}/)?.[0] || new Date().getFullYear().toString(), 10)

        // Extract URL
        const url = await titleEl.getAttribute('href').catch(() => '')
        const fullUrl = url?.startsWith('http') ? url : `${BDTD_BASE}${url}`

        // Extract institution from result (might be different from search term)
        const instEl = item.locator('.result-institution, .institution').first()
        const inst = await instEl.textContent().catch(() => institution)

        if (!title || !author) {
          await log(`   ⏭️  Skipping result ${i + 1} - missing title or author`)
          continue
        }

        await log(`\n   [${i + 1}/${resultItems.length}] ${author.trim()}`)
        await log(`      📖 Title: ${title.trim().substring(0, 80)}`)
        await log(`      📅 Year: ${year}`)
        await log(`      🔗 URL: ${fullUrl}`)

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
          institution: inst.trim(),
          degreeLevel,
          url: fullUrl,
        })

      } catch (error: any) {
        await log(`   ❌ Error extracting result ${i + 1}: ${error.message}`)
      }
    }

    await log(`\n✅ Extracted ${results.length} valid results`)
    await log('═══════════════════════════════════════════════════════════════\n')

    await logWorkerActivity('bdtd', 'success', `    ✅ Found ${results.length} dissertations`)

    return results

  } catch (error: any) {
    await log(`\n❌ ERROR: ${error.message}`)
    await log('═══════════════════════════════════════════════════════════════\n')
    await logWorkerActivity('bdtd', 'error', `    ❌ ${error.message}`)
    return []
  }
}

async function processBDTDScrape() {
  const shouldRun = await shouldWorkerRun('bdtd')
  if (!shouldRun) {
    await logWorkerActivity('bdtd', 'info', '⏸️  Worker is paused')
    return
  }

  await logWorkerActivity('bdtd', 'success', '🚀 Starting BDTD data collection')
  await logWorkerActivity('bdtd', 'info', `🏛️  Institutions: ${INSTITUTIONS_MS.length}`)

  let totalCreated = 0
  let totalUpdated = 0
  let totalSkipped = 0

  try {
    const context = await getBrowserContext()
    const page = await context.newPage()

    for (let i = 0; i < INSTITUTIONS_MS.length; i++) {
      const institution = INSTITUTIONS_MS[i]

      const shouldContinue = await shouldWorkerRun('bdtd')
      if (!shouldContinue) {
        await logWorkerActivity('bdtd', 'info', '⏸️  Paused')
        break
      }

      await logWorkerActivity('bdtd', 'info', `\n[${i + 1}/${INSTITUTIONS_MS.length}] 🏛️  ${institution}`)

      try {
        const startTime = Date.now()
        const results = await searchBDTD(institution, page)
        const duration = Date.now() - startTime

        await logWorkerActivity('bdtd', 'info', `    ⏱️  Search completed in ${duration}ms`)

        if (results.length === 0) {
          await logWorkerActivity('bdtd', 'info', `    ℹ️  No results`)
          continue
        }

        // Save to database
        await logWorkerActivity('bdtd', 'info', `    💾 Saving ${results.length} records...`)

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
              await logWorkerActivity('bdtd', 'success', `    ✅ New: ${result.name}`)
              totalCreated++
            } else if (upsertResult.academicUpdated) {
              await logWorkerActivity('bdtd', 'info', `    🔄 Updated: ${result.name}`)
              totalUpdated++
            } else {
              await logWorkerActivity('bdtd', 'info', `    ⏭️  Exists: ${result.name}`)
              totalSkipped++
            }
          } catch (error: any) {
            await logWorkerActivity('bdtd', 'error', `    ❌ Failed to save ${result.name}: ${error.message}`)
          }
        }

        // Delay between institutions
        if (i < INSTITUTIONS_MS.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }

      } catch (error: any) {
        await logWorkerActivity('bdtd', 'error', `    ❌ ${error.message}`)
      }
    }

    await page.close()

  } catch (error: any) {
    await logWorkerActivity('bdtd', 'error', `❌ Fatal error: ${error.message}`)
  }

  await logWorkerActivity('bdtd', 'success', `\n🎉 BDTD scraping complete!`)
  await logWorkerActivity('bdtd', 'success', `   📊 New: ${totalCreated}`)
  await logWorkerActivity('bdtd', 'success', `   🔄 Updated: ${totalUpdated}`)
  await logWorkerActivity('bdtd', 'success', `   ⏭️  Skipped: ${totalSkipped}`)

  // Close browser
  if (browserContext) {
    await browserContext.close()
    browserContext = null
  }
  if (browser) {
    await browser.close()
    browser = null
  }
  await logWorkerActivity('bdtd', 'info', '✅ Browser closed')
}

const bdtdWorker = new Worker(
  'scraper',
  async (job) => {
    try {
      await logWorkerActivity('bdtd', 'info', `📥 Received job: ${job.name} (ID: ${job.id})`)

      if (job.name === 'bdtd-scrape') {
        await logWorkerActivity('bdtd', 'success', '✅ Starting BDTD scrape job...')
        await processBDTDScrape()
      } else {
        await logWorkerActivity('bdtd', 'info', `⏭️  Ignoring job: ${job.name} (not for BDTD)`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      await logWorkerActivity('bdtd', 'error', `❌ Job failed: ${errorMsg}`)
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

bdtdWorker.on('completed', async (job) => {
  await logWorkerActivity('bdtd', 'info', `✓ Job ${job.id} done`)
})

bdtdWorker.on('failed', async (job, err) => {
  await logWorkerActivity('bdtd', 'error', `✗ Job ${job?.id} failed: ${err.message}`)
})

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  if (browserContext) await browserContext.close()
  if (browser) await browser.close()
  await bdtdWorker.close()
})

logWorkerActivity('bdtd', 'success', 'BDTD worker ready (Biblioteca Digital Brasileira)')

export default bdtdWorker
