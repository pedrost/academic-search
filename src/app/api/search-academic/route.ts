/**
 * Academic Search API - Grok Enrichment
 *
 * Endpoint: GET /api/search-academic?name=<name> OR ?academicId=<id>
 *
 * Uses Grok API to find current professional information about academics
 * and enriches their profiles in the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { callGrokAPI } from '@/lib/grok/client'
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/grok/prompts'
import { parseGrokResponse, mapGrokResponse } from '@/lib/grok/mapper'

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

    // Build Grok prompt with academic's known data
    const userPrompt = buildUserPrompt({
      name: academic.name,
      institution: academic.institution,
      graduationYear: academic.graduationYear,
      researchField: academic.researchField,
      dissertationTitle: academic.dissertations[0]?.title
    })

    // Call Grok API
    const grokResponse = await callGrokAPI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ])

    // Parse and validate response
    const parsedResponse = parseGrokResponse(grokResponse)

    if (!parsedResponse) {
      // Store raw error in metadata for debugging
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
    const updateData = mapGrokResponse(parsedResponse)

    // Update academic record
    const updatedAcademic = await prisma.academic.update({
      where: { id: academic.id },
      data: updateData,
      include: { dissertations: true }
    })

    return NextResponse.json({
      success: true,
      academic: updatedAcademic,
      enrichmentSummary: {
        jobTitle: updateData.currentJobTitle,
        company: updateData.currentCompany,
        sector: updateData.currentSector,
        professionalDataCount: updateData.grokMetadata.professional
          ? Object.values(updateData.grokMetadata.professional).flat().length
          : 0,
        sourcesCount: updateData.grokMetadata.sources.length
      }
    })

  } catch (error) {
    console.error('Academic search error:', error)

    return NextResponse.json(
      {
        error: 'Failed to enrich academic profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
