import { Page } from 'playwright'
import { getBrowser, createStealthContext, randomDelay, humanScroll } from './browser'
import { prisma } from '@/lib/db'
import { createScraperSession, updateScraperSession } from '@/lib/db/scrapers'
import { DegreeLevel } from '@prisma/client'

const SUCUPIRA_BASE_URL = 'https://sucupira-v2.capes.gov.br/observatorio/teses-e-dissertacoes'

type DissertationData = {
  authorName: string
  title: string
  abstract?: string
  keywords: string[]
  defenseYear: number
  institution: string
  program?: string
  advisorName?: string
  degreeLevel: DegreeLevel
  sourceUrl: string
}

export async function scrapeSucupira(
  institution: string,
  onProgress?: (message: string) => void
) {
  const session = await createScraperSession('SUCUPIRA')
  const log = (msg: string) => {
    console.log(`[Sucupira] ${msg}`)
    onProgress?.(msg)
  }

  const browser = await getBrowser()
  const context = await createStealthContext(browser)
  const page = await context.newPage()

  let profilesScraped = 0
  let errors = 0

  try {
    log(`Starting scrape for institution: ${institution}`)

    const searchUrl = `${SUCUPIRA_BASE_URL}?search=${encodeURIComponent(institution)}`
    await page.goto(searchUrl, { waitUntil: 'networkidle' })
    await randomDelay(2000, 4000)

    log('Page loaded, extracting data...')

    const dissertations = await extractDissertations(page)
    log(`Found ${dissertations.length} dissertations`)

    for (const diss of dissertations) {
      try {
        await saveDissertation(diss)
        profilesScraped++

        if (profilesScraped % 10 === 0) {
          await updateScraperSession(session.id, {
            profilesScraped,
            errors,
          })
          log(`Progress: ${profilesScraped} saved`)
        }

        await randomDelay(500, 1500)
      } catch (err) {
        errors++
        log(`Error saving dissertation: ${err}`)
      }
    }

    await updateScraperSession(session.id, {
      status: 'COMPLETED',
      profilesScraped,
      errors,
    })

    log(`Completed! ${profilesScraped} profiles, ${errors} errors`)
  } catch (err) {
    await updateScraperSession(session.id, {
      status: 'FAILED',
      profilesScraped,
      errors: errors + 1,
    })
    log(`Failed: ${err}`)
    throw err
  } finally {
    await context.close()
  }

  return { profilesScraped, errors, sessionId: session.id }
}

async function extractDissertations(page: Page): Promise<DissertationData[]> {
  // This is a placeholder - actual implementation depends on Sucupira's HTML structure
  // You'll need to inspect the page and adjust selectors

  const dissertations: DissertationData[] = []

  const items = await page.$$('article, .result-item, [data-testid="result"]')

  for (const item of items) {
    try {
      const title = await item.$eval(
        'h2, h3, .title, [data-testid="title"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => '')

      if (!title) continue

      const authorName = await item.$eval(
        '.author, [data-testid="author"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => 'Unknown Author')

      const yearText = await item.$eval(
        '.year, [data-testid="year"], time',
        (el) => el.textContent?.trim() || ''
      ).catch(() => '')
      const defenseYear = parseInt(yearText) || new Date().getFullYear()

      const institution = await item.$eval(
        '.institution, [data-testid="institution"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => 'UFMS')

      const program = await item.$eval(
        '.program, [data-testid="program"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => undefined)

      const advisorName = await item.$eval(
        '.advisor, [data-testid="advisor"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => undefined)

      const degreeText = await item.$eval(
        '.degree, [data-testid="degree"]',
        (el) => el.textContent?.toLowerCase() || ''
      ).catch(() => '')

      const degreeLevel = degreeText.includes('doutorado')
        ? DegreeLevel.PHD
        : DegreeLevel.MASTERS

      const sourceUrl = await item.$eval(
        'a[href]',
        (el) => el.getAttribute('href') || ''
      ).catch(() => '')

      const keywords = await item.$$eval(
        '.keyword, [data-testid="keyword"]',
        (els) => els.map((el) => el.textContent?.trim() || '').filter(Boolean)
      ).catch(() => [])

      dissertations.push({
        authorName,
        title,
        keywords,
        defenseYear,
        institution,
        program,
        advisorName,
        degreeLevel,
        sourceUrl: sourceUrl.startsWith('http')
          ? sourceUrl
          : `${SUCUPIRA_BASE_URL}${sourceUrl}`,
      })
    } catch (err) {
      console.error('Error extracting item:', err)
    }
  }

  return dissertations
}

async function saveDissertation(data: DissertationData) {
  // Find or create academic
  let academic = await prisma.academic.findFirst({
    where: {
      name: { equals: data.authorName, mode: 'insensitive' },
    },
  })

  if (!academic) {
    academic = await prisma.academic.create({
      data: {
        name: data.authorName,
        institution: data.institution,
        degreeLevel: data.degreeLevel,
        graduationYear: data.defenseYear,
        currentState: 'MS',
      },
    })
  }

  // Check if dissertation already exists
  const existingDiss = await prisma.dissertation.findFirst({
    where: {
      academicId: academic.id,
      title: { equals: data.title, mode: 'insensitive' },
    },
  })

  if (!existingDiss) {
    await prisma.dissertation.create({
      data: {
        academicId: academic.id,
        title: data.title,
        abstract: data.abstract,
        keywords: data.keywords,
        defenseYear: data.defenseYear,
        institution: data.institution,
        program: data.program,
        advisorName: data.advisorName,
        sourceUrl: data.sourceUrl,
      },
    })
  }
}
