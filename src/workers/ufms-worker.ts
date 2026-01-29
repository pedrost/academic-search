import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { logWorkerActivity } from '@/lib/worker-logger'
import { shouldWorkerRun } from '@/lib/worker-control'
import { runUfmsScrape } from '@/services/scrapers/ufms-scraper'

async function processUFMSScrape() {
  const shouldRun = await shouldWorkerRun('ufms')
  if (!shouldRun) {
    await logWorkerActivity('ufms', 'info', '⏸️  Worker is paused')
    return
  }

  await logWorkerActivity('ufms', 'success', '🚀 Starting UFMS repository scrape')

  const result = await runUfmsScrape({
    onProgress: (msg) => {
      logWorkerActivity('ufms', 'info', msg)
    }
  })

  if (result.success) {
    await logWorkerActivity('ufms', 'success', `\n🎉 UFMS scraping complete!`)
    await logWorkerActivity('ufms', 'success', `   📊 New: ${result.totalCreated}`)
    await logWorkerActivity('ufms', 'success', `   ⏭️  Skipped: ${result.totalSkipped}`)
    await logWorkerActivity('ufms', 'success', `   ⏱️  Duration: ${result.duration}ms`)
  } else {
    await logWorkerActivity('ufms', 'error', `❌ Scraping failed`)
    if (result.errorMessages) {
      for (const error of result.errorMessages) {
        await logWorkerActivity('ufms', 'error', `   ${error}`)
      }
    }
  }
}

const ufmsWorker = new Worker(
  'scraper',
  async (job) => {
    try {
      await logWorkerActivity('ufms', 'info', `📥 Received job: ${job.name} (ID: ${job.id})`)

      if (job.name === 'ufms-scrape') {
        await logWorkerActivity('ufms', 'success', '✅ Starting UFMS scrape job...')
        await processUFMSScrape()
      } else {
        await logWorkerActivity('ufms', 'info', `⏭️  Ignoring job: ${job.name} (not for UFMS)`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      await logWorkerActivity('ufms', 'error', `❌ Job failed: ${errorMsg}`)
      throw error // Re-throw so BullMQ marks job as failed
    }
  },
  { connection, concurrency: 1 }
)

ufmsWorker.on('completed', async (job) => {
  await logWorkerActivity('ufms', 'info', `✓ Job ${job.id} done`)
})

ufmsWorker.on('failed', async (job, err) => {
  await logWorkerActivity('ufms', 'error', `✗ Job ${job?.id} failed: ${err.message}`)
})

process.on('SIGTERM', async () => {
  await ufmsWorker.close()
})

logWorkerActivity('ufms', 'success', 'UFMS worker ready (Universidade Federal de MS)')

export default ufmsWorker
