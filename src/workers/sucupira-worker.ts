import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { DegreeLevel } from '@prisma/client'
import { logWorkerActivity } from '@/lib/worker-logger'
import { shouldWorkerRun } from '@/lib/worker-control'
import { chromium, Browser, BrowserContext } from 'playwright'

// CAPES Open Data API (CKAN)
const CAPES_API_BASE = 'https://dadosabertos.capes.gov.br/api/3/action'

// Correct resource IDs for recent thesis/dissertation data (2021-2024)
// These have datastore_active: true and can be queried
const RESOURCE_IDS = {
  '2024': '87133ba7-ac99-4d87-966e-8f580bc96231',
  '2023': 'b69baf26-8d02-4c10-ba39-7e9ab799e6ed',
  '2022': '78f73608-6f5e-463c-ba79-0bff4f8a578d',
  '2021': '068003e4-196c-41f4-8c35-1f7c94b4e55c',
}

// Shared browser instance
let browser: Browser | null = null
let browserContext: BrowserContext | null = null

async function getBrowserContext() {
  if (!browser) {
    try {
      // Try Chrome first (preferred)
      await logWorkerActivity('sucupira', 'info', '🌐 Launching Chrome browser (visible mode)...')
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
      })
      await logWorkerActivity('sucupira', 'success', '✅ Chrome browser launched')
    } catch (chromeError) {
      try {
        // Fallback to Chromium
        await logWorkerActivity('sucupira', 'info', '⚠️  Chrome not found, trying Chromium...')
        browser = await chromium.launch({
          headless: false,
        })
        await logWorkerActivity('sucupira', 'success', '✅ Chromium browser launched')
      } catch (chromiumError) {
        await logWorkerActivity('sucupira', 'error', '❌ BROWSER LAUNCH FAILED')
        await logWorkerActivity('sucupira', 'error', '   Chrome not installed or not found')
        await logWorkerActivity('sucupira', 'error', '   Chromium download failed')
        await logWorkerActivity('sucupira', 'error', '   Please install Google Chrome or run: npx playwright install chromium')
        throw new Error('No browser available. Install Chrome or run: npx playwright install chromium')
      }
    }
  }
  if (!browserContext) {
    browserContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    })
    // Set page title in browser window
    const page = await browserContext.newPage()
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.close()
  }
  return browserContext
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
}

// Search CAPES DataStore for dissertations/theses using Playwright
async function searchCAPESDataStore(institution: string, limit: number = 100): Promise<SucupiraResult[]> {
  const fs = await import('fs/promises')
  const logFile = 'sucupira-worker-detailed.txt'

  const log = async (msg: string) => {
    const timestamp = new Date().toISOString()
    const logLine = `${timestamp} | ${msg}\n`
    await fs.appendFile(logFile, logLine).catch(() => {})
    console.log(msg)
  }

  await log('═══════════════════════════════════════════════════════════════')
  await log('🌐 STARTING CAPES DATASTORE SEARCH (PLAYWRIGHT)')
  await log(`🏛️  Institution: ${institution}`)
  await log(`📊 Limit: ${limit} records`)
  await logWorkerActivity('sucupira', 'info', `    🌐 Querying CAPES API...`)

  try {
    const searchUrl = `${CAPES_API_BASE}/datastore_search`
    const resourceId = RESOURCE_IDS['2024']

    // Build query filters
    const filters = JSON.stringify({
      'NM_ENTIDADE_ENSINO': institution
    })

    const fullUrl = `${searchUrl}?resource_id=${resourceId}&filters=${encodeURIComponent(filters)}&limit=${limit}`

    await log(`\n📡 API REQUEST:`)
    await log(`   Resource: 2024 data (${resourceId})`)
    await log(`   Institution: ${institution}`)
    await log(`   URL: ${fullUrl}`)

    // Use Playwright to fetch data (works better than Node.js fetch)
    const context = await getBrowserContext()
    const page = await context.newPage()

    // Set page title so you can see which institution is being processed
    await page.evaluate((inst) => {
      document.title = `CAPES Scraper - ${inst}`
    }, institution).catch(() => {})

    await log(`\n🔄 NAVIGATING WITH BROWSER...`)
    await logWorkerActivity('sucupira', 'info', `    🌐 Opening browser to ${institution}...`)

    const response = await page.goto(fullUrl, {
      waitUntil: 'networkidle',
      timeout: 60000,
    })

    if (!response) {
      await log(`❌ No response received`)
      await logWorkerActivity('sucupira', 'error', `    ❌ No response`)
      await page.close()
      return []
    }

    const status = response.status()
    await log(`✅ Response status: ${status}`)

    if (status !== 200) {
      const content = await page.content()
      await log(`❌ HTTP ${status}`)
      await log(`Response: ${content.substring(0, 500)}`)
      await logWorkerActivity('sucupira', 'error', `    ❌ HTTP ${status}`)
      await page.close()
      return []
    }

    // Extract JSON from page
    const content = await page.content()
    const jsonMatch = content.match(/<pre>(.*?)<\/pre>/s)

    if (!jsonMatch) {
      await log(`❌ Could not extract JSON from response`)
      await page.close()
      return []
    }

    const data = JSON.parse(jsonMatch[1])
    await page.close()

    if (!data.success || !data.result?.records) {
      await log(`\n⚠️  NO RECORDS FOUND`)
      await log(`   success: ${data.success}`)
      await log(`   error: ${data.error ? JSON.stringify(data.error) : 'none'}`)
      await logWorkerActivity('sucupira', 'info', `    ℹ️  No records for ${institution}`)
      return []
    }

    const records = data.result.records
    await log(`\n✅ FOUND ${records.length} RECORDS`)

    if (records.length > 0) {
      await log(`\n📝 SAMPLE RECORD:`)
      await log(`   Fields: ${JSON.stringify(Object.keys(records[0]))}`)
    }

    await logWorkerActivity('sucupira', 'info', `    ✅ Found ${records.length} records`)

    // Transform API data to our format
    const results: SucupiraResult[] = []

    await log(`\n📚 PROCESSING RECORDS:`)
    for (let i = 0; i < records.length; i++) {
      const record = records[i]

      const name = record.NM_AUTOR || record.NM_DISCENTE || 'Unknown'
      const title = record.NM_PRODUCAO || record.NM_TRABALHO || 'No title'
      const year = parseInt(record.AN_BASE || new Date().getFullYear(), 10)
      const inst = record.NM_ENTIDADE_ENSINO || institution
      const degree = (record.NM_GRAU_ACADEMICO || '').toLowerCase()
      const advisor = record.NM_ORIENTADOR || undefined
      const abstract = record.DS_RESUMO || undefined

      const degreeLevel = degree.includes('doutorado') || degree.includes('phd') ? 'DOCTORATE' : 'MASTERS'

      // Log each dissertation
      await log(`\n   [${i + 1}/${records.length}] ${name}`)
      await log(`      📖 Title: ${title.substring(0, 80)}${title.length > 80 ? '...' : ''}`)
      await log(`      📅 Year: ${year} | 🎓 Degree: ${degreeLevel}`)
      if (advisor) {
        await log(`      👨‍🏫 Advisor: ${advisor}`)
      }

      results.push({
        name,
        title,
        year,
        institution: inst,
        degreeLevel,
        advisor,
        abstract,
      })
    }

    await log(`\n✅ TRANSFORMED ${results.length} RESULTS`)
    await log('═══════════════════════════════════════════════════════════════\n')
    return results

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    await log(`\n❌ ERROR: ${errorMsg}`)
    await log('═══════════════════════════════════════════════════════════════\n')
    await logWorkerActivity('sucupira', 'error', `    ❌ ${errorMsg}`)
    return []
  }
}

async function processSucupiraScrape() {
  const shouldRun = await shouldWorkerRun('sucupira')
  if (!shouldRun) {
    await logWorkerActivity('sucupira', 'info', '⏸️  Worker is paused')
    return
  }

  await logWorkerActivity('sucupira', 'success', '🚀 Starting Sucupira data collection via CAPES Open Data API')
  await logWorkerActivity('sucupira', 'info', `🏛️  Institutions: ${INSTITUTIONS_MS.length}`)

  let totalCreated = 0
  let totalSkipped = 0

  for (let i = 0; i < INSTITUTIONS_MS.length; i++) {
    const institution = INSTITUTIONS_MS[i]

    const shouldContinue = await shouldWorkerRun('sucupira')
    if (!shouldContinue) {
      await logWorkerActivity('sucupira', 'info', '⏸️  Paused')
      break
    }

    await logWorkerActivity('sucupira', 'info', `\n[${i + 1}/${INSTITUTIONS_MS.length}] 🏛️  ${institution}`)

    try {
      const startTime = Date.now()
      const results = await searchCAPESDataStore(institution, 100)
      const duration = Date.now() - startTime

      await logWorkerActivity('sucupira', 'info', `    ⏱️  Completed in ${duration}ms`)

      if (results.length === 0) {
        await logWorkerActivity('sucupira', 'info', `    ℹ️  No results`)
        continue
      }

      let created = 0
      let skipped = 0

      await logWorkerActivity('sucupira', 'info', `    💾 Saving to database...`)

      for (const result of results) {
        const existing = await prisma.academic.findFirst({
          where: { name: result.name, institution: result.institution },
        })

        if (existing) {
          await logWorkerActivity('sucupira', 'info', `    ⏭️  Skip (exists): ${result.name}`)
          skipped++
          continue
        }

        await prisma.academic.create({
          data: {
            name: result.name,
            institution: result.institution,
            degreeLevel: result.degreeLevel,
            researchField: 'UNKNOWN',
            graduationYear: result.year,
            thesisTitle: result.title,
            advisor: result.advisor,
            abstract: result.abstract,
            enrichmentStatus: 'NONE',
          },
        })

        await logWorkerActivity('sucupira', 'success', `    ✅ Saved: ${result.name} (${result.year}) - ${result.degreeLevel}`)
        created++
        totalCreated++
      }

      totalSkipped += skipped
      await logWorkerActivity('sucupira', 'success', `    📈 Batch complete: ${created} new, ${skipped} duplicates`)

      if (i < INSTITUTIONS_MS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown'
      await logWorkerActivity('sucupira', 'error', `    ❌ ${errorMsg}`)
    }
  }

  await logWorkerActivity('sucupira', 'success', `\n🎉 Scraping complete!`)
  await logWorkerActivity('sucupira', 'success', `   📊 Total new academics: ${totalCreated}`)
  await logWorkerActivity('sucupira', 'success', `   ⏭️  Total duplicates: ${totalSkipped}`)
  await logWorkerActivity('sucupira', 'success', `   🏛️  Institutions processed: ${INSTITUTIONS_MS.length}`)

  // Close browser after completion
  if (browserContext) {
    await browserContext.close()
    browserContext = null
  }
  if (browser) {
    await browser.close()
    browser = null
  }
  await logWorkerActivity('sucupira', 'info', '✅ Browser closed')
}

const sucupiraWorker = new Worker(
  'scraper',
  async (job) => {
    if (job.name === 'sucupira-scrape') {
      await processSucupiraScrape()
    }
  },
  { connection, concurrency: 1 }
)

sucupiraWorker.on('completed', async (job) => {
  await logWorkerActivity('sucupira', 'info', `✓ Job ${job.id} done`)
})

sucupiraWorker.on('failed', async (job, err) => {
  await logWorkerActivity('sucupira', 'error', `✗ Job ${job?.id} failed: ${err.message}`)
})

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  if (browserContext) await browserContext.close()
  if (browser) await browser.close()
  await sucupiraWorker.close()
})

logWorkerActivity('sucupira', 'success', 'Sucupira worker ready (CAPES DataStore API + Playwright)')

export default sucupiraWorker
