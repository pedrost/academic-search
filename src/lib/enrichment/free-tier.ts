/**
 * FREE Tier Enrichment
 *
 * Pipeline:
 *   1. Lattes (Google → ID → CV fetch) — primary, free, no CAPTCHA
 *   2. LinkedIn Voyager API — fallback for employment gaps (no browser needed,
 *      uses saved session cookies from admin login at /admin/browser)
 */

import { prisma } from '@/lib/db'
import { lookupLattes } from '@/lib/scrapers/lattes'
import { hasSavedCookies } from '@/lib/scrapers/linkedin-auth'
import { voyagerSearchPeople, voyagerGetProfileDetails } from '@/lib/scrapers/linkedin-voyager'
import { createTask } from '@/lib/db/tasks'

export interface EnrichmentContext {
  name?: string
  state?: string | null
  city?: string | null
  institution?: string | null
  onLog?: (msg: string) => void
  sources?: string[]  // which sources to use; defaults to ['lattes', 'linkedin']
}

export interface FreeTierResult {
  success: boolean
  enrichmentStatus: 'COMPLETE' | 'PARTIAL' | 'PENDING'
  sources: string[]      // which sources contributed data
  durationMs: number
  error?: string
}



function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  // Check if all words of the shorter name appear in the longer
  const wordsA = na.split(/\s+/)
  const wordsB = nb.split(/\s+/)
  const shorter = wordsA.length < wordsB.length ? wordsA : wordsB
  const longer = wordsA.length < wordsB.length ? wordsB : wordsA
  const matches = shorter.filter(w => longer.includes(w)).length
  return matches / shorter.length
}

export async function freeTierEnrich(
  academicId: string,
  ctx: EnrichmentContext = {}
): Promise<FreeTierResult> {
  const start = Date.now()
  const sources: string[] = []

  const academic = await prisma.academic.findUnique({ where: { id: academicId } })
  if (!academic) {
    return { success: false, enrichmentStatus: 'PENDING', sources: [], durationMs: 0, error: 'Academic not found' }
  }

  const name = ctx.name ?? academic.name
  const institution = ctx.institution ?? academic.institution
  const state = ctx.state ?? academic.currentState
  const city = ctx.city ?? academic.currentCity
  const { onLog } = ctx
  const enabledSources = ctx.sources ?? ['lattes', 'linkedin']
  const useLattes = enabledSources.includes('lattes')
  const useLinkedIn = enabledSources.includes('linkedin')

  // ── Phase 1: CNPq Lattes ────────────────────────────────────────────
  let lattesData = null
  if (useLattes) {
    try {
      onLog?.(`[FREE] Iniciando busca Lattes para "${name}"`)
      lattesData = await lookupLattes(name, { institution, state, city }, onLog)
    } catch (err) {
      onLog?.(`[FREE] Erro na busca Lattes: ${err instanceof Error ? err.message : String(err)}`)
      console.error(`[FREE] Lattes lookup failed for ${name}:`, err)
    }
  } else {
    onLog?.(`[FREE] Lattes desativado`)
  }

  const lattesUpdate: Record<string, unknown> = {}
  if (lattesData) {
    onLog?.(`[FREE] Lattes encontrado — nome: ${lattesData.name}, grau: ${lattesData.highestDegree ?? '?'}, emprego: ${lattesData.currentEmployment?.company ?? 'não informado'}`)
    sources.push('lattes')
    lattesUpdate.lattesId = lattesData.lattesId
    lattesUpdate.lattesUrl = lattesData.lattesUrl

    if (lattesData.currentEmployment?.company && !academic.currentCompany) {
      lattesUpdate.currentCompany = lattesData.currentEmployment.company
    }
    if (lattesData.currentEmployment?.jobTitle && !academic.currentJobTitle) {
      lattesUpdate.currentJobTitle = lattesData.currentEmployment.jobTitle
    }
    if (lattesData.researchAreas.length > 0 && !academic.researchField) {
      lattesUpdate.researchField = lattesData.researchAreas[0]
    }
    if (lattesData.highestDegree && !academic.degreeLevel) {
      lattesUpdate.degreeLevel = lattesData.highestDegree as any
    }
    if (lattesData.institution && !academic.institution) {
      lattesUpdate.institution = lattesData.institution
    }

    if (Object.keys(lattesUpdate).length > 0) {
      await prisma.academic.update({ where: { id: academicId }, data: lattesUpdate })
    }
  }

  // Refresh academic state after Lattes update
  const afterLattes = await prisma.academic.findUnique({ where: { id: academicId } })
  const needsEmployment = !afterLattes?.currentCompany && !afterLattes?.currentJobTitle

  // ── Phase 2: LinkedIn Voyager ──────────────────────────────────────
  if (!useLinkedIn) {
    onLog?.(`[FREE] LinkedIn desativado`)
  } else if (!needsEmployment) {
    onLog?.(`[FREE] Emprego já preenchido — LinkedIn ignorado`)
  } else if (!hasSavedCookies()) {
    onLog?.(`[FREE] LinkedIn ignorado — nenhuma sessão salva (faça login via /admin/browser)`)
  } else {
    onLog?.(`[FREE] Buscando LinkedIn via Voyager API...`)
    const linkedInData = await enrichFromLinkedIn(academicId, name, { institution, state }, sources, onLog)
    if (linkedInData) sources.push('linkedin')
  }

  // ── Phase 3: Determine enrichment status ────────────────────────────
  const finalAcademic = await prisma.academic.findUnique({ where: { id: academicId } })
  const hasEmployment = !!(finalAcademic?.currentCompany || finalAcademic?.currentJobTitle)
  const hasSocial = !!(finalAcademic?.linkedinUrl || finalAcademic?.lattesUrl)
  const enrichmentStatus = hasEmployment || hasSocial ? 'COMPLETE' : sources.length > 0 ? 'PARTIAL' : 'PENDING'

  await prisma.academic.update({
    where: { id: academicId },
    data: {
      enrichmentStatus,
      enrichmentTier: 'FREE',
      lastEnrichedAt: new Date(),
    },
  })

  return {
    success: enrichmentStatus !== 'PENDING',
    enrichmentStatus,
    sources,
    durationMs: Date.now() - start,
  }
}

/**
 * Shorten verbose institution names for LinkedIn search queries.
 * LinkedIn search works best with short keywords; full legal names
 * like "FUNDAÇÃO UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL" return 0 results.
 */
const INSTITUTION_ABBREVIATIONS: Record<string, string> = {
  'FUNDAÇÃO UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL': 'UFMS',
  'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL': 'UFMS',
  'UNIVERSIDADE CATÓLICA DOM BOSCO': 'UCDB',
  'UNIVERSIDADE ESTADUAL DE MATO GROSSO DO SUL': 'UEMS',
  'INSTITUTO FEDERAL DE MATO GROSSO DO SUL': 'IFMS',
  'UNIVERSIDADE FEDERAL DA GRANDE DOURADOS': 'UFGD',
  'UNIVERSIDADE ANHANGUERA-UNIDERP': 'UNIDERP',
}

function shortenInstitution(institution: string): string {
  const upper = institution.toUpperCase().trim()
  for (const [full, abbr] of Object.entries(INSTITUTION_ABBREVIATIONS)) {
    if (upper.includes(full)) return abbr
  }
  // If still too long (>30 chars), take first 3 words
  if (institution.length > 30) {
    return institution.split(/\s+/).slice(0, 3).join(' ')
  }
  return institution
}

async function enrichFromLinkedIn(
  academicId: string,
  name: string,
  context: { institution?: string | null; state?: string | null },
  sources: string[],
  onLog?: (msg: string) => void
): Promise<boolean> {
  try {
    const rawInst = context.institution && context.institution !== 'UNKNOWN' ? context.institution : ''
    const inst = rawInst ? shortenInstitution(rawInst) : ''
    const rawState = context.state && context.state !== 'UNKNOWN' ? context.state : ''
    const query = `${name}${inst ? ` ${inst}` : ''}${rawState ? ` ${rawState}` : ''}`
    onLog?.(`[LinkedIn] Buscando via Voyager API: "${query}"`)

    const profiles = await voyagerSearchPeople(query)
    onLog?.(`[LinkedIn] ${profiles.length} perfis encontrados`)

    if (profiles.length === 0) {
      onLog?.(`[LinkedIn] Nenhum perfil encontrado`)
      return false
    }

    const scored = profiles.map(p => ({ profile: p, score: nameSimilarity(name, p.name) }))
    const best = scored.filter(({ score }) => score >= 0.7).sort((a, b) => b.score - a.score)[0]

    if (!best) {
      onLog?.(`[LinkedIn] ${profiles.length} resultados mas nenhum com similaridade ≥70% para "${name}"`)
      return false
    }

    onLog?.(`[LinkedIn] Match: "${best.profile.name}" (${Math.round(best.score * 100)}%) — ${best.profile.profileUrl}`)
    onLog?.(`[LinkedIn] Buscando detalhes do perfil...`)

    const details = await voyagerGetProfileDetails(best.profile.profileUrl)

    await prisma.academic.update({
      where: { id: academicId },
      data: {
        linkedinUrl: best.profile.profileUrl,
        currentJobTitle: details.currentTitle ?? undefined,
        currentCompany: details.currentCompany ?? undefined,
      },
    })

    onLog?.(`[LinkedIn] Salvo — ${details.currentTitle ?? '?'} @ ${details.currentCompany ?? '?'}`)
    return true
  } catch (err: any) {
    if (err.message === 'linkedin_auth_expired') {
      await createTask('LOGIN_EXPIRED', undefined, { source: 'linkedin', message: 'LinkedIn session expired — re-login at /admin/browser' })
      onLog?.(`[LinkedIn] Sessão expirada — faça login novamente em /admin/browser`)
    } else {
      onLog?.(`[LinkedIn] Erro: ${err.message}`)
    }
    return false
  }
}
