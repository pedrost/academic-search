/**
 * Grok Response Mapper
 *
 * Maps Grok API JSON responses to Academic database fields.
 * Follows the rule: Only store in grokMetadata what cannot be mapped to existing columns.
 */

import { Sector, Prisma } from '@prisma/client'
import { AcademicData, DissertationData } from '@/lib/academic-upsert'

export interface GrokSource {
  url: string
  title: string
  context: string
}

export interface LinkedInJobHistory {
  jobTitle: string
  company: string
  startDate: string
  endDate: string | null
  location: string | null
  isCurrent: boolean
}

export interface LinkedInEducation {
  degree: string
  fieldOfStudy: string | null
  institution: string
  startYear: number | null
  endYear: number | null
}

export interface LinkedInProfileData {
  currentPosition?: {
    jobTitle: string | null
    company: string | null
    location: string | null
    startDate: string | null
  }
  jobHistory?: LinkedInJobHistory[]
  education?: LinkedInEducation[]
  skills?: string[]
  headline?: string | null
  about?: string | null
}

export interface GrokMetadata {
  sources: GrokSource[]
  employment?: {
    confidence: 'high' | 'medium' | 'low'
    context: string | null
    source?: string
  }
  social?: {
    googleScholarUrl?: string | null
  }
  professional?: {
    summary?: string | null
    expertise?: string[]
  }
  findings?: {
    summary: string
    confidence: 'high' | 'medium' | 'low'
    matchReason?: string
  }
  linkedInProfile?: LinkedInProfileData
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
    source?: string
  }
  professional?: {
    summary?: string | null
    expertise?: string[]
  }
  social: {
    linkedinUrl: string | null
    lattesUrl: string | null
    googleScholarUrl?: string | null
    email: string | null
  }
  findings: {
    summary: string
    confidence: 'high' | 'medium' | 'low'
    matchReason?: string
  }
  sources: GrokSource[]
}

export interface AcademicDiscoveryResponse {
  found: boolean
  reason?: string
  academic?: {
    name: string
    institution: string | null
    degreeLevel: 'MASTERS' | 'PHD' | 'POSTDOC' | null
    graduationYear: number | null
    researchField: string | null
    currentJobTitle: string | null
    currentCompany: string | null
    currentCity: string | null
    currentState: string | null
    linkedinUrl: string | null
    lattesUrl: string | null
    email: string | null
  }
  dissertation?: {
    title: string | null
    defenseYear: number | null
    institution: string | null
    abstract: string | null
    advisorName: string | null
  } | null
  professional?: {
    summary: string | null
    expertise: string[]
  }
  confidence: 'high' | 'medium' | 'low'
  sources: Array<{ url: string; title: string; relevance: string }>
}

/**
 * Validate URL format for known platforms
 */
function isValidUrl(url: string | null | undefined, platform?: 'linkedin' | 'lattes' | 'scholar' | 'researchgate' | 'orcid'): boolean {
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
      case 'orcid':
        return parsed.hostname.includes('orcid.org')
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

    // Store Google Scholar URL in metadata (no direct column)
    if (isValidUrl(response.social.googleScholarUrl, 'scholar')) {
      metadata.social = {
        googleScholarUrl: response.social.googleScholarUrl
      }
    }
  }

  // Store professional data in metadata (no direct columns for these)
  if (response.professional) {
    const hasAnyProfessional =
      response.professional.summary ||
      response.professional.expertise?.length

    if (hasAnyProfessional) {
      metadata.professional = {
        summary: response.professional.summary || undefined,
        expertise: response.professional.expertise || []
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

/**
 * Parse LinkedIn extraction response
 */
export function parseLinkedInExtractionResponse(rawResponse: any): LinkedInProfileData | null {
  try {
    if (!rawResponse || typeof rawResponse !== 'object') {
      console.error('Invalid LinkedIn extraction response: not an object')
      return null
    }

    return rawResponse as LinkedInProfileData
  } catch (error) {
    console.error('Error parsing LinkedIn extraction response:', error)
    return null
  }
}

/**
 * Merge LinkedIn profile data into existing Grok metadata
 */
export function mergeLinkedInProfileData(
  existingMetadata: GrokMetadata,
  linkedInData: LinkedInProfileData
): GrokMetadata {
  return {
    ...existingMetadata,
    linkedInProfile: linkedInData
  }
}

/**
 * Extract current job info from LinkedIn profile data
 */
export function extractCurrentJobFromLinkedIn(linkedInData: LinkedInProfileData): {
  currentJobTitle?: string
  currentCompany?: string
  currentCity?: string
  currentState?: string
} {
  const result: {
    currentJobTitle?: string
    currentCompany?: string
    currentCity?: string
    currentState?: string
  } = {}

  // Try currentPosition first
  if (linkedInData.currentPosition?.jobTitle) {
    result.currentJobTitle = linkedInData.currentPosition.jobTitle
  }
  if (linkedInData.currentPosition?.company) {
    result.currentCompany = linkedInData.currentPosition.company
  }

  // Parse location if available
  if (linkedInData.currentPosition?.location) {
    const locationParts = linkedInData.currentPosition.location.split(',').map(s => s.trim())
    if (locationParts.length >= 1) {
      result.currentCity = locationParts[0]
    }
    if (locationParts.length >= 2) {
      result.currentState = locationParts[1]
    }
  }

  // Fallback to first current job in history
  if (!result.currentJobTitle && linkedInData.jobHistory?.length) {
    const currentJob = linkedInData.jobHistory.find(j => j.isCurrent)
    if (currentJob) {
      result.currentJobTitle = currentJob.jobTitle
      result.currentCompany = currentJob.company
      if (currentJob.location) {
        const locationParts = currentJob.location.split(',').map(s => s.trim())
        if (locationParts.length >= 1) result.currentCity = locationParts[0]
        if (locationParts.length >= 2) result.currentState = locationParts[1]
      }
    }
  }

  return result
}

/**
 * Parse Grok academic discovery response
 */
export function parseAcademicDiscoveryResponse(rawResponse: any): AcademicDiscoveryResponse | null {
  try {
    let data = rawResponse

    // Handle string response
    if (typeof data === 'string') {
      const jsonMatch = data.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      data = JSON.parse(jsonMatch[0])
    }

    // Validate required field
    if (typeof data.found !== 'boolean') {
      return null
    }

    return data as AcademicDiscoveryResponse
  } catch (error) {
    console.error('[Grok] Failed to parse academic discovery response:', error)
    return null
  }
}

/**
 * Map academic discovery response to upsert data format
 */
export function mapDiscoveryToUpsertData(
  discovery: AcademicDiscoveryResponse
): { academicData: AcademicData; dissertationData: DissertationData | null } | null {
  if (!discovery.found || !discovery.academic) {
    return null
  }

  const { academic, dissertation } = discovery

  // Build academic data - require at minimum name and institution
  if (!academic.name || !academic.institution) {
    return null
  }

  const academicData: AcademicData = {
    name: academic.name,
    institution: academic.institution,
    graduationYear: academic.graduationYear || new Date().getFullYear(),
    degreeLevel: academic.degreeLevel as any,
    researchField: academic.researchField || undefined,
    email: academic.email || undefined,
    linkedinUrl: academic.linkedinUrl || undefined,
    lattesUrl: academic.lattesUrl || undefined,
    currentCity: academic.currentCity || undefined,
    currentState: academic.currentState || undefined,
    currentJobTitle: academic.currentJobTitle || undefined,
    currentCompany: academic.currentCompany || undefined,
  }

  // Build dissertation data if available
  let dissertationData: DissertationData | null = null
  if (dissertation?.title && dissertation?.institution) {
    dissertationData = {
      title: dissertation.title,
      defenseYear: dissertation.defenseYear || academicData.graduationYear,
      institution: dissertation.institution,
      abstract: dissertation.abstract || undefined,
      advisorName: dissertation.advisorName || undefined,
    }
  }

  return { academicData, dissertationData }
}
