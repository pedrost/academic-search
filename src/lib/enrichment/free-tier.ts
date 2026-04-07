/**
 * FREE Tier Enrichment
 *
 * Pipeline:
 *   1. Lattes (Google → ID → CV fetch) — primary, free, no CAPTCHA
 *   2. LinkedIn Playwright (real session) — fallback for employment gaps
 *
 * Human-likeness strategy:
 *   - Real LinkedIn credentials stored in Redis (admin sets via /admin/linkedin)
 *   - 15–30s random delays between LinkedIn profile views
 *   - Max 50 LinkedIn profiles per session then 2h cool-down
 *   - Stop immediately on LinkedIn /checkpoint/ redirect
 *   - Session cookie refresh is admin's responsibility (LOGIN_EXPIRED task created)
 */

import { prisma } from '@/lib/db'
import { lookupLattes } from '@/lib/scrapers/lattes'
import {
  initLinkedInSession,
  checkLinkedInLoginStatus,
  searchLinkedIn,
  extractProfileDetails,
} from '@/lib/scrapers/linkedin'
import { createTask } from '@/lib/db/tasks'
import { randomDelay } from '@/lib/scrapers/browser'

export interface EnrichmentContext {
  name?: string          // use when academic not yet in DB
  state?: string | null
  city?: string | null
  institution?: string | null
}

export interface FreeTierResult {
  success: boolean
  enrichmentStatus: 'COMPLETE' | 'PARTIAL' | 'PENDING'
  sources: string[]      // which sources contributed data
  durationMs: number
  error?: string
}

// Track LinkedIn session usage to enforce the 50-profile cap
let linkedInProfilesThisSession = 0
let linkedInSessionPausedUntil: number | null = null

const LINKEDIN_SESSION_CAP = 50
const LINKEDIN_SESSION_COOLDOWN_MS = 2 * 60 * 60 * 1000 // 2 hours

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

  // ── Phase 1: CNPq Lattes ────────────────────────────────────────────
  let lattesData = null
  try {
    lattesData = await lookupLattes(name, { institution, state, city })
  } catch (err) {
    console.error(`[FREE] Lattes lookup failed for ${name}:`, err)
  }

  const lattesUpdate: Record<string, unknown> = {}
  if (lattesData) {
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

  // ── Phase 2: LinkedIn (only if employment still unknown) ─────────────
  if (needsEmployment) {
    const linkedInData = await enrichFromLinkedIn(academicId, name, { institution, state }, sources)
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

async function enrichFromLinkedIn(
  academicId: string,
  name: string,
  context: { institution?: string | null; state?: string | null },
  sources: string[]
): Promise<boolean> {
  // Enforce session cap
  if (linkedInSessionPausedUntil && Date.now() < linkedInSessionPausedUntil) {
    console.log(`[FREE] LinkedIn session on cool-down until ${new Date(linkedInSessionPausedUntil).toISOString()}`)
    return false
  }
  if (linkedInProfilesThisSession >= LINKEDIN_SESSION_CAP) {
    linkedInSessionPausedUntil = Date.now() + LINKEDIN_SESSION_COOLDOWN_MS
    linkedInProfilesThisSession = 0
    console.log('[FREE] LinkedIn session cap reached — cooling down 2h')
    return false
  }

  try {
    const { isNew } = await initLinkedInSession()
    if (isNew) await randomDelay(3000, 6000)

    const isLoggedIn = await checkLinkedInLoginStatus()
    if (!isLoggedIn) {
      // Create a task for the admin to refresh the session
      await createTask('LOGIN_EXPIRED', undefined, { source: 'linkedin', message: 'LinkedIn session expired during FREE tier enrichment' })
      console.warn('[FREE] LinkedIn session expired — LOGIN_EXPIRED task created')
      return false
    }

    // Human-like: wait before searching
    await randomDelay(15000, 30000)

    const query = `${name}${context.institution ? ` ${context.institution}` : ''}${context.state ? ` ${context.state}` : ''}`
    const profiles = await searchLinkedIn(query)

    if (profiles.length === 0) return false

    // Score candidates — require >70% name match to avoid false positives
    const best = profiles
      .map(p => ({ profile: p, score: nameSimilarity(name, p.name) }))
      .filter(({ score }) => score >= 0.7)
      .sort((a, b) => b.score - a.score)[0]

    if (!best) return false

    // Human-like: pause before opening profile
    await randomDelay(8000, 20000)

    linkedInProfilesThisSession++
    const details = await extractProfileDetails(best.profile.profileUrl)

    await prisma.academic.update({
      where: { id: academicId },
      data: {
        linkedinUrl: best.profile.profileUrl,
        currentJobTitle: details.currentTitle ?? undefined,
        currentCompany: details.currentCompany ?? undefined,
      },
    })

    return true
  } catch (err: any) {
    // If redirected to checkpoint, stop the session
    if (err.message?.includes('checkpoint') || err.message?.includes('authwall')) {
      linkedInSessionPausedUntil = Date.now() + LINKEDIN_SESSION_COOLDOWN_MS
      linkedInProfilesThisSession = 0
      await createTask('LOGIN_EXPIRED', undefined, { source: 'linkedin', message: `LinkedIn checkpoint hit: ${err.message}` })
      console.warn('[FREE] LinkedIn checkpoint detected — session paused')
    } else {
      console.error('[FREE] LinkedIn enrichment error:', err.message)
    }
    return false
  }
}

/** Reset the LinkedIn session counter (call after admin refreshes session) */
export function resetLinkedInSessionCounter(): void {
  linkedInProfilesThisSession = 0
  linkedInSessionPausedUntil = null
}
