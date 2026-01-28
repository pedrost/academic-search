import { prisma } from '@/lib/db'
import { SearchFilters, SearchResult } from '@/types'
import { Prisma } from '@prisma/client'

export async function searchAcademics(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<SearchResult> {
  const where: Prisma.AcademicWhereInput = {}

  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query, mode: 'insensitive' } },
      { researchField: { contains: filters.query, mode: 'insensitive' } },
      {
        dissertations: {
          some: {
            OR: [
              { title: { contains: filters.query, mode: 'insensitive' } },
              { keywords: { has: filters.query } },
            ],
          },
        },
      },
    ]
  }

  if (filters.researchField) {
    where.researchField = { contains: filters.researchField, mode: 'insensitive' }
  }

  if (filters.degreeLevel && filters.degreeLevel.length > 0) {
    where.degreeLevel = { in: filters.degreeLevel as any[] }
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
    where.currentCity = { contains: filters.currentCity, mode: 'insensitive' }
  }

  if (filters.currentSector && filters.currentSector.length > 0) {
    where.currentSector = { in: filters.currentSector as any[] }
  }

  const [academics, total] = await Promise.all([
    prisma.academic.findMany({
      where,
      include: { dissertations: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
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
