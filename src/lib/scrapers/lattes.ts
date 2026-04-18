/**
 * CNPq Lattes Scraper
 *
 * CAPTCHA-avoidance strategy:
 *   1. ID search: Scrapling Python sidecar (scripts/scrapling-lattes-search.py)
 *      Uses curl_cffi TLS fingerprint impersonation — requests look like real
 *      Chrome at the TLS/JA3 level. Searches DDG/Bing/Brave/Startpage.
 *      No browser needed; fast and durable against bot detection.
 *   2. CV fetch: SKIPPED by default (CNPq always shows reCAPTCHA).
 *      Only attempted if a CNPq session exists (admin solved CAPTCHA via
 *      /admin/browser, cookies saved to data/cnpq-cookies.json).
 *      The Lattes ID + URL are always saved even without CV data.
 *
 * Rate limiting: 8–15s random delay between academics.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { Page, BrowserContext } from 'playwright'
import { getBrowser, createStealthContext, randomDelay } from './browser'

const execFileAsync = promisify(execFile)
const SCRAPLING_SCRIPT = path.join(process.cwd(), 'scripts', 'scrapling-lattes-search.py')

const LATTES_CV_BASE = 'http://buscatextual.cnpq.br/buscatextual/visualizacv.do'
const LATTES_ID_PATTERN = /\d{16}/
const CNPQ_COOKIES_PATH = path.join(process.cwd(), 'data', 'cnpq-cookies.json')

// ── CNPq session persistence ───────────────────────────────────────────────
export function hasCnpqSession(): boolean {
  try {
    return fs.existsSync(CNPQ_COOKIES_PATH) && fs.statSync(CNPQ_COOKIES_PATH).size > 10
  } catch { return false }
}

export function loadCnpqCookies(): any[] {
  try { return JSON.parse(fs.readFileSync(CNPQ_COOKIES_PATH, 'utf-8')) }
  catch { return [] }
}

export function saveCnpqCookies(cookies: any[]): void {
  fs.mkdirSync(path.dirname(CNPQ_COOKIES_PATH), { recursive: true })
  fs.writeFileSync(CNPQ_COOKIES_PATH, JSON.stringify(cookies, null, 2))
}

export function clearCnpqSession(): void {
  try { fs.unlinkSync(CNPQ_COOKIES_PATH) } catch { /* already gone */ }
}

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
let lattesContext: BrowserContext | null = null

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
  lattesContext = await createStealthContext(browser)

  // Restore saved CNPq cookies if available
  if (hasCnpqSession()) {
    const cookies = loadCnpqCookies()
    if (cookies.length > 0) {
      await lattesContext.addCookies(cookies)
    }
  }

  lattesPage = await lattesContext.newPage()
  return lattesPage
}

/**
 * Find the Lattes 16-digit ID via the Scrapling Python sidecar.
 * The sidecar uses TLS fingerprint impersonation so DuckDuckGo/Bing cannot
 * distinguish the request from a real Chrome browser.
 */
async function findLattesIdViaSidecar(
  name: string,
  context?: { institution?: string | null; state?: string | null },
  onLog?: (msg: string) => void
): Promise<string | null> {
  const args: string[] = [SCRAPLING_SCRIPT, name]
  if (context?.institution) args.push('--institution', context.institution)
  else if (context?.state) args.push('--state', context.state)

  onLog?.(`[Scrapling] Buscando "${name}" via DuckDuckGo/Bing com TLS impersonation...`)

  try {
    const { stdout } = await execFileAsync('python', args, { timeout: 60_000 })
    const result = JSON.parse(stdout.trim())
    if (result.lattesId) {
      onLog?.(`[Scrapling] ID encontrado: ${result.lattesId} (fonte: ${result.source})`)
    } else {
      onLog?.(`[Scrapling] Não encontrado${result.error ? ` — ${result.error}` : ''}`)
    }
    return result.lattesId ?? null
  } catch (err) {
    onLog?.(`[Scrapling] Erro ao executar sidecar: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/**
 * Find the Lattes 16-digit ID for an academic.
 *
 * Strategy:
 *   1. Scrapling Python sidecar — TLS fingerprint impersonation, no browser
 *   2. Google via stealth Playwright (fallback for difficult names or if sidecar unavailable)
 *
 * Returns null if not found.
 */
export async function findLattesId(
  name: string,
  context?: { institution?: string | null; state?: string | null; city?: string | null },
  onLog?: (msg: string) => void
): Promise<string | null> {
  // 1. Try Scrapling sidecar — TLS-impersonated, no browser needed
  const sidecarId = await findLattesIdViaSidecar(name, context, onLog)
  if (sidecarId) {
    return sidecarId
  }

  onLog?.(`[Lattes] Scrapling não encontrou — fallback para Google via Playwright`)

  // 2. Fallback: Google via Playwright (original approach)
  const page = await getLattesPage()

  const institutionHint = context?.institution ? ` "${context.institution}"` : ''
  const stateHint = context?.state && !context?.institution ? ` "${context.state}"` : ''
  const query = `"${name}"${institutionHint}${stateHint} site:lattes.cnpq.br`

  try {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt-BR&num=5`
    await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await randomDelay(2000, 4000)

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
    console.error('[Lattes] Google fallback also failed:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Fetch and parse a Lattes CV given a 16-digit ID.
 *
 * CNPq always presents a reCAPTCHA before showing the CV.
 * This only works if a CNPq session exists (admin solved CAPTCHA once
 * via /admin/browser → cookies saved). Returns null on CAPTCHA.
 */
export async function fetchLattesCv(lattesId: string, onLog?: (msg: string) => void): Promise<LattesData | null> {
  // Skip CV fetch entirely if no CNPq session — saves 30s timeout
  if (!hasCnpqSession()) {
    onLog?.(`[Lattes] CV ignorado — sem sessão CNPq (resolva CAPTCHA em /admin/browser)`)
    return null
  }

  const page = await getLattesPage()
  const cvUrl = `${LATTES_CV_BASE}?id=${lattesId}`

  onLog?.(`[Lattes] Abrindo CV: ${cvUrl}`)

  try {
    await page.goto(cvUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await randomDelay(1000, 2000)

    // Detect CAPTCHA page
    const hasCaptcha = await page.evaluate(() => {
      return !!document.querySelector('.captcha, .divCaptcha, #divCaptcha, [id*="captcha"]')
    })

    if (hasCaptcha) {
      onLog?.(`[Lattes] CAPTCHA detectado — sessão expirada. Resolva novamente em /admin/browser`)
      clearCnpqSession()
      return null
    }

    // Check we actually got a CV page (not a redirect to login)
    const title = await page.title()
    if (title.toLowerCase().includes('login') || title.toLowerCase().includes('erro')) {
      onLog?.(`[Lattes] Página inesperada: "${title}" — possível erro`)
      return null
    }
    onLog?.(`[Lattes] CV carregado com sucesso`)

    // Save cookies — session is valid
    if (lattesContext) {
      const cookies = await lattesContext.cookies()
      saveCnpqCookies(cookies)
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
 * Full lookup: find Lattes ID, then optionally fetch CV.
 *
 * The CV fetch is only attempted when a valid CNPq session exists
 * (admin solved CAPTCHA once via /admin/browser). Without a session,
 * returns minimal data with just the ID and URL — still valuable for
 * linking and for the user to open manually.
 */
export async function lookupLattes(
  name: string,
  context?: { institution?: string | null; state?: string | null; city?: string | null },
  onLog?: (msg: string) => void
): Promise<LattesData | null> {
  const lattesId = await findLattesId(name, context, onLog)
  if (!lattesId) {
    onLog?.(`[Lattes] ID não encontrado para "${name}"`)
    return null
  }

  // Only attempt CV fetch if we have a CNPq session (avoids 30s CAPTCHA timeout)
  if (hasCnpqSession()) {
    onLog?.(`[Lattes] Sessão CNPq encontrada — tentando buscar CV...`)
    await randomDelay(3000, 6000)
    const cv = await fetchLattesCv(lattesId, onLog)
    if (cv) return cv
  } else {
    onLog?.(`[Lattes] Sem sessão CNPq — CV ignorado (resolva CAPTCHA em /admin/browser para dados completos)`)
  }

  // Return minimal data with ID + URL
  return {
    lattesId,
    lattesUrl: `http://lattes.cnpq.br/${lattesId}`,
    name: null,
    currentEmployment: null,
    allEmployment: [],
    researchAreas: [],
    highestDegree: null,
    institution: null,
  }
}

/** Release the shared Lattes page */
export async function closeLattesPage(): Promise<void> {
  if (lattesPage) {
    try { await lattesPage.close() } catch { /* ignore */ }
    lattesPage = null
  }
}
