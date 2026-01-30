import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const name = searchParams.get('name')
  const context = searchParams.get('context')

  if (!name) {
    return NextResponse.json(
      { error: 'Name parameter is required' },
      { status: 400 }
    )
  }

  try {
    console.log(`[Discover] Starting web discovery for: ${name}`)

    // ========================================
    // PHASE 1: Discover academic from web
    // ========================================
    const discoveryResponse = await callGrokAPI([
      { role: 'system', content: ACADEMIC_DISCOVERY_SYSTEM_PROMPT },
      { role: 'user', content: buildAcademicDiscoveryPrompt(name, context || undefined) },
    ])

    const discoveryData = parseAcademicDiscoveryResponse(discoveryResponse)

    if (!discoveryData || !discoveryData.found) {
      console.log(`[Discover] No academic found for: ${name}`)
      return NextResponse.json({
        success: false,
        found: false,
        reason: discoveryData?.reason || 'Could not find academic information',
      })
    }

    console.log(`[Discover] Found academic: ${discoveryData.academic?.name}`)

    // Map to upsert data
    const upsertData = mapDiscoveryToUpsertData(discoveryData)

    if (!upsertData) {
      return NextResponse.json({
        success: false,
        found: true,
        reason: 'Insufficient data to create academic profile (missing name or institution)',
      })
    }

    // Create academic in database
    let academicId: string
    let wasCreated: boolean

    if (upsertData.dissertationData) {
      const result = await upsertAcademicWithDissertation(
        upsertData.academicData,
        upsertData.dissertationData,
        { source: 'LINKEDIN', scrapedAt: new Date() }
      )
      academicId = result.academicId
      wasCreated = result.academicCreated
    } else {
      const result = await upsertAcademic(
        upsertData.academicData,
        { source: 'LINKEDIN', scrapedAt: new Date() }
      )
      academicId = result.id
      wasCreated = result.created
    }

    // Store discovery metadata
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

    console.log(`[Discover] Academic created/updated with ID: ${academicId}`)

    // ========================================
    // PHASE 2: Enrich with employment data
    // ========================================
    const academic = await prisma.academic.findUnique({
      where: { id: academicId },
      include: { dissertations: true },
    })

    if (!academic) {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve created academic',
      }, { status: 500 })
    }

    console.log(`[Discover] Starting enrichment phase for: ${academic.name}`)

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
    let metadata = updateData?.grokMetadata as any || {}

    // Preserve discovery metadata
    metadata.discoveryPhase = discoveryData

    // ========================================
    // PHASE 3: Extract LinkedIn profile details
    // ========================================
    const linkedInUrl = updateData?.linkedinUrl || academic.linkedinUrl

    if (linkedInUrl) {
      console.log(`[Discover] Extracting LinkedIn profile: ${linkedInUrl}`)

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
      } catch (linkedInError) {
        console.error('[Discover] LinkedIn extraction failed (non-fatal):', linkedInError)
      }
    }

    // Determine enrichment status
    const hasEmploymentData = !!(updateData?.currentJobTitle || updateData?.currentCompany)
    const hasSocialLinks = !!(updateData?.linkedinUrl || updateData?.lattesUrl || academic.linkedinUrl || academic.lattesUrl)
    const hasLinkedInProfile = !!metadata.linkedInProfile
    const enrichmentStatus = (hasEmploymentData || hasSocialLinks) ? 'COMPLETE' : 'PARTIAL'

    // Final update
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

    console.log(`[Discover] Completed all phases for: ${academic.name}`)

    return NextResponse.json({
      success: true,
      found: true,
      created: wasCreated,
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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
