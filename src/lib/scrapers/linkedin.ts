import { Page, BrowserContext } from 'playwright'
import { getBrowser, createStealthContext, randomDelay } from './browser'
import { prisma } from '@/lib/db'
import { createTask } from '@/lib/db/tasks'
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

export async function initLinkedInSession() {
  if (linkedInContext) {
    return { page: linkedInPage!, isNew: false }
  }

  const browser = await getBrowser()
  linkedInContext = await createStealthContext(browser)
  linkedInPage = await linkedInContext.newPage()

  await linkedInPage.goto(LINKEDIN_BASE, { waitUntil: 'networkidle' })

  return { page: linkedInPage, isNew: true }
}

export async function checkLinkedInLoginStatus(): Promise<boolean> {
  if (!linkedInPage) return false

  try {
    const isLoggedIn = await linkedInPage.evaluate(() => {
      return !document.querySelector('a[data-tracking-control-name="guest_homepage-basic_sign-in-button"]')
    })
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
