import { scraperQueue, enrichmentQueue } from './index'
import type { TieredEnrichJobData } from '@/lib/enrichment/tier-router'

export type SucupiraJobData = {
  institution: string
  page?: number
}

export type LinkedInJobData = {
  academicId: string
  name: string
  institution?: string
}

export type CaptchaSolvedData = {
  taskId: string
  solution: string
}

export async function queueSucupiraScrape(data: SucupiraJobData) {
  return scraperQueue.add('sucupira-scrape', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}

export async function queueLinkedInEnrichment(data: LinkedInJobData) {
  return enrichmentQueue.add('linkedin-enrich', data, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
  })
}

export async function queueCaptchaSolved(data: CaptchaSolvedData) {
  return enrichmentQueue.add('captcha-solved', data, {
    priority: 1,
  })
}

export async function queueTieredEnrich(data: TieredEnrichJobData) {
  return enrichmentQueue.add('tiered-enrich', data, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 15000 },
    // Spread jobs to avoid hammering LinkedIn/Lattes
    delay: 0,
  })
}
