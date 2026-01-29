// Quick test script to trigger BDTD worker
import 'dotenv/config'
import { scraperQueue } from './src/lib/queue'

async function test() {
  console.log('Triggering BDTD worker...')

  const job = await scraperQueue.add('bdtd-scrape', {}, {
    attempts: 1,
  })

  console.log(`Job ${job.id} queued!`)
  console.log('Check the worker logs to see progress')
  console.log('Log file: logs/bdtd-worker-detailed.txt')

  process.exit(0)
}

test()
