import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { logWorkerActivity } from '@/lib/worker-logger'
import { shouldWorkerRun } from '@/lib/worker-control'
import { runSucupiraScrape } from '@/services/scrapers/sucupira-scraper'

async function processSucupiraScrape() {
  const shouldRun = await shouldWorkerRun('sucupira')
  if (!shouldRun) {
    await logWorkerActivity('sucupira', 'info', '⏸️  Worker is paused')
    return
  }

  const result = await runSucupiraScrape({
    onProgress: (msg) => logWorkerActivity('sucupira', 'info', msg)
  })

  if (result.success) {
    await logWorkerActivity('sucupira', 'success',
      `Complete: ${result.totalCreated} new, ${result.totalSkipped} skipped`
    )
  } else {
    await logWorkerActivity('sucupira', 'error',
      `Completed with errors: ${result.totalErrors} errors`
    )
  }
}

const sucupiraWorker = new Worker(
  'scraper',
  async (job) => {
    try {
      await logWorkerActivity('sucupira', 'info', `📥 Received job: ${job.name} (ID: ${job.id})`)

      if (job.name === 'sucupira-scrape') {
        await logWorkerActivity('sucupira', 'success', '✅ Starting Sucupira scrape job...')
        await processSucupiraScrape()
      } else {
        await logWorkerActivity('sucupira', 'info', `⏭️  Ignoring job: ${job.name} (not for Sucupira)`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      await logWorkerActivity('sucupira', 'error', `❌ Job failed: ${errorMsg}`)
      throw error // Re-throw so BullMQ marks job as failed
    }
  },
  { connection, concurrency: 1 }
)

sucupiraWorker.on('completed', async (job) => {
  await logWorkerActivity('sucupira', 'info', `✓ Job ${job.id} done`)
})

sucupiraWorker.on('failed', async (job, err) => {
  await logWorkerActivity('sucupira', 'error', `✗ Job ${job?.id} failed: ${err.message}`)
})

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  await sucupiraWorker.close()
})

logWorkerActivity('sucupira', 'success', 'Sucupira worker ready (CAPES DataStore API + Playwright)')

export default sucupiraWorker
