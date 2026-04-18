import { Page, BrowserContext } from 'playwright'
import { getBrowser, createStealthContext, randomDelay } from './browser'
import { prisma } from '@/lib/db'
import { createTask } from '@/lib/db/tasks'
import { hasSavedCookies, loadCookies, saveCookies } from './linkedin-auth'
import { Sector } from '@prisma/client'

const LINKEDIN_BASE = 'https://www.linkedin.com'

export type LinkedInProfile = {
  name: string
  headline?: string
  location?: string
  currentTitle?: string
  currentCompany?: string
  profileUrl: string
}

let linkedInContext: BrowserContext | null = null
let linkedInPage: Page | null = null

/**
 * Initialize a LinkedIn browser session using saved cookies.
 * Returns { page, isNew } if session is ready.
 * Returns { isLoggedIn: false } if no saved cookies exist — caller should skip LinkedIn.
 */
export async function initLinkedInSession(): Promise<{ page: Page; isNew: boolean } | { isLoggedIn: false }> {
  if (linkedInContext) {
    return { page: linkedInPage!, isNew: false }
  }

  // Never open a browser if there are no saved cookies
  if (!hasSavedCookies()) {
    return { isLoggedIn: false }
  }

  const browser = await getBrowser()
  linkedInContext = await createStealthContext(browser)

  // Load saved cookies before any navigation
  const cookies = loadCookies()
  await linkedInContext.addCookies(cookies)

  linkedInPage = await linkedInContext.newPage()
  await linkedInPage.goto(LINKEDIN_BASE, { waitUntil: 'networkidle' })

  return { page: linkedInPage, isNew: true }
}

/**
 * Open a browser for manual admin login (no cookies required).
 * Once the admin logs in, call checkLinkedInLoginStatus() to persist cookies.
 * Only call from /admin/browser — not from automated enrichment.
 */
export async function openLoginBrowser(): Promise<void> {
  if (linkedInContext) return  // already open

  const browser = await getBrowser()
  linkedInContext = await createStealthContext(browser)
  linkedInPage = await linkedInContext.newPage()
  await linkedInPage.goto(`${LINKEDIN_BASE}/login`, { waitUntil: 'networkidle' })
}

/**
 * Check login status by navigating to /feed and seeing where LinkedIn lands us.
 * Much more reliable than DOM selector checks (LinkedIn's HTML changes constantly).
 */
export async function checkLinkedInLoginStatus(): Promise<boolean> {
  if (!linkedInPage || !linkedInContext) return false

  try {
    await linkedInPage.goto(`${LINKEDIN_BASE}/feed/`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    const url = linkedInPage.url()

    const isLoggedIn = url.includes('/feed') && !url.includes('/login') && !url.includes('/authwall') && !url.includes('/checkpoint')

    if (isLoggedIn) {
      const cookies = await linkedInContext.cookies()
      saveCookies(cookies as any)
    }

    return isLoggedIn
  } catch {
    return false
  }
}

export async function searchLinkedIn(
  query: string
): Promise<LinkedInProfile[]> {
  if (!linkedInPage) {
    throw new Error('LinkedIn session not initialized')
  }

  const searchUrl = `${LINKEDIN_BASE}/search/results/people/?keywords=${encodeURIComponent(query)}`
  await linkedInPage.goto(searchUrl, { waitUntil: 'networkidle' })
  await randomDelay(2000, 4000)

  const profiles = await linkedInPage.evaluate(() => {
    const results: LinkedInProfile[] = []
    const cards = document.querySelectorAll('.reusable-search__result-container')

    cards.forEach((card) => {
      const nameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]')
      const headlineEl = card.querySelector('.entity-result__primary-subtitle')
      const locationEl = card.querySelector('.entity-result__secondary-subtitle')
      const linkEl = card.querySelector('.entity-result__title-text a') as HTMLAnchorElement

      if (nameEl && linkEl) {
        results.push({
          name: nameEl.textContent?.trim() || '',
          headline: headlineEl?.textContent?.trim(),
          location: locationEl?.textContent?.trim(),
          profileUrl: linkEl.href.split('?')[0],
        })
      }
    })

    return results
  })

  return profiles
}

export async function extractProfileDetails(
  profileUrl: string
): Promise<Partial<LinkedInProfile>> {
  if (!linkedInPage) {
    throw new Error('LinkedIn session not initialized')
  }

  await linkedInPage.goto(profileUrl, { waitUntil: 'networkidle' })
  await randomDelay(2000, 4000)

  const details = await linkedInPage.evaluate(() => {
    const headline = document.querySelector('.text-body-medium')?.textContent?.trim()
    const location = document.querySelector('.text-body-small.inline')?.textContent?.trim()

    const experienceSection = document.querySelector('#experience')
    let currentTitle: string | undefined
    let currentCompany: string | undefined

    if (experienceSection) {
      const firstExperience = experienceSection.parentElement?.querySelector('li')
      if (firstExperience) {
        currentTitle = firstExperience.querySelector('.t-bold span[aria-hidden="true"]')?.textContent?.trim()
        currentCompany = firstExperience.querySelector('.t-normal span[aria-hidden="true"]')?.textContent?.trim()
      }
    }

    return { headline, location, currentTitle, currentCompany }
  })

  return details
}

export async function enrichAcademicFromLinkedIn(
  academicId: string,
  profile: LinkedInProfile & Partial<{ currentTitle: string; currentCompany: string }>
) {
  const sector = guessSector(profile.currentTitle, profile.currentCompany)

  await prisma.academic.update({
    where: { id: academicId },
    data: {
      linkedinUrl: profile.profileUrl,
      currentJobTitle: profile.currentTitle,
      currentCompany: profile.currentCompany,
      currentSector: sector,
      enrichmentStatus: 'PARTIAL',
      lastEnrichedAt: new Date(),
    },
  })
}

function guessSector(title?: string, company?: string): Sector {
  const text = `${title || ''} ${company || ''}`.toLowerCase()

  if (text.includes('professor') || text.includes('universidade') || text.includes('pesquisador')) {
    return Sector.ACADEMIA
  }
  if (text.includes('secretaria') || text.includes('ministério') || text.includes('governo') || text.includes('prefeitura')) {
    return Sector.GOVERNMENT
  }
  if (text.includes('ong') || text.includes('instituto') || text.includes('fundação')) {
    return Sector.NGO
  }
  if (company) {
    return Sector.PRIVATE
  }

  return Sector.UNKNOWN
}

export async function createLinkedInMatchTask(
  academicId: string,
  candidates: LinkedInProfile[]
) {
  return createTask('LINKEDIN_MATCH', academicId, {
    candidates,
    searchQuery: '',
  })
}

export async function closeLinkedInSession() {
  if (linkedInContext) {
    await linkedInContext.close()
    linkedInContext = null
    linkedInPage = null
  }
}
