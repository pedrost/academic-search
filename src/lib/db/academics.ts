import { prisma } from '@/lib/db'
import { SearchFilters, SearchResult } from '@/types'
import { Prisma, DegreeLevel, Sector } from '@prisma/client'

const VALID_DEGREE_LEVELS = new Set(Object.values(DegreeLevel))
const VALID_SECTORS = new Set(Object.values(Sector))

export async function searchAcademics(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<SearchResult> {
  const where: Prisma.AcademicWhereInput = {}

  if (filters.ids && filters.ids.length > 0) {
    where.id = { in: filters.ids }
  }

  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query } },
      { researchField: { contains: filters.query } },
      {
        dissertations: {
          some: {
            title: { contains: filters.query },
          },
        },
      },
    ]
  }

  if (filters.researchField) {
    where.researchField = { contains: filters.researchField }
  }

  if (filters.degreeLevel && filters.degreeLevel.length > 0) {
    const validLevels = filters.degreeLevel.filter(
      (d): d is DegreeLevel => VALID_DEGREE_LEVELS.has(d as DegreeLevel)
    )
    if (validLevels.length > 0) {
      where.degreeLevel = { in: validLevels }
    }
  }

  if (filters.graduationYearMin || filters.graduationYearMax) {
    where.graduationYear = {}
    if (filters.graduationYearMin) {
      where.graduationYear.gte = filters.graduationYearMin
    }
    if (filters.graduationYearMax) {
      where.graduationYear.lte = filters.graduationYearMax
    }
  }

  if (filters.currentState) {
    where.currentState = filters.currentState
  }

  if (filters.currentCity) {
    where.currentCity = { contains: filters.currentCity }
  }

  if (filters.currentSector && filters.currentSector.length > 0) {
    const validSectors = filters.currentSector.filter(
      (s): s is Sector => VALID_SECTORS.has(s as Sector)
    )
    if (validSectors.length > 0) {
      where.currentSector = { in: validSectors }
    }
  }

  // When filtering by IDs, sort by enrichment status so enhanced profiles appear first
  const orderBy: Prisma.AcademicOrderByWithRelationInput[] = filters.ids
    ? [{ enrichmentStatus: 'desc' }, { name: 'asc' }]
    : [{ name: 'asc' }]

  const [academics, total] = await Promise.all([
    prisma.academic.findMany({
      where,
      include: { dissertations: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    }),
    prisma.academic.count({ where }),
  ])

  return { academics, total, page, pageSize }
}

export async function getAcademicById(id: string) {
  return prisma.academic.findUnique({
    where: { id },
    include: { dissertations: true },
  })
}
