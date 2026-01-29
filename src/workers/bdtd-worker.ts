import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { logWorkerActivity } from '@/lib/worker-logger'
import { shouldWorkerRun } from '@/lib/worker-control'
import { runBdtdScrape } from '@/services/scrapers/bdtd-scraper'

async function processBDTDScrape() {
  const shouldRun = await shouldWorkerRun('bdtd')
  if (!shouldRun) {
    await logWorkerActivity('bdtd', 'info', '⏸️  Worker is paused')
    return
  }

  const result = await runBdtdScrape({
    onProgress: (msg) => logWorkerActivity('bdtd', 'info', msg)
  })

  if (result.success) {
    await logWorkerActivity('bdtd', 'success',
      `Complete: ${result.totalCreated} new, ${result.totalSkipped} skipped`
    )
  } else {
    await logWorkerActivity('bdtd', 'error',
      `Completed with errors: ${result.totalErrors} errors`
    )
  }
}

const bdtdWorker = new Worker(
  'scraper',
  async (job) => {
    try {
      await logWorkerActivity('bdtd', 'info', `📥 Received job: ${job.name} (ID: ${job.id})`)

      if (job.name === 'bdtd-scrape') {
        await logWorkerActivity('bdtd', 'success', '✅ Starting BDTD scrape job...')
        await processBDTDScrape()
      } else {
        await logWorkerActivity('bdtd', 'info', `⏭️  Ignoring job: ${job.name} (not for BDTD)`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      await logWorkerActivity('bdtd', 'error', `❌ Job failed: ${errorMsg}`)
      throw error // Re-throw so BullMQ marks job as failed
    }
  },
  { connection, concurrency: 1 }
)

bdtdWorker.on('completed', async (job) => {
  await logWorkerActivity('bdtd', 'info', `✓ Job ${job.id} done`)
})

bdtdWorker.on('failed', async (job, err) => {
  await logWorkerActivity('bdtd', 'error', `✗ Job ${job?.id} failed: ${err.message}`)
})

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  await bdtdWorker.close()
})

logWorkerActivity('bdtd', 'success', 'BDTD worker ready (Biblioteca Digital Brasileira)')

export default bdtdWorker
