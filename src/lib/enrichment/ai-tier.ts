/**
 * AI Tier Enrichment
 *
 * Refactored from /api/discover-academic: same 3-call Grok-4 pipeline,
 * now reusable as a function callable from the worker and the API route.
 *
 * Cost: ~$0.15–0.25/academic (Grok-4 × 3 calls + web search)
 * Time: 2–5 min/academic
 *
 * Required env var: XAI_API_KEY
 */

import { prisma } from '@/lib/db'
import { callGrokAPI } from '@/lib/grok/client'
import {
  ACADEMIC_DISCOVERY_SYSTEM_PROMPT,
  buildAcademicDiscoveryPrompt,
  SYSTEM_PROMPT,
  buildUserPrompt,
  LINKEDIN_EXTRACTION_SYSTEM_PROMPT,
  buildLinkedInExtractionPrompt,
} from '@/lib/grok/prompts'
import {
  parseAcademicDiscoveryResponse,
  mapDiscoveryToUpsertData,
  parseGrokResponse,
  mapGrokResponse,
  parseLinkedInExtractionResponse,
  mergeLinkedInProfileData,
  extractCurrentJobFromLinkedIn,
} from '@/lib/grok/mapper'
import { upsertAcademicWithDissertation, upsertAcademic } from '@/lib/academic-upsert'
import type { EnrichmentContext, FreeTierResult } from './free-tier'

export async function aiTierEnrich(
  academicId: string | null,
  ctx: EnrichmentContext = {}
): Promise<FreeTierResult & { academicId?: string }> {
  const start = Date.now()
  const sources: string[] = []

  // Load from DB if ID given; otherwise use context.name for cold discovery
  let academic = academicId
    ? await prisma.academic.findUnique({ where: { id: academicId }, include: { dissertations: true } })
    : null

  const name = ctx.name ?? academic?.name
  if (!name) {
    return { success: false, enrichmentStatus: 'PENDING', sources: [], durationMs: 0, error: 'Name required' }
  }

  // ── Phase 1: Discovery ───────────────────────────────────────────────
  const additionalContext = [ctx.institution, ctx.state, ctx.city].filter(Boolean).join(', ')
  const discoveryResponse = await callGrokAPI([
    { role: 'system', content: ACADEMIC_DISCOVERY_SYSTEM_PROMPT },
    { role: 'user', content: buildAcademicDiscoveryPrompt(name, additionalContext || undefined) },
  ])

  const discoveryData = parseAcademicDiscoveryResponse(discoveryResponse)
  if (!discoveryData?.found) {
    return { success: false, enrichmentStatus: 'PENDING', sources: [], durationMs: Date.now() - start }
  }

  sources.push('grok-discovery')
  const upsertData = mapDiscoveryToUpsertData(discoveryData)

  if (!upsertData) {
    return { success: false, enrichmentStatus: 'PENDING', sources, durationMs: Date.now() - start }
  }

  // ── Phase 2: Save initial profile ───────────────────────────────────
  let resolvedId: string

  if (academic) {
    // Update existing academic with discovered data (fill gaps only)
    resolvedId = academic.id
    await prisma.academic.update({
      where: { id: resolvedId },
      data: {
        grokMetadata: { discoveryPhase: { confidence: discoveryData.confidence, sources: discoveryData.sources } },
        grokEnrichedAt: new Date(),
      },
    })
  } else {
    // Create new academic record
    if (upsertData.dissertationData) {
      const result = await upsertAcademicWithDissertation(
        upsertData.academicData,
        upsertData.dissertationData,
        { source: 'LINKEDIN', scrapedAt: new Date() }
      )
      resolvedId = result.academicId
    } else {
      const result = await upsertAcademic(upsertData.academicData, { source: 'LINKEDIN', scrapedAt: new Date() })
      resolvedId = result.id
    }
  }

  // ── Phase 3: Employment enrichment ──────────────────────────────────
  const currentAcademic = await prisma.academic.findUnique({
    where: { id: resolvedId },
    include: { dissertations: true },
  })
  if (!currentAcademic) {
    return { success: false, enrichmentStatus: 'PENDING', sources, durationMs: Date.now() - start }
  }

  const enrichmentResponse = await callGrokAPI([
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: buildUserPrompt({
        name: currentAcademic.name,
        institution: currentAcademic.institution,
        graduationYear: currentAcademic.graduationYear,
        researchField: currentAcademic.researchField,
        dissertationTitle: currentAcademic.dissertations[0]?.title,
        currentCompany: currentAcademic.currentCompany,
        currentCity: currentAcademic.currentCity,
        currentState: currentAcademic.currentState,
      }),
    },
  ])

  const grokData = parseGrokResponse(enrichmentResponse)
  let updateData = grokData ? mapGrokResponse(grokData) : null
  const metadata: Record<string, unknown> = { ...((updateData?.grokMetadata as any) ?? {}) }
  metadata.discoveryPhase = discoveryData
  sources.push('grok-enrichment')

  // ── Phase 4: LinkedIn profile extraction ────────────────────────────
  const linkedInUrl = updateData?.linkedinUrl ?? currentAcademic.linkedinUrl
  if (linkedInUrl) {
    try {
      const linkedInResponse = await callGrokAPI([
        { role: 'system', content: LINKEDIN_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: buildLinkedInExtractionPrompt(linkedInUrl, currentAcademic.name) },
      ])
      const linkedInData = parseLinkedInExtractionResponse(linkedInResponse)
      if (linkedInData) {
        const merged = mergeLinkedInProfileData(metadata as any, linkedInData)
        Object.assign(metadata, merged)
        const jobFromLinkedIn = extractCurrentJobFromLinkedIn(linkedInData)
        if (updateData) {
          updateData.currentJobTitle = updateData.currentJobTitle ?? jobFromLinkedIn.currentJobTitle ?? null
          updateData.currentCompany = updateData.currentCompany ?? jobFromLinkedIn.currentCompany ?? null
          updateData.currentCity = updateData.currentCity ?? jobFromLinkedIn.currentCity ?? null
        }
        sources.push('grok-linkedin')
      }
    } catch (err) {
      console.error('[AI] LinkedIn extraction failed (non-fatal):', err)
    }
  }

  // ── Phase 5: Final save ──────────────────────────────────────────────
  const hasEmployment = !!(updateData?.currentJobTitle || updateData?.currentCompany)
  const hasSocial = !!(updateData?.linkedinUrl || currentAcademic.linkedinUrl || currentAcademic.lattesUrl)
  const enrichmentStatus = hasEmployment || hasSocial ? 'COMPLETE' : 'PARTIAL'

  await prisma.academic.update({
    where: { id: resolvedId },
    data: {
      ...(updateData ?? {}),
      grokMetadata: metadata as any,
      grokEnrichedAt: new Date(),
      enrichmentStatus,
      enrichmentTier: 'AI',
      lastEnrichedAt: new Date(),
    },
  })

  return {
    success: true,
    enrichmentStatus,
    sources,
    durationMs: Date.now() - start,
    academicId: resolvedId,
  }
}
