/**
 * Tiered Enrichment Worker
 *
 * Processes `tiered-enrich` jobs from the enrichment queue.
 * Routes each job to FREE / API / AI tier based on job data.
 * Concurrency = 1 to avoid ban-triggering parallel LinkedIn requests.
 */

import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { routeEnrichment, type TieredEnrichJobData } from '@/lib/enrichment/tier-router'
import { logWorkerActivity } from '@/lib/worker-logger'

const enrichmentWorker = new Worker(
  'enrichment',
  async (job) => {
    if (job.name !== 'tiered-enrich') return // other job types handled by linkedin-worker

    const data = job.data as TieredEnrichJobData
    const { academicId, tier, context } = data

    await logWorkerActivity('enrichment', 'info', `[${tier}] Starting enrichment for ${context.name ?? academicId}`)

    try {
      const result = await routeEnrichment(data)

      const level = result.success ? 'success' : result.enrichmentStatus === 'PARTIAL' ? 'info' : 'error'
      await logWorkerActivity(
        'enrichment',
        level,
        `[${tier}] ${context.name ?? academicId}: ${result.enrichmentStatus} | sources: ${result.sources.join(', ') || 'none'} | ${(result.durationMs / 1000).toFixed(1)}s`
      )

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await logWorkerActivity('enrichment', 'error', `[${tier}] Failed for ${context.name ?? academicId}: ${msg}`)
      throw err
    }
  },
  {
    connection,
    concurrency: 1,
  }
)

enrichmentWorker.on('failed', async (job, err) => {
  await logWorkerActivity('enrichment', 'error', `Job ${job?.id} failed: ${err.message}`)
})

enrichmentWorker.on('error', async (err) => {
  await logWorkerActivity('enrichment', 'error', `Worker error: ${err.message}`)
})

export default enrichmentWorker
