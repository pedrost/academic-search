import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const scraperQueue = new Queue('scraper', { connection })

export const enrichmentQueue = new Queue('enrichment', { connection })

export { connection }
export type { Job }
