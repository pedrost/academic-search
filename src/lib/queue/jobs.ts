import { scraperQueue, enrichmentQueue } from './index'

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
