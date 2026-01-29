// Load environment variables FIRST
import 'dotenv/config'

import './linkedin-worker'
import './sucupira-worker'
import './bdtd-worker'
import './ufms-worker'
import { scraperQueue, enrichmentQueue } from '@/lib/queue'
import { setWorkerStatus } from '@/lib/worker-control'
import { logWorkerActivity } from '@/lib/worker-logger'

// Initialize workers as running
async function initializeWorkers() {
  await setWorkerStatus('sucupira', 'running')
  await setWorkerStatus('bdtd', 'running')
  await setWorkerStatus('ufms', 'running')
  await setWorkerStatus('linkedin', 'running')
  await logWorkerActivity('sucupira', 'success', 'Worker initialized')
  await logWorkerActivity('bdtd', 'success', 'Worker initialized')
  await logWorkerActivity('ufms', 'success', 'Worker initialized')
  await logWorkerActivity('linkedin', 'success', 'Worker initialized')
}

// Schedule jobs to run periodically
async function scheduleJobs() {
  // Schedule Sucupira scraper to run every 24 hours
  await scraperQueue.add(
    'sucupira-scrape',
    {},
    {
      repeat: {
        pattern: '0 2 * * *', // Run at 2 AM every day
      },
      jobId: 'sucupira-daily-scrape',
    }
  )

  // Schedule BDTD scraper to run weekly
  await scraperQueue.add(
    'bdtd-scrape',
    {},
    {
      repeat: {
        pattern: '0 3 * * 0', // Run at 3 AM every Sunday
      },
      jobId: 'bdtd-weekly-scrape',
    }
  )

  // Schedule UFMS scraper to run monthly
  await scraperQueue.add(
    'ufms-scrape',
    {},
    {
      repeat: {
        pattern: '0 4 1 * *', // Run at 4 AM on the 1st of each month
      },
      jobId: 'ufms-monthly-scrape',
    }
  )

  // Schedule LinkedIn enrichment to run every 6 hours
  await enrichmentQueue.add(
    'linkedin-enrich',
    {},
    {
      repeat: {
        pattern: '0 */6 * * *', // Run every 6 hours
      },
      jobId: 'linkedin-enrichment',
    }
  )

  console.log('Worker scheduler: Jobs scheduled')
  console.log('- Sucupira scraper: Daily at 2 AM')
  console.log('- BDTD scraper: Weekly on Sundays at 3 AM')
  console.log('- UFMS scraper: Monthly on the 1st at 4 AM')
  console.log('- LinkedIn enrichment: Every 6 hours')
}

// Start everything
async function start() {
  await initializeWorkers()
  await scheduleJobs()
  console.log('Worker system ready')
}

start().catch((error) => {
  console.error('Worker scheduler error:', error)
  process.exit(1)
})

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Worker scheduler: Shutting down...')
  await setWorkerStatus('sucupira', 'stopped')
  await setWorkerStatus('bdtd', 'stopped')
  await setWorkerStatus('ufms', 'stopped')
  await setWorkerStatus('linkedin', 'stopped')
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('Worker scheduler: Shutting down...')
  await setWorkerStatus('sucupira', 'stopped')
  await setWorkerStatus('bdtd', 'stopped')
  await setWorkerStatus('ufms', 'stopped')
  await setWorkerStatus('linkedin', 'stopped')
  process.exit(0)
})
