export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
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
import { prisma } from '@/lib/db'

type SSEEvent = {
  phase: 'discovery' | 'enrichment' | 'linkedin' | 'saving'
  status: 'start' | 'complete' | 'skipped'
  message?: string
} | {
  phase: 'done'
  status: 'success'
  academic: any
  enrichmentSummary: any
} | {
  phase: 'done'
  status: 'not_found'
  reason: string
} | {
  phase: 'error'
  status: 'error'
  message: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const name = searchParams.get('name')
  const context = searchParams.get('context')

  if (!name) {
    return new Response(
      JSON.stringify({ error: 'Name parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: SSEEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        )
      }

      try {
        // ========================================
        // PHASE 1: Discover academic from web
        // ========================================
        send({ phase: 'discovery', status: 'start', message: 'Pesquisando na web...' })

        const discoveryResponse = await callGrokAPI([
          { role: 'system', content: ACADEMIC_DISCOVERY_SYSTEM_PROMPT },
          { role: 'user', content: buildAcademicDiscoveryPrompt(name, context || undefined) },
        ])

        const discoveryData = parseAcademicDiscoveryResponse(discoveryResponse)

        if (!discoveryData || !discoveryData.found) {
          send({ phase: 'discovery', status: 'complete' })
          send({
            phase: 'done',
            status: 'not_found',
            reason: discoveryData?.reason || 'Could not find academic information',
          })
          controller.close()
          return
        }

        const upsertData = mapDiscoveryToUpsertData(discoveryData)

        if (!upsertData) {
          send({ phase: 'discovery', status: 'complete' })
          send({
            phase: 'done',
            status: 'not_found',
            reason: 'Insufficient data to create academic profile (missing name or institution)',
          })
          controller.close()
          return
        }

        send({ phase: 'discovery', status: 'complete', message: `Encontrado: ${discoveryData.academic?.name}` })

        // ========================================
        // PHASE 2: Save initial profile
        // ========================================
        send({ phase: 'saving', status: 'start', message: 'Salvando perfil inicial...' })

        let academicId: string

        if (upsertData.dissertationData) {
          const result = await upsertAcademicWithDissertation(
            upsertData.academicData,
            upsertData.dissertationData,
            { source: 'LINKEDIN', scrapedAt: new Date() }
          )
          academicId = result.academicId
        } else {
          const result = await upsertAcademic(
            upsertData.academicData,
            { source: 'LINKEDIN', scrapedAt: new Date() }
          )
          academicId = result.id
        }

        await prisma.academic.update({
          where: { id: academicId },
          data: {
            grokMetadata: {
              discoveryPhase: {
                confidence: discoveryData.confidence,
                sources: discoveryData.sources,
                professional: discoveryData.professional,
              },
            },
            grokEnrichedAt: new Date(),
          },
        })

        send({ phase: 'saving', status: 'complete' })

        // ========================================
        // PHASE 3: Enrich with employment data
        // ========================================
        send({ phase: 'enrichment', status: 'start', message: 'Buscando dados profissionais...' })

        const academic = await prisma.academic.findUnique({
          where: { id: academicId },
          include: { dissertations: true },
        })

        if (!academic) {
          send({ phase: 'error', status: 'error', message: 'Failed to retrieve created academic' })
          controller.close()
          return
        }

        const enrichmentPrompt = buildUserPrompt({
          name: academic.name,
          institution: academic.institution,
          graduationYear: academic.graduationYear,
          researchField: academic.researchField,
          dissertationTitle: academic.dissertations[0]?.title,
          currentCompany: academic.currentCompany,
          currentCity: academic.currentCity,
          currentState: academic.currentState,
        })

        const enrichmentResponse = await callGrokAPI([
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: enrichmentPrompt },
        ])

        const grokData = parseGrokResponse(enrichmentResponse)
        let updateData = grokData ? mapGrokResponse(grokData) : null
        let metadata = (updateData?.grokMetadata as any) || {}
        metadata.discoveryPhase = discoveryData

        send({ phase: 'enrichment', status: 'complete' })

        // ========================================
        // PHASE 4: Extract LinkedIn profile details
        // ========================================
        const linkedInUrl = updateData?.linkedinUrl || academic.linkedinUrl

        if (linkedInUrl) {
          send({ phase: 'linkedin', status: 'start', message: 'Extraindo perfil LinkedIn...' })

          try {
            const linkedInResponse = await callGrokAPI([
              { role: 'system', content: LINKEDIN_EXTRACTION_SYSTEM_PROMPT },
              { role: 'user', content: buildLinkedInExtractionPrompt(linkedInUrl, academic.name) },
            ])

            const linkedInData = parseLinkedInExtractionResponse(linkedInResponse)

            if (linkedInData) {
              metadata = mergeLinkedInProfileData(metadata, linkedInData)
              const jobFromLinkedIn = extractCurrentJobFromLinkedIn(linkedInData)

              if (updateData) {
                updateData.currentJobTitle = updateData.currentJobTitle || jobFromLinkedIn.currentJobTitle
                updateData.currentCompany = updateData.currentCompany || jobFromLinkedIn.currentCompany
                updateData.currentCity = updateData.currentCity || jobFromLinkedIn.currentCity
              }
            }

            send({ phase: 'linkedin', status: 'complete' })
          } catch (linkedInError) {
            console.error('[Discover] LinkedIn extraction failed (non-fatal):', linkedInError)
            send({ phase: 'linkedin', status: 'complete', message: 'LinkedIn parcial' })
          }
        } else {
          send({ phase: 'linkedin', status: 'skipped', message: 'Sem LinkedIn encontrado' })
        }

        // ========================================
        // Final update
        // ========================================
        const hasEmploymentData = !!(updateData?.currentJobTitle || updateData?.currentCompany)
        const hasSocialLinks = !!(updateData?.linkedinUrl || updateData?.lattesUrl || academic.linkedinUrl || academic.lattesUrl)
        const hasLinkedInProfile = !!metadata.linkedInProfile
        const enrichmentStatus = (hasEmploymentData || hasSocialLinks) ? 'COMPLETE' : 'PARTIAL'

        const updatedAcademic = await prisma.academic.update({
          where: { id: academicId },
          data: {
            ...(updateData || {}),
            grokMetadata: metadata,
            grokEnrichedAt: new Date(),
            enrichmentStatus,
            lastEnrichedAt: new Date(),
          },
          include: { dissertations: true },
        })

        send({
          phase: 'done',
          status: 'success',
          academic: updatedAcademic,
          enrichmentSummary: {
            discoveryConfidence: discoveryData.confidence,
            sourcesFound: discoveryData.sources?.length || 0,
            jobTitle: updatedAcademic.currentJobTitle,
            company: updatedAcademic.currentCompany,
            sector: updatedAcademic.currentSector,
            linkedInUrl: updatedAcademic.linkedinUrl,
            hasLinkedInProfile,
            enrichmentStatus,
          },
        })
      } catch (error) {
        console.error('[Discover] Error:', error)
        send({
          phase: 'error',
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
