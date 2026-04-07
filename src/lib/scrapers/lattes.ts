/**
 * CNPq Lattes Scraper
 *
 * CAPTCHA-avoidance strategy:
 *   1. Use Google (via stealth Playwright) to find the Lattes 16-digit ID
 *      from result URLs — never hits the CNPq search UI where CAPTCHAs appear.
 *   2. Fetch the CV directly at visualizacv.do?id={lattesId} — no CAPTCHA.
 *   3. Parse the "Atuação Profissional" section for current employer.
 *
 * Rate limiting: 8–15s random delay between academics is enough to stay
 * under Google's radar at this pace.
 */

import { Page } from 'playwright'
import { getBrowser, createStealthContext, randomDelay } from './browser'

const LATTES_CV_BASE = 'http://buscatextual.cnpq.br/buscatextual/visualizacv.do'
const LATTES_ID_PATTERN = /\d{16}/

export interface LattesEmployment {
  jobTitle: string | null
  company: string | null
  startYear: number | null
}

export interface LattesData {
  lattesId: string
  lattesUrl: string
  name: string | null
  currentEmployment: LattesEmployment | null
  allEmployment: LattesEmployment[]
  researchAreas: string[]
  highestDegree: string | null
  institution: string | null
}

let lattesPage: Page | null = null

async function getLattesPage(): Promise<Page> {
  if (lattesPage) {
    try {
      await lattesPage.title() // check still alive
      return lattesPage
    } catch {
      lattesPage = null
    }
  }
  const browser = await getBrowser()
  const context = await createStealthContext(browser)
  lattesPage = await context.newPage()
  return lattesPage
}

/**
 * Find the Lattes 16-digit ID for an academic via a Google search.
 * Returns null if not found.
 */
export async function findLattesId(
  name: string,
  context?: { institution?: string | null; state?: string | null; city?: string | null }
): Promise<string | null> {
  const page = await getLattesPage()

  // Build Google query — site:lattes.cnpq.br narrows to CV pages directly
  const institutionHint = context?.institution ? ` "${context.institution}"` : ''
  const stateHint = context?.state && !context?.institution ? ` "${context.state}"` : ''
  const query = `"${name}"${institutionHint}${stateHint} site:lattes.cnpq.br`

  try {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt-BR&num=5`
    await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await randomDelay(2000, 4000)

    // Extract all hrefs from Google results that contain lattes.cnpq.br
    const lattesUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'))
      return anchors
        .map(a => (a as HTMLAnchorElement).href)
        .filter(href => href.includes('lattes.cnpq.br') || href.includes('buscatextual.cnpq.br'))
    })

    for (const url of lattesUrls) {
      const match = url.match(LATTES_ID_PATTERN)
      if (match) return match[0]
    }

    // Fallback: try without site: restriction
    if (institutionHint || stateHint) {
      const fallbackQuery = `"${name}" lattes cnpq${stateHint}`
      const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(fallbackQuery)}&hl=pt-BR&num=5`
      await randomDelay(3000, 6000)
      await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await randomDelay(1500, 3000)

      const fallbackUrls = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'))
        return anchors
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => href.includes('lattes.cnpq.br') || href.includes('buscatextual.cnpq.br'))
      })

      for (const url of fallbackUrls) {
        const match = url.match(LATTES_ID_PATTERN)
        if (match) return match[0]
      }
    }

    return null
  } catch (error) {
    console.error('[Lattes] Google search failed:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Fetch and parse a Lattes CV given a 16-digit ID.
 * The visualizacv.do page loads without CAPTCHA.
 */
export async function fetchLattesCv(lattesId: string): Promise<LattesData | null> {
  const page = await getLattesPage()
  const cvUrl = `${LATTES_CV_BASE}?id=${lattesId}`

  try {
    await page.goto(cvUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await randomDelay(1000, 2000)

    // Check we actually got a CV page (not a redirect to login)
    const title = await page.title()
    if (title.toLowerCase().includes('login') || title.toLowerCase().includes('erro')) {
      console.warn(`[Lattes] CV page returned unexpected title: ${title}`)
      return null
    }

    const data = await page.evaluate((id: string) => {
      function textOf(el: Element | null): string {
        return el?.textContent?.trim() ?? ''
      }

      // ── Name ──────────────────────────────────────────────────────────
      const nameEl =
        document.querySelector('h2.nome') ??
        document.querySelector('.dadosNome h2') ??
        document.querySelector('#nome') ??
        document.querySelector('h1')
      const name = textOf(nameEl) || null

      // ── Current institution (from header area) ────────────────────────
      const institutionEl =
        document.querySelector('.instituicao') ??
        document.querySelector('[id*="instituicao"]') ??
        document.querySelector('.formacao-atual')
      const institution = textOf(institutionEl) || null

      // ── Professional activities ───────────────────────────────────────
      // Lattes uses section divs with ids/classes containing "atuacao" or "profissional"
      const employmentSections = Array.from(
        document.querySelectorAll(
          '[id*="atuacao"], [id*="profissional"], .atuacao-profissional, .item-informacao'
        )
      )

      const allEmployment: Array<{ jobTitle: string | null; company: string | null; startYear: number | null }> = []

      for (const section of employmentSections) {
        // Each sub-item within the section represents one position
        const items = section.querySelectorAll('.informacao-artigo, .layout-cell-pad-main, li')
        for (const item of items) {
          const text = textOf(item)
          if (!text || text.length < 5) continue

          // Extract year range like "2020 - Atual" or "2018 - 2022"
          const yearMatch = text.match(/(\d{4})\s*[-–]\s*(Atual|\d{4})/i)
          const startYear = yearMatch ? parseInt(yearMatch[1]) : null
          const isCurrent = yearMatch ? /atual/i.test(yearMatch[2]) : false

          // Extract company and title — typically "Title, Company" or separate lines
          const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean)
          const company = lines.find(l => l.length > 3 && !/\d{4}/.test(l) && l !== name) ?? null
          const jobTitle = lines.length > 1 ? lines[0] : null

          if (company || jobTitle) {
            allEmployment.push({ jobTitle, company, startYear })
            if (isCurrent && allEmployment.length === 1) {
              // mark as primary by leaving it first
            }
          }
        }
      }

      // ── Fallback: look for current employer in the summary area ───────
      if (allEmployment.length === 0) {
        const summaryEl = document.querySelector('.resumo-cv, #resumo, .texto-claro')
        const summaryText = textOf(summaryEl)
        if (summaryText) {
          // Look for patterns like "Professor na UFMS" or "Analista at Empresa"
          const jobMatch = summaryText.match(/(Professor[a]?|Pesquisador[a]?|Analista|Coordenador[a]?|Diretor[a]?)[^.]+/i)
          if (jobMatch) {
            allEmployment.push({ jobTitle: jobMatch[0].trim(), company: null, startYear: null })
          }
        }
      }

      // ── Research areas ────────────────────────────────────────────────
      const areaEls = Array.from(
        document.querySelectorAll('[id*="area"], .grande-area, .area-conhecimento, .area-atuacao')
      )
      const researchAreas = areaEls
        .map(el => textOf(el))
        .filter(t => t.length > 2 && t.length < 100)
        .slice(0, 5)

      // ── Highest degree ────────────────────────────────────────────────
      const degreeEls = Array.from(
        document.querySelectorAll('[id*="formacao"], [id*="titulacao"], .formacao-academica')
      )
      const degreeTexts = degreeEls.map(el => textOf(el)).join(' ')
      let highestDegree: string | null = null
      if (/p[oó]s.?doutorado/i.test(degreeTexts)) highestDegree = 'POSTDOC'
      else if (/doutorado|ph\.?d/i.test(degreeTexts)) highestDegree = 'PHD'
      else if (/mestrado|m\.sc/i.test(degreeTexts)) highestDegree = 'MASTERS'
      else if (/gradua/i.test(degreeTexts)) highestDegree = 'GRADUATION'

      return { name, institution, allEmployment, researchAreas, highestDegree }
    }, lattesId)

    const currentEmployment = data.allEmployment[0] ?? null

    return {
      lattesId,
      lattesUrl: cvUrl,
      name: data.name,
      currentEmployment,
      allEmployment: data.allEmployment,
      researchAreas: data.researchAreas,
      highestDegree: data.highestDegree,
      institution: data.institution,
    }
  } catch (error) {
    console.error('[Lattes] Failed to fetch CV:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Full lookup: find ID via Google, then fetch CV.
 * Returns null if academic cannot be found on Lattes.
 */
export async function lookupLattes(
  name: string,
  context?: { institution?: string | null; state?: string | null; city?: string | null }
): Promise<LattesData | null> {
  const lattesId = await findLattesId(name, context)
  if (!lattesId) return null

  await randomDelay(8000, 15000) // human-like pause before fetching CV
  return fetchLattesCv(lattesId)
}

/** Release the shared Lattes page */
export async function closeLattesPage(): Promise<void> {
  if (lattesPage) {
    try { await lattesPage.close() } catch { /* ignore */ }
    lattesPage = null
  }
}
