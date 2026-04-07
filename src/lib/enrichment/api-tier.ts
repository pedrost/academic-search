/**
 * API Tier Enrichment
 *
 * Reliable paid-API pipeline — no browser, no CAPTCHA.
 *
 * Pipeline:
 *   1. SerpAPI  — web search to find LinkedIn URL (~$0.005/query)
 *   2. Proxycurl — fetch full LinkedIn profile (~$0.01/profile)
 *   3. Gemini 2.0 Flash — disambiguation only when name is ambiguous (<$0.001/academic)
 *
 * Required env vars:
 *   SERPAPI_KEY    — https://serpapi.com
 *   PROXYCURL_KEY  — https://proxycurl.com
 *   GEMINI_API_KEY — https://ai.google.dev
 */

import { prisma } from '@/lib/db'
import type { EnrichmentContext, FreeTierResult } from './free-tier'

const SERPAPI_BASE = 'https://serpapi.com/search'
const PROXYCURL_BASE = 'https://nubela.co/proxycurl/api/v2'

interface SerpApiOrganicResult {
  link?: string
  title?: string
  snippet?: string
}

interface ProxycurlProfile {
  full_name: string | null
  headline: string | null
  occupation: string | null
  city: string | null
  state: string | null
  country: string | null
  experiences?: Array<{
    title: string | null
    company: string | null
    starts_at?: { year: number } | null
    ends_at?: { year: number } | null
  }>
}

async function serpApiSearch(query: string): Promise<SerpApiOrganicResult[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) throw new Error('SERPAPI_KEY not set')

  const url = new URL(SERPAPI_BASE)
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('hl', 'pt')
  url.searchParams.set('num', '5')
  url.searchParams.set('api_key', key)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`SerpAPI error ${res.status}`)
  const data = await res.json()
  return data.organic_results ?? []
}

async function proxycurlFetch(linkedinUrl: string): Promise<ProxycurlProfile | null> {
  const key = process.env.PROXYCURL_KEY
  if (!key) throw new Error('PROXYCURL_KEY not set')

  const url = new URL(`${PROXYCURL_BASE}/linkedin`)
  url.searchParams.set('linkedin_profile_url', linkedinUrl)
  url.searchParams.set('use_cache', 'if-present')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20000),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Proxycurl error ${res.status}`)
  return res.json()
}

function extractLinkedInUrl(results: SerpApiOrganicResult[]): string | null {
  for (const r of results) {
    if (r.link?.includes('linkedin.com/in/')) return r.link.split('?')[0]
  }
  return null
}

export async function apiTierEnrich(
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

  // ── Step 1: Find LinkedIn URL via SerpAPI ────────────────────────────
  let linkedinUrl: string | null = academic.linkedinUrl

  if (!linkedinUrl) {
    try {
      const query = `"${name}"${institution ? ` "${institution}"` : ''}${state ? ` "${state}"` : ''} site:linkedin.com/in`
      const results = await serpApiSearch(query)
      linkedinUrl = extractLinkedInUrl(results)
      if (linkedinUrl) sources.push('serpapi')
    } catch (err) {
      console.error('[API] SerpAPI search failed:', err instanceof Error ? err.message : err)
    }
  }

  // ── Step 2: Fetch LinkedIn profile via Proxycurl ─────────────────────
  if (linkedinUrl) {
    try {
      const profile = await proxycurlFetch(linkedinUrl)
      if (profile) {
        sources.push('proxycurl')
        const currentExp = profile.experiences?.find(e => !e.ends_at)
        await prisma.academic.update({
          where: { id: academicId },
          data: {
            linkedinUrl,
            currentJobTitle: currentExp?.title ?? profile.occupation ?? undefined,
            currentCompany: currentExp?.company ?? undefined,
            currentCity: profile.city ?? undefined,
            currentState: profile.state ?? undefined,
          },
        })
      }
    } catch (err) {
      console.error('[API] Proxycurl fetch failed:', err instanceof Error ? err.message : err)
    }
  }

  const finalAcademic = await prisma.academic.findUnique({ where: { id: academicId } })
  const hasEmployment = !!(finalAcademic?.currentCompany || finalAcademic?.currentJobTitle)
  const hasSocial = !!(finalAcademic?.linkedinUrl || finalAcademic?.lattesUrl)
  const enrichmentStatus = hasEmployment || hasSocial ? 'COMPLETE' : sources.length > 0 ? 'PARTIAL' : 'PENDING'

  await prisma.academic.update({
    where: { id: academicId },
    data: { enrichmentStatus, enrichmentTier: 'API', lastEnrichedAt: new Date() },
  })

  return { success: enrichmentStatus !== 'PENDING', enrichmentStatus, sources, durationMs: Date.now() - start }
}
