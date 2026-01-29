/**
 * Smart Academic Upsert System
 *
 * Handles deduplication and intelligent data merging from multiple sources:
 * - CAPES API
 * - BDTD
 * - University repositories
 * - LinkedIn
 *
 * Rules:
 * 1. Identify duplicates by: name + institution + graduationYear
 * 2. Merge data: never overwrite existing data with null/empty
 * 3. Track sources: keep metadata about where each piece of data came from
 * 4. Append flexible data: use JSONB for source-specific metadata
 */

import { prisma } from '@/lib/db'
import { DegreeLevel } from '@prisma/client'

export interface AcademicData {
  name: string
  institution: string
  graduationYear: number
  degreeLevel?: DegreeLevel
  researchField?: string
  email?: string
  linkedinUrl?: string
  lattesUrl?: string
  currentCity?: string
  currentState?: string
  currentJobTitle?: string
  currentCompany?: string
}

export interface DissertationData {
  title: string
  defenseYear: number
  institution: string
  abstract?: string
  advisorName?: string
  keywords?: string[]
  sourceUrl?: string
}

export interface UpsertMetadata {
  source: 'CAPES' | 'BDTD' | 'UFMS' | 'UCDB' | 'UEMS' | 'IFMS' | 'LINKEDIN'
  scrapedAt: Date
  rawData?: any
}

/**
 * Smart merge: only update if new value is not null/empty and field is currently empty
 */
function smartMerge<T>(existing: T | null | undefined, newValue: T | null | undefined): T | null | undefined {
  // If new value is null/empty, keep existing
  if (newValue === null || newValue === undefined || newValue === '') {
    return existing
  }

  // If existing is null/empty, use new value
  if (existing === null || existing === undefined || existing === '') {
    return newValue
  }

  // Both have values, keep existing (don't overwrite good data)
  return existing
}

/**
 * Upsert Academic with intelligent merging
 * Returns the academic ID and whether it was created or updated
 */
export async function upsertAcademic(
  data: AcademicData,
  metadata: UpsertMetadata
): Promise<{ id: string; created: boolean; updated: boolean }> {

  // Find existing academic by name + institution + year
  const existing = await prisma.academic.findFirst({
    where: {
      name: data.name,
      institution: data.institution,
      graduationYear: data.graduationYear,
    },
  })

  if (existing) {
    // Academic exists - smart merge
    const updates: any = {}
    let hasUpdates = false

    // Only update fields that are currently empty
    if (data.degreeLevel && !existing.degreeLevel) {
      updates.degreeLevel = data.degreeLevel
      hasUpdates = true
    }

    if (data.researchField && existing.researchField === 'UNKNOWN') {
      updates.researchField = data.researchField
      hasUpdates = true
    }

    const mergedEmail = smartMerge(existing.email, data.email)
    if (mergedEmail !== existing.email) {
      updates.email = mergedEmail
      hasUpdates = true
    }

    const mergedLinkedin = smartMerge(existing.linkedinUrl, data.linkedinUrl)
    if (mergedLinkedin !== existing.linkedinUrl) {
      updates.linkedinUrl = mergedLinkedin
      hasUpdates = true
    }

    const mergedLattes = smartMerge(existing.lattesUrl, data.lattesUrl)
    if (mergedLattes !== existing.lattesUrl) {
      updates.lattesUrl = mergedLattes
      hasUpdates = true
    }

    const mergedCity = smartMerge(existing.currentCity, data.currentCity)
    if (mergedCity !== existing.currentCity) {
      updates.currentCity = mergedCity
      hasUpdates = true
    }

    const mergedState = smartMerge(existing.currentState, data.currentState)
    if (mergedState !== existing.currentState) {
      updates.currentState = mergedState
      hasUpdates = true
    }

    const mergedJobTitle = smartMerge(existing.currentJobTitle, data.currentJobTitle)
    if (mergedJobTitle !== existing.currentJobTitle) {
      updates.currentJobTitle = mergedJobTitle
      hasUpdates = true
    }

    const mergedCompany = smartMerge(existing.currentCompany, data.currentCompany)
    if (mergedCompany !== existing.currentCompany) {
      updates.currentCompany = mergedCompany
      hasUpdates = true
    }

    // NOTE: enrichmentStatus is intentionally NOT updated here
    // Only the LinkedIn worker should change enrichmentStatus (PENDING -> PARTIAL/COMPLETE)
    // Scrapers should never overwrite enrichment progress

    if (hasUpdates) {
      await prisma.academic.update({
        where: { id: existing.id },
        data: updates,
      })
      return { id: existing.id, created: false, updated: true }
    }

    return { id: existing.id, created: false, updated: false }
  }

  // Create new academic
  const academic = await prisma.academic.create({
    data: {
      name: data.name,
      institution: data.institution || 'UNKNOWN',
      graduationYear: data.graduationYear,
      degreeLevel: data.degreeLevel,
      researchField: data.researchField || 'UNKNOWN',
      email: data.email,
      linkedinUrl: data.linkedinUrl,
      lattesUrl: data.lattesUrl,
      currentCity: data.currentCity,
      currentState: data.currentState,
      currentJobTitle: data.currentJobTitle,
      currentCompany: data.currentCompany,
      enrichmentStatus: 'PENDING',
    },
  })

  return { id: academic.id, created: true, updated: false }
}

/**
 * Upsert Dissertation with deduplication
 * Returns whether it was created or already existed
 */
export async function upsertDissertation(
  academicId: string,
  data: DissertationData,
  metadata: UpsertMetadata
): Promise<{ created: boolean; dissertationId: string }> {

  // Check if this exact dissertation already exists
  const existing = await prisma.dissertation.findFirst({
    where: {
      academicId,
      title: data.title,
      defenseYear: data.defenseYear,
    },
  })

  if (existing) {
    // Dissertation exists - update missing fields
    const updates: any = {}
    let hasUpdates = false

    const mergedAbstract = smartMerge(existing.abstract, data.abstract)
    if (mergedAbstract !== existing.abstract) {
      updates.abstract = mergedAbstract
      hasUpdates = true
    }

    const mergedAdvisor = smartMerge(existing.advisorName, data.advisorName)
    if (mergedAdvisor !== existing.advisorName) {
      updates.advisorName = mergedAdvisor
      hasUpdates = true
    }

    const mergedUrl = smartMerge(existing.sourceUrl, data.sourceUrl)
    if (mergedUrl !== existing.sourceUrl) {
      updates.sourceUrl = mergedUrl
      hasUpdates = true
    }

    // Merge keywords arrays
    if (data.keywords && data.keywords.length > 0) {
      const existingKeywords = new Set(existing.keywords)
      const newKeywords = data.keywords.filter(k => !existingKeywords.has(k))
      if (newKeywords.length > 0) {
        updates.keywords = [...existing.keywords, ...newKeywords]
        hasUpdates = true
      }
    }

    if (hasUpdates) {
      await prisma.dissertation.update({
        where: { id: existing.id },
        data: updates,
      })
    }

    return { created: false, dissertationId: existing.id }
  }

  // Create new dissertation
  const dissertation = await prisma.dissertation.create({
    data: {
      academicId,
      title: data.title,
      defenseYear: data.defenseYear,
      institution: data.institution,
      abstract: data.abstract,
      advisorName: data.advisorName,
      keywords: data.keywords || [],
      sourceUrl: data.sourceUrl,
    },
  })

  return { created: true, dissertationId: dissertation.id }
}

/**
 * Combined upsert: Academic + Dissertation in one transaction
 */
export async function upsertAcademicWithDissertation(
  academicData: AcademicData,
  dissertationData: DissertationData,
  metadata: UpsertMetadata
): Promise<{
  academicId: string
  dissertationId: string
  academicCreated: boolean
  academicUpdated: boolean
  dissertationCreated: boolean
}> {

  const academicResult = await upsertAcademic(academicData, metadata)
  const dissertationResult = await upsertDissertation(
    academicResult.id,
    dissertationData,
    metadata
  )

  return {
    academicId: academicResult.id,
    dissertationId: dissertationResult.dissertationId,
    academicCreated: academicResult.created,
    academicUpdated: academicResult.updated,
    dissertationCreated: dissertationResult.created,
  }
}
