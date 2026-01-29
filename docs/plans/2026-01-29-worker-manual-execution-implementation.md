# Worker Manual Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable manual worker execution without requiring `npm run workers` to be running by extracting scraper logic into reusable service functions.

**Architecture:** Create service layer in `src/services/scrapers/` that contains pure business logic. Workers become thin wrappers that call services. New API endpoint `/api/admin/workers/run` calls services directly.

**Tech Stack:** TypeScript, Playwright, BullMQ, Next.js API Routes

---

## Task 1: Create Service Types

**Files:**
- Create: `src/services/scrapers/types.ts`

**Step 1: Create services directory**

```bash
mkdir -p src/services/scrapers
```

**Step 2: Create types file**

Create `src/services/scrapers/types.ts`:

```typescript
/**
 * Shared types for scraper services
 *
 * These services extract core scraper logic from workers to enable
 * both scheduled (via BullMQ) and manual (via API) execution.
 */

export interface ScraperOptions {
  /** Maximum number of records to process */
  limit?: number

  /** Progress callback for real-time logging */
  onProgress?: (msg: string) => void

  /** AbortSignal for cancellation support */
  signal?: AbortSignal
}

export interface ScraperResult {
  /** Whether the scrape completed without fatal errors */
  success: boolean

  /** Number of new records created */
  totalCreated: number

  /** Number of duplicate/existing records skipped */
  totalSkipped: number

  /** Number of errors encountered */
  totalErrors: number

  /** Duration in milliseconds */
  duration: number

  /** Error messages if any errors occurred */
  errorMessages?: string[]
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/services/scrapers/types.ts
git commit -m "feat: add scraper service types"
```

---

## Task 2: Extract Sucupira Scraper Service

**Files:**
- Create: `src/services/scrapers/sucupira-scraper.ts`
- Reference: `src/workers/sucupira-worker.ts` (lines 65-254 contain core logic)

**Step 1: Read existing worker to understand logic**

Read: `src/workers/sucupira-worker.ts`
Note: Key functions are `searchCAPESDataStore()` (lines 87-253) and `processSucupiraScrape()` (lines 255-366)

**Step 2: Create sucupira-scraper.ts**

Create `src/services/scrapers/sucupira-scraper.ts`:

```typescript
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
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/services/scrapers/sucupira-scraper.ts
git commit -m "feat: extract Sucupira scraper service

Extract core CAPES API scraping logic from worker into reusable service.
Enables both scheduled (via BullMQ) and manual (via API) execution."
```

---

## Task 3: Extract BDTD Scraper Service

**Files:**
- Create: `src/services/scrapers/bdtd-scraper.ts`
- Reference: `src/workers/bdtd-worker.ts`

**Step 1: Read existing worker**

Read: `src/workers/bdtd-worker.ts`
Note: Core logic in `processBdtdScrape()` function

**Step 2: Create bdtd-scraper.ts**

Create `src/services/scrapers/bdtd-scraper.ts`:

```typescript
/**
 * BDTD Scraper Service
 *
 * Searches Brazilian Digital Library of Theses and Dissertations (BDTD)
 * for works from Mato Grosso do Sul institutions.
 */

import { chromium, Browser, Page } from 'playwright'
import { DegreeLevel } from '@prisma/client'
import { upsertAcademicWithDissertation } from '@/lib/academic-upsert'
import type { ScraperOptions, ScraperResult } from './types'

const BDTD_BASE_URL = 'https://bdtd.ibict.br'
const BDTD_SEARCH_URL = `${BDTD_BASE_URL}/vufind/Search/Results`

// MS institutions to search
const INSTITUTIONS_MS = [
  'Universidade Federal de Mato Grosso do Sul',
  'Universidade Católica Dom Bosco',
  'Universidade Estadual de Mato Grosso do Sul',
]

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    try {
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
      })
    } catch {
      browser = await chromium.launch({
        headless: false,
      })
    }
  }
  return browser
}

async function searchBDTD(
  institution: string,
  limit: number,
  onProgress?: (msg: string) => void
): Promise<any[]> {
  onProgress?.(`🔍 Searching BDTD for ${institution}...`)

  try {
    const browser = await getBrowser()
    const page = await browser.newPage()

    const searchUrl = `${BDTD_SEARCH_URL}?lookfor=${encodeURIComponent(institution)}&type=AllFields&limit=${limit}`

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 })
    onProgress?.(`✅ Page loaded`)

    // Extract results (this is simplified - actual selectors depend on BDTD HTML structure)
    const results = await page.$$eval('.result-item, .result', (items) => {
      return items.map(item => ({
        title: item.querySelector('.result-title')?.textContent?.trim() || '',
        author: item.querySelector('.result-author')?.textContent?.trim() || '',
        year: item.querySelector('.result-year')?.textContent?.trim() || '',
        link: item.querySelector('a')?.getAttribute('href') || '',
      }))
    }).catch(() => [])

    await page.close()
    onProgress?.(`📚 Found ${results.length} results`)

    return results
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.(`❌ ${errorMsg}`)
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

  const limit = options?.limit || 50
  const onProgress = options?.onProgress

  try {
    onProgress?.('🚀 Starting BDTD scraper')
    onProgress?.(`🏛️  Institutions: ${INSTITUTIONS_MS.length}`)

    for (let i = 0; i < INSTITUTIONS_MS.length; i++) {
      const institution = INSTITUTIONS_MS[i]

      if (options?.signal?.aborted) {
        onProgress?.('⏸️  Cancelled')
        break
      }

      onProgress?.(`\n[${i + 1}/${INSTITUTIONS_MS.length}] ${institution}`)

      try {
        const results = await searchBDTD(institution, limit, onProgress)

        if (results.length === 0) {
          continue
        }

        let created = 0
        let skipped = 0

        for (const result of results) {
          try {
            const year = parseInt(result.year) || new Date().getFullYear()

            const upsertResult = await upsertAcademicWithDissertation(
              {
                name: result.author,
                institution,
                graduationYear: year,
                degreeLevel: DegreeLevel.MASTERS, // Default, could parse from title
              },
              {
                title: result.title,
                defenseYear: year,
                institution,
                sourceUrl: result.link.startsWith('http') ? result.link : `${BDTD_BASE_URL}${result.link}`,
                keywords: [],
              },
              {
                source: 'BDTD',
                scrapedAt: new Date(),
              }
            )

            if (upsertResult.dissertationCreated) {
              created++
              totalCreated++
            } else {
              skipped++
            }
          } catch (error: any) {
            totalErrors++
            errorMessages.push(error.message)
          }
        }

        totalSkipped += skipped
        onProgress?.(`📈 ${created} new, ${skipped} duplicates`)

        if (i < INSTITUTIONS_MS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown'
        totalErrors++
        errorMessages.push(`${institution}: ${errorMsg}`)
        onProgress?.(`❌ ${errorMsg}`)
      }
    }

    onProgress?.(`\n🎉 Complete: ${totalCreated} new, ${totalSkipped} duplicates`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown'
    totalErrors++
    errorMessages.push(errorMsg)
    onProgress?.(`❌ Fatal: ${errorMsg}`)
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
      browser = null
    }
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
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/services/scrapers/bdtd-scraper.ts
git commit -m "feat: extract BDTD scraper service"
```

---

## Task 4: Extract UFMS Scraper Service

**Files:**
- Create: `src/services/scrapers/ufms-scraper.ts`
- Reference: `src/workers/ufms-worker.ts`

**Step 1: Create ufms-scraper.ts**

Create `src/services/scrapers/ufms-scraper.ts`:

```typescript
/**
 * UFMS Scraper Service
 *
 * Searches UFMS institutional repository for dissertations and theses.
 */

import { chromium, Browser } from 'playwright'
import { DegreeLevel } from '@prisma/client'
import { upsertAcademicWithDissertation } from '@/lib/academic-upsert'
import type { ScraperOptions, ScraperResult } from './types'

const UFMS_REPO_URL = 'https://repositorio.ufms.br'

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    try {
      browser = await chromium.launch({ headless: false, channel: 'chrome' })
    } catch {
      browser = await chromium.launch({ headless: false })
    }
  }
  return browser
}

/**
 * Run UFMS repository scraper
 */
export async function runUfmsScrape(
  options?: ScraperOptions
): Promise<ScraperResult> {
  const startTime = Date.now()
  let totalCreated = 0
  let totalSkipped = 0
  let totalErrors = 0
  const errorMessages: string[] = []

  const limit = options?.limit || 50
  const onProgress = options?.onProgress

  try {
    onProgress?.('🚀 Starting UFMS repository scraper')

    const browser = await getBrowser()
    const page = await browser.newPage()

    // Navigate to UFMS repository (simplified - actual implementation depends on repository structure)
    await page.goto(`${UFMS_REPO_URL}/browse?type=dateissued&sort_by=2&order=DESC&rpp=${limit}`, {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    onProgress?.('✅ Repository loaded')

    // Extract dissertation data (simplified selectors)
    const results = await page.$$eval('.artifact-description, .item', (items) => {
      return items.map(item => ({
        title: item.querySelector('.artifact-title, h4')?.textContent?.trim() || '',
        author: item.querySelector('.author')?.textContent?.trim() || '',
        year: item.querySelector('.date')?.textContent?.trim() || '',
        link: item.querySelector('a')?.getAttribute('href') || '',
      }))
    }).catch(() => [])

    onProgress?.(`📚 Found ${results.length} items`)

    for (const result of results) {
      if (options?.signal?.aborted) break

      try {
        const year = parseInt(result.year) || new Date().getFullYear()

        const upsertResult = await upsertAcademicWithDissertation(
          {
            name: result.author,
            institution: 'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL',
            graduationYear: year,
            degreeLevel: DegreeLevel.MASTERS,
          },
          {
            title: result.title,
            defenseYear: year,
            institution: 'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL',
            sourceUrl: result.link.startsWith('http') ? result.link : `${UFMS_REPO_URL}${result.link}`,
            keywords: [],
          },
          {
            source: 'UFMS',
            scrapedAt: new Date(),
          }
        )

        if (upsertResult.dissertationCreated) {
          totalCreated++
          onProgress?.(`✅ New: ${result.author}`)
        } else {
          totalSkipped++
        }
      } catch (error: any) {
        totalErrors++
        errorMessages.push(error.message)
      }
    }

    await page.close()
    onProgress?.(`\n🎉 Complete: ${totalCreated} new, ${totalSkipped} duplicates`)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown'
    totalErrors++
    errorMessages.push(errorMsg)
    onProgress?.(`❌ Fatal: ${errorMsg}`)
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
      browser = null
    }
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
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/services/scrapers/ufms-scraper.ts
git commit -m "feat: extract UFMS scraper service"
```

---

## Task 5: Extract LinkedIn Scraper Service

**Files:**
- Create: `src/services/scrapers/linkedin-scraper.ts`
- Reference: `src/workers/linkedin-worker.ts`

**Step 1: Create linkedin-scraper.ts**

Create `src/services/scrapers/linkedin-scraper.ts`:

```typescript
/**
 * LinkedIn Enrichment Service
 *
 * Enriches academic profiles with LinkedIn employment data.
 */

import { prisma } from '@/lib/db'
import { searchLinkedInProfile, extractEmploymentData } from '@/lib/scrapers/linkedin'
import { getBrowser } from '@/lib/scrapers/browser'
import type { ScraperOptions, ScraperResult } from './types'

/**
 * Run LinkedIn enrichment for pending academics
 */
export async function runLinkedinEnrichment(
  options?: ScraperOptions
): Promise<ScraperResult> {
  const startTime = Date.now()
  let totalCreated = 0
  let totalSkipped = 0
  let totalErrors = 0
  const errorMessages: string[] = []

  const limit = options?.limit || 10
  const onProgress = options?.onProgress

  try {
    onProgress?.('🚀 Starting LinkedIn enrichment')

    // Find academics pending enrichment
    const academics = await prisma.academic.findMany({
      where: {
        enrichmentStatus: 'PENDING',
        linkedinUrl: null,
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    onProgress?.(`👥 Found ${academics.length} academics to enrich`)

    if (academics.length === 0) {
      onProgress?.('ℹ️  No pending academics')
      return {
        success: true,
        totalCreated: 0,
        totalSkipped: 0,
        totalErrors: 0,
        duration: Date.now() - startTime
      }
    }

    const browser = await getBrowser()

    for (let i = 0; i < academics.length; i++) {
      const academic = academics[i]

      if (options?.signal?.aborted) {
        onProgress?.('⏸️  Cancelled')
        break
      }

      onProgress?.(`\n[${i + 1}/${academics.length}] ${academic.name}`)

      try {
        // Search LinkedIn for profile
        const profileUrl = await searchLinkedInProfile(browser, academic.name, academic.institution)

        if (!profileUrl) {
          totalSkipped++
          onProgress?.('⏭️  No LinkedIn profile found')
          continue
        }

        // Extract employment data
        const employmentData = await extractEmploymentData(browser, profileUrl)

        // Update academic record
        await prisma.academic.update({
          where: { id: academic.id },
          data: {
            linkedinUrl: profileUrl,
            currentJobTitle: employmentData.jobTitle,
            currentCompany: employmentData.company,
            currentSector: employmentData.sector,
            enrichmentStatus: 'PARTIAL',
            lastEnrichedAt: new Date(),
          }
        })

        totalCreated++
        onProgress?.(`✅ Enriched: ${employmentData.jobTitle} at ${employmentData.company}`)

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000))

      } catch (error: any) {
        totalErrors++
        const errorMsg = `${academic.name}: ${error.message}`
        errorMessages.push(errorMsg)
        onProgress?.(`❌ ${errorMsg}`)
      }
    }

    onProgress?.(`\n🎉 Complete: ${totalCreated} enriched, ${totalSkipped} skipped`)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown'
    totalErrors++
    errorMessages.push(errorMsg)
    onProgress?.(`❌ Fatal: ${errorMsg}`)
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
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/services/scrapers/linkedin-scraper.ts
git commit -m "feat: extract LinkedIn enrichment service"
```

---

## Task 6: Create Manual Execution API Endpoint

**Files:**
- Create: `src/app/api/admin/workers/run/route.ts`

**Step 1: Create run directory**

```bash
mkdir -p src/app/api/admin/workers/run
```

**Step 2: Create route.ts**

Create `src/app/api/admin/workers/run/route.ts`:

```typescript
/**
 * Manual Worker Execution API
 *
 * Directly executes scraper services without requiring BullMQ workers to be running.
 * Progress is logged to worker activity logs for display in admin UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logWorkerActivity } from '@/lib/worker-logger'
import { runSucupiraScrape } from '@/services/scrapers/sucupira-scraper'
import { runBdtdScrape } from '@/services/scrapers/bdtd-scraper'
import { runUfmsScrape } from '@/services/scrapers/ufms-scraper'
import { runLinkedinEnrichment } from '@/services/scrapers/linkedin-scraper'

type WorkerName = 'sucupira' | 'bdtd' | 'ufms' | 'linkedin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worker } = body as { worker: WorkerName }

    if (!worker || !['sucupira', 'bdtd', 'ufms', 'linkedin'].includes(worker)) {
      return NextResponse.json(
        { error: 'Invalid worker. Use "sucupira", "bdtd", "ufms", or "linkedin"' },
        { status: 400 }
      )
    }

    await logWorkerActivity(worker, 'info', '▶️  Manual execution started')

    let result

    switch (worker) {
      case 'sucupira':
        result = await runSucupiraScrape({
          onProgress: (msg) => logWorkerActivity('sucupira', 'info', msg)
        })
        break

      case 'bdtd':
        result = await runBdtdScrape({
          onProgress: (msg) => logWorkerActivity('bdtd', 'info', msg)
        })
        break

      case 'ufms':
        result = await runUfmsScrape({
          onProgress: (msg) => logWorkerActivity('ufms', 'info', msg)
        })
        break

      case 'linkedin':
        result = await runLinkedinEnrichment({
          onProgress: (msg) => logWorkerActivity('linkedin', 'info', msg)
        })
        break
    }

    const message = result.success
      ? `${worker} scrape completed successfully`
      : `${worker} scrape completed with errors`

    await logWorkerActivity(
      worker,
      result.success ? 'success' : 'error',
      `✅ Manual execution complete: ${result.totalCreated} created, ${result.totalSkipped} skipped, ${result.totalErrors} errors`
    )

    return NextResponse.json({
      success: result.success,
      message,
      result
    })

  } catch (error) {
    console.error('Manual worker execution error:', error)
    return NextResponse.json(
      { error: 'Failed to execute worker', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/app/api/admin/workers/run/route.ts
git commit -m "feat: add manual worker execution API endpoint

New POST /api/admin/workers/run endpoint executes scrapers directly
without requiring npm run workers. Progress logged to admin UI."
```

---

## Task 7: Update Sucupira Worker to Use Service

**Files:**
- Modify: `src/workers/sucupira-worker.ts`

**Step 1: Read current worker implementation**

Read: `src/workers/sucupira-worker.ts`

**Step 2: Replace processSucupiraScrape with service call**

Modify `src/workers/sucupira-worker.ts`:

Find the `processSucupiraScrape()` function (around line 255) and replace it with:

```typescript
async function processSucupiraScrape() {
  const shouldRun = await shouldWorkerRun('sucupira')
  if (!shouldRun) {
    await logWorkerActivity('sucupira', 'info', '⏸️  Worker is paused')
    return
  }

  const result = await runSucupiraScrape({
    onProgress: (msg) => logWorkerActivity('sucupira', 'info', msg)
  })

  if (result.success) {
    await logWorkerActivity('sucupira', 'success',
      `Complete: ${result.totalCreated} new, ${result.totalSkipped} skipped`
    )
  } else {
    await logWorkerActivity('sucupira', 'error',
      `Completed with errors: ${result.totalErrors} errors`
    )
  }
}
```

Add import at top:

```typescript
import { runSucupiraScrape } from '@/services/scrapers/sucupira-scraper'
```

Remove the old `searchCAPESDataStore()` function and embedded logic (lines 87-366 can be deleted since it's now in the service).

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/workers/sucupira-worker.ts
git commit -m "refactor: update Sucupira worker to use service layer

Worker now calls runSucupiraScrape() service function.
Removes embedded logic (moved to service)."
```

---

## Task 8: Update BDTD Worker to Use Service

**Files:**
- Modify: `src/workers/bdtd-worker.ts`

**Step 1: Update worker to call service**

Add import:
```typescript
import { runBdtdScrape } from '@/services/scrapers/bdtd-scraper'
```

Replace core logic with service call following same pattern as Task 7.

**Step 2: Commit**

```bash
git add src/workers/bdtd-worker.ts
git commit -m "refactor: update BDTD worker to use service layer"
```

---

## Task 9: Update UFMS Worker to Use Service

**Files:**
- Modify: `src/workers/ufms-worker.ts`

**Step 1: Update worker to call service**

Follow same pattern as Tasks 7-8.

**Step 2: Commit**

```bash
git add src/workers/ufms-worker.ts
git commit -m "refactor: update UFMS worker to use service layer"
```

---

## Task 10: Update LinkedIn Worker to Use Service

**Files:**
- Modify: `src/workers/linkedin-worker.ts`

**Step 1: Update worker to call service**

Follow same pattern as Tasks 7-9.

**Step 2: Commit**

```bash
git add src/workers/linkedin-worker.ts
git commit -m "refactor: update LinkedIn worker to use service layer"
```

---

## Task 11: Update Admin UI for Manual Execution

**Files:**
- Modify: `src/app/admin/workers/page.tsx`

**Step 1: Read current admin UI**

Read: `src/app/admin/workers/page.tsx`

**Step 2: Add runWorkerDirect function**

Add this function to the component:

```typescript
const runWorkerDirect = async (worker: string) => {
  try {
    const response = await fetch('/api/admin/workers/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker })
    })

    if (!response.ok) {
      throw new Error('Failed to run worker')
    }

    const data = await response.json()
    console.log('Worker execution result:', data)

    // Refresh logs
    refetch()
  } catch (error) {
    console.error('Error running worker:', error)
  }
}
```

**Step 3: Add "Run Direct" buttons**

Find the worker controls section and add a second button next to the "Trigger" button:

```tsx
<Button
  onClick={() => runWorkerDirect('sucupira')}
  variant="outline"
  size="sm"
>
  ▶️ Run Direct
</Button>
```

Repeat for all workers (bdtd, ufms, linkedin).

**Step 4: Commit**

```bash
git add src/app/admin/workers/page.tsx
git commit -m "feat: add Run Direct buttons to admin UI

Add manual execution buttons that call /api/admin/workers/run
directly without requiring npm run workers."
```

---

## Task 12: Test Manual Execution

**Step 1: Ensure database and Redis are running**

Run: `docker ps`
Expected: See postgres and redis containers running

If not running:
```bash
docker compose up -d
```

**Step 2: Start Next.js dev server**

Run: `npm run dev`
Expected: Server starts on port 3000

**Step 3: Test manual execution via API**

In a new terminal:

```bash
curl -X POST http://localhost:3000/api/admin/workers/run \
  -H "Content-Type: application/json" \
  -d '{"worker":"sucupira"}'
```

Expected: JSON response with `success: true` and result statistics

**Step 4: Verify logs appear**

Navigate to: `http://localhost:3000/admin/workers`

Expected: See log messages from the manual execution in the log box

**Step 5: Test via UI**

Click "Run Direct" button for Sucupira worker

Expected: See progress logs appearing in real-time

---

## Task 13: Verify Scheduled Workers Still Work

**Step 1: Start worker process**

In a new terminal:
```bash
npx tsx src/workers/index.ts
```

Expected: See "Worker system ready" message

**Step 2: Trigger scheduled worker via existing endpoint**

```bash
curl -X POST http://localhost:3000/api/admin/workers/trigger \
  -H "Content-Type: application/json" \
  -d '{"worker":"sucupira"}'
```

Expected: Job queued message

**Step 3: Verify worker processes the job**

Check worker terminal output
Expected: See job processing logs

**Step 4: Stop worker process**

Press Ctrl+C in worker terminal

**Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify manual and scheduled execution both work

Confirmed:
- Manual execution works without npm run workers
- Scheduled workers still process BullMQ jobs
- Logs appear in admin UI for both execution modes"
```

---

## Completion

After all tasks complete:

1. Run full lint check: `npm run lint`
2. Fix any new issues
3. Push branch: `git push origin feature/worker-manual-execution`
4. Use @superpowers:finishing-a-development-branch to merge back to main
