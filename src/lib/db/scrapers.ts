import { prisma } from '@/lib/db'
import { ScraperSource, ScraperStatus } from '@prisma/client'

export async function getScraperSessions() {
  return prisma.scraperSession.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
  })
}

export async function getActiveScrapers() {
  return prisma.scraperSession.findMany({
    where: {
      status: { in: ['RUNNING', 'PAUSED', 'WAITING_INTERVENTION'] },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function createScraperSession(source: ScraperSource) {
  return prisma.scraperSession.create({
    data: { source },
  })
}

export async function updateScraperSession(
  id: string,
  data: {
    status?: ScraperStatus
    profilesScraped?: number
    tasksCreated?: number
    errors?: number
    metadata?: any
  }
) {
  return prisma.scraperSession.update({
    where: { id },
    data: {
      ...data,
      lastActivityAt: new Date(),
    },
  })
}
