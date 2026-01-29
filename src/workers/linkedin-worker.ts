import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { runLinkedinEnrichment } from '@/services/scrapers/linkedin-scraper'
import { logWorkerActivity } from '@/lib/worker-logger'
import { shouldWorkerRun } from '@/lib/worker-control'

const BATCH_SIZE = 10

async function processLinkedInEnrichment() {
  // Check if worker should run
  const shouldRun = await shouldWorkerRun('linkedin')
  if (!shouldRun) {
    await logWorkerActivity('linkedin', 'info', '⏸️  Worker is paused, skipping batch')
    return
  }

  await logWorkerActivity('linkedin', 'info', '🚀 Starting LinkedIn enrichment batch...')

  // Run the LinkedIn enrichment service
  const result = await runLinkedinEnrichment({
    limit: BATCH_SIZE,
    onProgress: async (message: string) => {
      // Determine log level from message prefix
      const level = message.startsWith('❌') || message.includes('Error')
        ? 'error'
        : message.startsWith('✅') || message.includes('Successfully')
        ? 'success'
        : 'info'

      await logWorkerActivity('linkedin', level, message)
    }
  })

  // Log final result
  if (result.success) {
    await logWorkerActivity('linkedin', 'success',
      `Batch complete! Enriched: ${result.totalCreated} | Skipped: ${result.totalSkipped} | Duration: ${(result.duration / 1000).toFixed(1)}s`
    )
  } else {
    await logWorkerActivity('linkedin', 'error',
      `Batch failed! Errors: ${result.totalErrors} | Duration: ${(result.duration / 1000).toFixed(1)}s`
    )
    if (result.errorMessages) {
      result.errorMessages.forEach(async (msg) => {
        await logWorkerActivity('linkedin', 'error', `  - ${msg}`)
      })
    }
  }
}

// Create the worker
const linkedInWorker = new Worker(
  'enrichment',
  async (job) => {
    try {
      if (job.name === 'linkedin-enrich') {
        await processLinkedInEnrichment()
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      await logWorkerActivity('linkedin', 'error', `❌ Job failed: ${errorMsg}`)
      throw error // Re-throw so BullMQ marks job as failed
    }
  },
  {
    connection,
    concurrency: 1, // Process one job at a time
  }
)

linkedInWorker.on('completed', async (job) => {
  await logWorkerActivity('linkedin', 'info', `Job ${job.id} completed`)
})

linkedInWorker.on('failed', async (job, err) => {
  await logWorkerActivity('linkedin', 'error', `Job ${job?.id} failed: ${err.message}`)
})

linkedInWorker.on('error', async (err) => {
  await logWorkerActivity('linkedin', 'error', `Worker error: ${err.message}`)
})

logWorkerActivity('linkedin', 'success', 'LinkedIn worker started and ready')

export default linkedInWorker
