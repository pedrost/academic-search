export const dynamic = 'force-dynamic'

/**
 * Academic Search API - Grok Enrichment (SSE)
 *
 * Endpoint: GET /api/search-academic?name=<name> OR ?academicId=<id>
 *
 * Uses Grok API to find current professional information about academics
 * and enriches their profiles in the database.
 *
 * Streams progress via Server-Sent Events.
 *
 * Two-phase enrichment:
 * 1. Find LinkedIn URL and basic info
 * 2. If LinkedIn found, extract detailed career/education timeline
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { callGrokAPI } from '@/lib/grok/client'
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  LINKEDIN_EXTRACTION_SYSTEM_PROMPT,
  buildLinkedInExtractionPrompt
} from '@/lib/grok/prompts'
import {
  parseGrokResponse,
  mapGrokResponse,
  parseLinkedInExtractionResponse,
  mergeLinkedInProfileData,
  extractCurrentJobFromLinkedIn,
  type GrokMetadata
} from '@/lib/grok/mapper'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const name = searchParams.get('name')
  const academicId = searchParams.get('academicId')

  if (!name && !academicId) {
    return new Response(
      JSON.stringify({ error: 'Either "name" or "academicId" parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Find academic in database
        type AcademicWithDissertations = Prisma.AcademicGetPayload<{ include: { dissertations: true } }>
        let academic: AcademicWithDissertations | null = null

        if (academicId) {
          academic = await prisma.academic.findUnique({
            where: { id: academicId },
            include: { dissertations: true }
          })
        } else if (name) {
          academic = await prisma.academic.findFirst({
            where: {
              name: { contains: name }
            },
            include: { dissertations: true }
          })
        }

        if (!academic) {
          send({ phase: 'error', status: 'error', message: 'Academic not found' })
          controller.close()
          return
        }

        // ========================================
        // PHASE 1: Find LinkedIn URL and basic info
        // ========================================
        send({ phase: 'search', status: 'start', message: 'Buscando informações profissionais...' })

        const userPrompt = buildUserPrompt({
          name: academic.name,
          institution: academic.institution,
          graduationYear: academic.graduationYear,
          researchField: academic.researchField,
          dissertationTitle: academic.dissertations[0]?.title,
          currentCompany: academic.currentCompany,
          currentCity: academic.currentCity,
          currentState: academic.currentState
        })

        let grokResponse
        try {
          grokResponse = await callGrokAPI([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ])
        } catch (apiError) {
          console.error('[Search Academic] Phase 1 failed:', apiError)
          throw apiError
        }

        const parsedResponse = parseGrokResponse(grokResponse)

        if (!parsedResponse) {
          await prisma.academic.update({
            where: { id: academic.id },
            data: {
              grokMetadata: {
                rawError: grokResponse,
                errorMessage: 'Failed to parse Grok response',
                attemptedAt: new Date().toISOString()
              },
              grokEnrichedAt: new Date()
            }
          })

          send({ phase: 'error', status: 'error', message: 'Failed to parse Grok response' })
          controller.close()
          return
        }

        let updateData = mapGrokResponse(parsedResponse)
        let metadata = updateData.grokMetadata as unknown as GrokMetadata

        send({ phase: 'search', status: 'complete' })

        // ========================================
        // PHASE 2: Extract LinkedIn profile details
        // ========================================
        const linkedInUrl = updateData.linkedinUrl || parsedResponse.social?.linkedinUrl

        if (linkedInUrl) {
          send({ phase: 'linkedin', status: 'start', message: 'Extraindo perfil LinkedIn...' })

          try {
            const linkedInPrompt = buildLinkedInExtractionPrompt(linkedInUrl, academic.name)
            const linkedInResponse = await callGrokAPI([
              { role: 'system', content: LINKEDIN_EXTRACTION_SYSTEM_PROMPT },
              { role: 'user', content: linkedInPrompt }
            ])

            const linkedInData = parseLinkedInExtractionResponse(linkedInResponse)

            if (linkedInData) {
              metadata = mergeLinkedInProfileData(metadata, linkedInData)
              updateData.grokMetadata = metadata as unknown as typeof updateData.grokMetadata

              if (!updateData.currentJobTitle || !updateData.currentCompany) {
                const jobInfo = extractCurrentJobFromLinkedIn(linkedInData)
                if (jobInfo.currentJobTitle) updateData.currentJobTitle = jobInfo.currentJobTitle
                if (jobInfo.currentCompany) updateData.currentCompany = jobInfo.currentCompany
                if (jobInfo.currentCity) updateData.currentCity = jobInfo.currentCity
                if (jobInfo.currentState) updateData.currentState = jobInfo.currentState
              }
            }

            send({ phase: 'linkedin', status: 'complete' })
          } catch (linkedInError) {
            console.error('[Search Academic] Phase 2 failed (non-fatal):', linkedInError)
            send({ phase: 'linkedin', status: 'complete', message: 'LinkedIn parcial' })
          }
        } else {
          send({ phase: 'linkedin', status: 'skipped', message: 'Sem LinkedIn encontrado' })
        }

        // ========================================
        // Save results
        // ========================================
        send({ phase: 'save', status: 'start', message: 'Salvando resultados...' })

        const hasEmploymentData = !!(updateData.currentJobTitle || updateData.currentCompany)
        const hasSocialLinks = !!(updateData.linkedinUrl || updateData.lattesUrl)
        const hasLinkedInProfile = !!metadata.linkedInProfile
        const enrichmentStatus = hasEmploymentData || hasSocialLinks ? 'COMPLETE' : 'PARTIAL'

        const updatedAcademic = await prisma.academic.update({
          where: { id: academic.id },
          data: {
            ...updateData,
            enrichmentStatus,
            lastEnrichedAt: new Date()
          },
          include: { dissertations: true }
        })

        send({ phase: 'save', status: 'complete' })

        send({
          phase: 'done',
          status: 'success',
          academic: updatedAcademic,
          enrichmentSummary: {
            jobTitle: updateData.currentJobTitle,
            company: updateData.currentCompany,
            sector: updateData.currentSector,
            linkedInUrl: updateData.linkedinUrl,
            hasLinkedInProfile,
            jobHistoryCount: metadata.linkedInProfile?.jobHistory?.length || 0,
            educationCount: metadata.linkedInProfile?.education?.length || 0,
            skillsCount: metadata.linkedInProfile?.skills?.length || 0,
            sourcesCount: metadata.sources?.length || 0
          }
        })
      } catch (error) {
        console.error('[Search Academic] Error:', error)
        send({
          phase: 'error',
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to enrich academic profile',
        })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
