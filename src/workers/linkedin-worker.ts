import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { searchLinkedIn, extractProfileDetails, enrichAcademicFromLinkedIn } from '@/lib/scrapers/linkedin'
import { prisma } from '@/lib/db'
import { hasSavedCookies } from '@/lib/scrapers/linkedin-auth'
import { logWorkerActivity } from '@/lib/worker-logger'
import { shouldWorkerRun } from '@/lib/worker-control'

const BATCH_SIZE = 10
const DELAY_BETWEEN_PROFILES = 5000 // 5 seconds between each profile enrichment

async function processLinkedInEnrichment() {
  // Check if worker should run
  const shouldRun = await shouldWorkerRun('linkedin')
  if (!shouldRun) {
    await logWorkerActivity('linkedin', 'info', '⏸️  Worker is paused, skipping batch')
    return
  }

  // Check if we have authentication
  const hasAuth = await hasSavedCookies()
  if (!hasAuth) {
    await logWorkerActivity('linkedin', 'error', '❌ No saved cookies found. Please authenticate via admin panel.')
    return
  }

  await logWorkerActivity('linkedin', 'info', '🚀 Starting LinkedIn enrichment batch...')

  // Get total count first
  const totalPending = await prisma.academic.count({
    where: {
      OR: [
        { enrichmentStatus: 'NONE' },
        { enrichmentStatus: 'PARTIAL' },
      ],
      linkedinUrl: null,
    },
  })

  await logWorkerActivity('linkedin', 'info', `📊 Found ${totalPending} total academics needing enrichment`)

  // Get academics that need enrichment (no LinkedIn data yet)
  const academics = await prisma.academic.findMany({
    where: {
      OR: [
        { enrichmentStatus: 'NONE' },
        { enrichmentStatus: 'PARTIAL' },
      ],
      linkedinUrl: null,
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  })

  if (academics.length === 0) {
    await logWorkerActivity('linkedin', 'info', '✅ No academics to enrich in this batch')
    return
  }

  await logWorkerActivity('linkedin', 'info', `🎯 Processing ${academics.length} academics in this batch`)

  let successCount = 0
  let failCount = 0
  let currentIndex = 0

  for (const academic of academics) {
    currentIndex++

    // Check if worker should continue running
    const shouldContinue = await shouldWorkerRun('linkedin')
    if (!shouldContinue) {
      await logWorkerActivity('linkedin', 'info', '⏸️  Worker paused during batch, stopping')
      break
    }

    await logWorkerActivity('linkedin', 'info', `\n[${currentIndex}/${academics.length}] 👤 Processing: ${academic.name}`)
    await logWorkerActivity('linkedin', 'info', `    🏛️  Institution: ${academic.institution || 'N/A'}`)
    await logWorkerActivity('linkedin', 'info', `    🎓 Degree: ${academic.degreeLevel} (${academic.graduationYear || 'unknown year'})`)

    try {
      // Search for the academic on LinkedIn
      const searchQuery = `${academic.name} ${academic.institution || ''}`
      await logWorkerActivity('linkedin', 'info', `    🔍 Searching LinkedIn for: "${searchQuery}"`)

      const startTime = Date.now()
      const profiles = await searchLinkedIn(searchQuery)
      const searchDuration = Date.now() - startTime

      await logWorkerActivity('linkedin', 'info', `    ⏱️  Search completed in ${searchDuration}ms`)

      if (profiles.length === 0) {
        await logWorkerActivity('linkedin', 'info', `    ⚠️  No LinkedIn profiles found for ${academic.name}`)
        await prisma.academic.update({
          where: { id: academic.id },
          data: { enrichmentStatus: 'NONE' },
        })
        failCount++
        continue
      }

      await logWorkerActivity('linkedin', 'info', `    ✨ Found ${profiles.length} potential matches on LinkedIn`)

      // Take the first match (in production, we'd want better matching logic)
      const profile = profiles[0]
      await logWorkerActivity('linkedin', 'info', `    🎯 Best match: ${profile.name}`)
      await logWorkerActivity('linkedin', 'info', `    📍 Location: ${profile.location || 'N/A'}`)
      await logWorkerActivity('linkedin', 'info', `    💼 Headline: ${profile.headline || 'N/A'}`)
      await logWorkerActivity('linkedin', 'info', `    🔗 Profile URL: ${profile.profileUrl}`)

      // Extract detailed profile information
      await logWorkerActivity('linkedin', 'info', `    📥 Extracting detailed profile information...`)
      const detailsStartTime = Date.now()
      const details = await extractProfileDetails(profile.profileUrl)
      const detailsDuration = Date.now() - detailsStartTime

      await logWorkerActivity('linkedin', 'info', `    ⏱️  Details extracted in ${detailsDuration}ms`)

      if (details.currentTitle || details.currentCompany) {
        await logWorkerActivity('linkedin', 'info', `    💼 Current Position: ${details.currentTitle || 'N/A'} at ${details.currentCompany || 'N/A'}`)
      } else {
        await logWorkerActivity('linkedin', 'info', `    ⚠️  No current employment information found`)
      }

      // Enrich the academic record
      await logWorkerActivity('linkedin', 'info', `    💾 Saving to database...`)
      await enrichAcademicFromLinkedIn(academic.id, {
        ...profile,
        ...details,
      })

      await logWorkerActivity('linkedin', 'success', `    ✅ Successfully enriched ${academic.name}!`)
      successCount++

      // Delay between profiles to avoid rate limiting
      await logWorkerActivity('linkedin', 'info', `    ⏳ Waiting ${DELAY_BETWEEN_PROFILES/1000}s before next profile...`)
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PROFILES))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : ''
      await logWorkerActivity('linkedin', 'error', `    ❌ Error enriching ${academic.name}: ${errorMsg}`)
      if (errorStack) {
        await logWorkerActivity('linkedin', 'error', `    📚 Stack trace: ${errorStack.split('\n')[0]}`)
      }

      // Mark as failed but continue with next academic
      await prisma.academic.update({
        where: { id: academic.id },
        data: { enrichmentStatus: 'NONE' },
      })
      failCount++
    }
  }

  await logWorkerActivity('linkedin', 'success', `\n🎉 Batch complete! Success: ${successCount} | Failed: ${failCount} | Remaining: ${totalPending - successCount - failCount}`)
}

// Create the worker
const linkedInWorker = new Worker(
  'enrichment',
  async (job) => {
    if (job.name === 'linkedin-enrich') {
      await processLinkedInEnrichment()
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
