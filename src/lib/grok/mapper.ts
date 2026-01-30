/**
 * Grok Response Mapper
 *
 * Maps Grok API JSON responses to Academic database fields.
 * Follows the rule: Only store in grokMetadata what cannot be mapped to existing columns.
 */

import { Sector, Prisma } from '@prisma/client'

export interface GrokSource {
  url: string
  title: string
  context: string
}

export interface GrokMetadata {
  sources: GrokSource[]
  employment?: {
    confidence: 'high' | 'medium' | 'low'
    context: string | null
  }
  social?: {
    twitterHandle?: string | null
    personalWebsite?: string | null
    googleScholarUrl?: string | null
    researchGateUrl?: string | null
  }
  professional?: {
    recentPublications: string[]
    researchProjects: string[]
    conferences: string[]
    awards: string[]
  }
  findings?: {
    summary: string
    confidence: 'high' | 'medium' | 'low'
    matchReason?: string
  }
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
    googleScholarUrl?: string | null
    researchGateUrl?: string | null
    personalWebsite: string | null
    email: string | null
  }
  findings: {
    summary: string
    confidence: 'high' | 'medium' | 'low'
    matchReason?: string
  }
  sources: GrokSource[]
}

/**
 * Validate URL format for known platforms
 */
function isValidUrl(url: string | null | undefined, platform?: 'linkedin' | 'lattes' | 'scholar' | 'researchgate'): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)

    switch (platform) {
      case 'linkedin':
        return parsed.hostname.includes('linkedin.com') && url.includes('/in/')
      case 'lattes':
        return parsed.hostname === 'lattes.cnpq.br' && /\/\d{16}$/.test(parsed.pathname)
      case 'scholar':
        return parsed.hostname.includes('scholar.google')
      case 'researchgate':
        return parsed.hostname.includes('researchgate.net')
      default:
        return true
    }
  } catch {
    return false
  }
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
  grokMetadata: Prisma.InputJsonValue

  // Enrichment timestamp
  grokEnrichedAt: Date
}

/**
 * Map Grok API response to Academic database update object
 */
export function mapGrokResponse(response: GrokResponse): MappedAcademicUpdate {
  const metadata: GrokMetadata = {
    sources: response.sources || []
  }

  const update: Partial<MappedAcademicUpdate> = {
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
      metadata.employment = {
        confidence: response.employment.confidence,
        context: response.employment.context || null
      }
    }
  }

  // Map social fields with URL validation
  if (response.social) {
    // Only store LinkedIn URL if it's valid
    if (isValidUrl(response.social.linkedinUrl, 'linkedin')) {
      update.linkedinUrl = response.social.linkedinUrl
    } else if (response.social.linkedinUrl) {
      console.warn(`Invalid LinkedIn URL rejected: ${response.social.linkedinUrl}`)
    }

    // Only store Lattes URL if it's valid
    if (isValidUrl(response.social.lattesUrl, 'lattes')) {
      update.lattesUrl = response.social.lattesUrl
    } else if (response.social.lattesUrl) {
      console.warn(`Invalid Lattes URL rejected: ${response.social.lattesUrl}`)
    }

    if (response.social.email) {
      update.email = response.social.email
    }

    // Store overflow social fields in metadata (with validation)
    const socialMetadata: GrokMetadata['social'] = {}

    if (response.social.twitterHandle) {
      socialMetadata.twitterHandle = response.social.twitterHandle
    }
    if (response.social.personalWebsite && isValidUrl(response.social.personalWebsite)) {
      socialMetadata.personalWebsite = response.social.personalWebsite
    }
    if (isValidUrl(response.social.googleScholarUrl, 'scholar')) {
      socialMetadata.googleScholarUrl = response.social.googleScholarUrl
    }
    if (isValidUrl(response.social.researchGateUrl, 'researchgate')) {
      socialMetadata.researchGateUrl = response.social.researchGateUrl
    }

    if (Object.keys(socialMetadata).length > 0) {
      metadata.social = socialMetadata
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
      metadata.professional = {
        recentPublications: response.professional.recentPublications || [],
        researchProjects: response.professional.researchProjects || [],
        conferences: response.professional.conferences || [],
        awards: response.professional.awards || []
      }
    }
  }

  // Store findings summary in metadata
  if (response.findings) {
    metadata.findings = {
      summary: response.findings.summary,
      confidence: response.findings.confidence,
      matchReason: response.findings.matchReason
    }
  }

  // Cast metadata to Prisma.InputJsonValue and return
  return {
    ...update,
    grokMetadata: metadata as unknown as Prisma.InputJsonValue
  } as MappedAcademicUpdate
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
