/**
 * Academic Search API - Grok Enrichment
 *
 * Endpoint: GET /api/search-academic?name=<name> OR ?academicId=<id>
 *
 * Uses Grok API to find current professional information about academics
 * and enriches their profiles in the database.
 *
 * Two-phase enrichment:
 * 1. Find LinkedIn URL and basic info
 * 2. If LinkedIn found, extract detailed career/education timeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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
  try {
    const searchParams = request.nextUrl.searchParams
    const name = searchParams.get('name')
    const academicId = searchParams.get('academicId')

    // Validate parameters
    if (!name && !academicId) {
      return NextResponse.json(
        { error: 'Either "name" or "academicId" parameter is required' },
        { status: 400 }
      )
    }

    // Find academic in database
    let academic = null

    if (academicId) {
      academic = await prisma.academic.findUnique({
        where: { id: academicId },
        include: { dissertations: true }
      })
    } else if (name) {
      // Search by name - get first match
      academic = await prisma.academic.findFirst({
        where: {
          name: {
            contains: name,
            mode: 'insensitive'
          }
        },
        include: { dissertations: true }
      })
    }

    if (!academic) {
      return NextResponse.json(
        { error: 'Academic not found', searchedFor: { name, academicId } },
        { status: 404 }
      )
    }

    // ========================================
    // PHASE 1: Find LinkedIn URL and basic info
    // ========================================
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

    console.log('[Search Academic] Phase 1: Finding LinkedIn for:', academic.name)
    let grokResponse
    try {
      grokResponse = await callGrokAPI([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ])
      console.log('[Search Academic] Phase 1 complete')
    } catch (apiError) {
      console.error('[Search Academic] Phase 1 failed:', apiError)
      throw apiError
    }

    // Parse and validate response
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

      return NextResponse.json(
        {
          error: 'Failed to parse Grok response',
          academic: { id: academic.id, name: academic.name }
        },
        { status: 500 }
      )
    }

    // Map response to database fields
    let updateData = mapGrokResponse(parsedResponse)
    let metadata = updateData.grokMetadata as unknown as GrokMetadata

    // ========================================
    // PHASE 2: Extract LinkedIn profile details (if URL found)
    // ========================================
    const linkedInUrl = updateData.linkedinUrl || parsedResponse.social?.linkedinUrl

    if (linkedInUrl) {
      console.log('[Search Academic] Phase 2: Extracting LinkedIn profile data from:', linkedInUrl)

      try {
        const linkedInPrompt = buildLinkedInExtractionPrompt(linkedInUrl, academic.name)
        const linkedInResponse = await callGrokAPI([
          { role: 'system', content: LINKEDIN_EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: linkedInPrompt }
        ])

        const linkedInData = parseLinkedInExtractionResponse(linkedInResponse)

        if (linkedInData) {
          console.log('[Search Academic] Phase 2 complete - extracted profile data')

          // Merge LinkedIn profile data into metadata
          metadata = mergeLinkedInProfileData(metadata, linkedInData)
          updateData.grokMetadata = metadata as any

          // Extract current job info from LinkedIn data if not already set
          if (!updateData.currentJobTitle || !updateData.currentCompany) {
            const jobInfo = extractCurrentJobFromLinkedIn(linkedInData)
            if (jobInfo.currentJobTitle) updateData.currentJobTitle = jobInfo.currentJobTitle
            if (jobInfo.currentCompany) updateData.currentCompany = jobInfo.currentCompany
            if (jobInfo.currentCity) updateData.currentCity = jobInfo.currentCity
            if (jobInfo.currentState) updateData.currentState = jobInfo.currentState
          }
        }
      } catch (linkedInError) {
        console.error('[Search Academic] Phase 2 failed (non-fatal):', linkedInError)
        // Continue with Phase 1 data - Phase 2 failure is non-fatal
      }
    }

    // Determine enrichment status based on what was found
    const hasEmploymentData = !!(updateData.currentJobTitle || updateData.currentCompany)
    const hasSocialLinks = !!(updateData.linkedinUrl || updateData.lattesUrl)
    const hasLinkedInProfile = !!metadata.linkedInProfile
    const enrichmentStatus = hasEmploymentData || hasSocialLinks ? 'COMPLETE' : 'PARTIAL'

    // Update academic record
    const updatedAcademic = await prisma.academic.update({
      where: { id: academic.id },
      data: {
        ...updateData,
        enrichmentStatus,
        lastEnrichedAt: new Date()
      },
      include: { dissertations: true }
    })

    return NextResponse.json({
      success: true,
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

    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error('[Search Academic] Error details:', {
      message: errorMessage,
      stack: errorStack
    })

    return NextResponse.json(
      {
        error: 'Failed to enrich academic profile',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
