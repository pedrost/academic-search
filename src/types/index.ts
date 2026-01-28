import { Academic, Dissertation, EnrichmentTask, ScraperSession } from '@prisma/client'

export type AcademicWithDissertations = Academic & {
  dissertations: Dissertation[]
}

export type SearchFilters = {
  query?: string
  researchField?: string
  degreeLevel?: string[]
  graduationYearMin?: number
  graduationYearMax?: number
  currentState?: string
  currentCity?: string
  currentSector?: string[]
}

export type SearchResult = {
  academics: AcademicWithDissertations[]
  total: number
  page: number
  pageSize: number
}

export type TaskWithAcademic = EnrichmentTask & {
  academic: Academic | null
}

export type LinkedInCandidate = {
  name: string
  headline: string
  location: string
  profileUrl: string
  imageUrl?: string
}

export type CaptchaPayload = {
  imageUrl: string
  siteUrl: string
}

export type LinkedInMatchPayload = {
  candidates: LinkedInCandidate[]
  searchQuery: string
}
