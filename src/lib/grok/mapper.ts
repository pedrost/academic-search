/**
 * Grok Response Mapper
 *
 * Maps Grok API JSON responses to Academic database fields.
 * Follows the rule: Only store in grokMetadata what cannot be mapped to existing columns.
 */

import { Sector } from '@prisma/client'

export interface GrokSource {
  url: string
  title: string
  context: string
}

export interface GrokResponse {
  employment: {
    jobTitle: string | null
    company: string | null
    sector: 'ACADEMIA' | 'GOVERNMENT' | 'PRIVATE' | 'NGO' | null
    city: string | null
    state: string | null
    confidence: 'high' | 'medium' | 'low'
    context?: string | null
  }
  professional: {
    recentPublications: string[]
    researchProjects: string[]
    conferences: string[]
    awards: string[]
  }
  social: {
    linkedinUrl: string | null
    twitterHandle: string | null
    lattesUrl: string | null
    personalWebsite: string | null
    email: string | null
  }
  findings: {
    summary: string
    confidence: 'high' | 'medium' | 'low'
  }
  sources: GrokSource[]
}

export interface MappedAcademicUpdate {
  // Direct column mappings
  currentJobTitle?: string | null
  currentCompany?: string | null
  currentSector?: Sector
  currentCity?: string | null
  currentState?: string | null
  linkedinUrl?: string | null
  lattesUrl?: string | null
  email?: string | null

  // Overflow data (stored in grokMetadata JSON field)
  grokMetadata: any

  // Enrichment timestamp
  grokEnrichedAt: Date
}

/**
 * Map Grok API response to Academic database update object
 */
export function mapGrokResponse(response: GrokResponse): MappedAcademicUpdate {
  const update: MappedAcademicUpdate = {
    grokMetadata: {
      sources: response.sources || []
    },
    grokEnrichedAt: new Date()
  }

  // Map employment fields to direct columns
  if (response.employment) {
    if (response.employment.jobTitle) {
      update.currentJobTitle = response.employment.jobTitle
    }
    if (response.employment.company) {
      update.currentCompany = response.employment.company
    }
    if (response.employment.sector) {
      update.currentSector = response.employment.sector as Sector
    }
    if (response.employment.city) {
      update.currentCity = response.employment.city
    }
    if (response.employment.state) {
      update.currentState = response.employment.state
    }

    // Store confidence and context in metadata (no direct columns for these)
    if (response.employment.confidence || response.employment.context) {
      update.grokMetadata.employment = {
        confidence: response.employment.confidence,
        context: response.employment.context || null
      }
    }
  }

  // Map social fields
  if (response.social) {
    if (response.social.linkedinUrl) {
      update.linkedinUrl = response.social.linkedinUrl
    }
    if (response.social.lattesUrl) {
      update.lattesUrl = response.social.lattesUrl
    }
    if (response.social.email) {
      update.email = response.social.email
    }

    // Store overflow social fields in metadata
    if (response.social.twitterHandle || response.social.personalWebsite) {
      update.grokMetadata.social = {
        twitterHandle: response.social.twitterHandle,
        personalWebsite: response.social.personalWebsite
      }
    }
  }

  // Store professional data in metadata (no direct columns for these)
  if (response.professional) {
    const hasAnyProfessional =
      response.professional.recentPublications?.length > 0 ||
      response.professional.researchProjects?.length > 0 ||
      response.professional.conferences?.length > 0 ||
      response.professional.awards?.length > 0

    if (hasAnyProfessional) {
      update.grokMetadata.professional = {
        recentPublications: response.professional.recentPublications || [],
        researchProjects: response.professional.researchProjects || [],
        conferences: response.professional.conferences || [],
        awards: response.professional.awards || []
      }
    }
  }

  // Store findings summary in metadata
  if (response.findings) {
    update.grokMetadata.findings = {
      summary: response.findings.summary,
      confidence: response.findings.confidence
    }
  }

  return update
}

/**
 * Parse Grok API response and handle errors
 */
export function parseGrokResponse(rawResponse: any): GrokResponse | null {
  try {
    // Validate required structure
    if (!rawResponse || typeof rawResponse !== 'object') {
      console.error('Invalid Grok response: not an object')
      return null
    }

    // Return the response (Grok API enforces JSON schema via response_format)
    return rawResponse as GrokResponse
  } catch (error) {
    console.error('Error parsing Grok response:', error)
    return null
  }
}
