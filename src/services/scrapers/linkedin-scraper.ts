/**
 * LinkedIn Enrichment Service
 *
 * Enriches academic profiles with LinkedIn employment data.
 */

import { prisma } from '@/lib/db'
import {
  initLinkedInSession,
  checkLinkedInLoginStatus,
  searchLinkedIn,
  extractProfileDetails,
  enrichAcademicFromLinkedIn
} from '@/lib/scrapers/linkedin'
import type { ScraperOptions, ScraperResult } from './types'

/**
 * Run LinkedIn enrichment for pending academics
 */
export async function runLinkedinEnrichment(
  options?: ScraperOptions
): Promise<ScraperResult> {
  const startTime = Date.now()
  let totalCreated = 0
  let totalSkipped = 0
  let totalErrors = 0
  const errorMessages: string[] = []

  const limit = options?.limit || 10
  const onProgress = options?.onProgress

  try {
    onProgress?.('🚀 Starting LinkedIn enrichment')

    // Initialize LinkedIn session
    const { page, isNew } = await initLinkedInSession()

    if (isNew) {
      onProgress?.('🌐 LinkedIn session initialized')
    }

    // Check authentication
    const isLoggedIn = await checkLinkedInLoginStatus()
    if (!isLoggedIn) {
      errorMessages.push('Not logged in to LinkedIn')
      onProgress?.('❌ Not logged in to LinkedIn. Please authenticate via admin panel.')
      return {
        success: false,
        totalCreated: 0,
        totalSkipped: 0,
        totalErrors: 1,
        duration: Date.now() - startTime,
        errorMessages
      }
    }

    // Find academics pending enrichment
    const academics = await prisma.academic.findMany({
      where: {
        OR: [
          { enrichmentStatus: 'PENDING' },
          { enrichmentStatus: 'PARTIAL' },
        ],
        linkedinUrl: null,
      },
      take: limit,
      orderBy: { createdAt: 'asc' }
    })

    onProgress?.(`👥 Found ${academics.length} academics to enrich`)

    if (academics.length === 0) {
      onProgress?.('ℹ️  No pending academics')
      return {
        success: true,
        totalCreated: 0,
        totalSkipped: 0,
        totalErrors: 0,
        duration: Date.now() - startTime
      }
    }

    for (let i = 0; i < academics.length; i++) {
      const academic = academics[i]

      if (options?.signal?.aborted) {
        onProgress?.('⏸️  Cancelled')
        break
      }

      onProgress?.(`\n[${i + 1}/${academics.length}] 👤 Processing: ${academic.name}`)
      onProgress?.(`    🏛️  Institution: ${academic.institution || 'N/A'}`)
      onProgress?.(`    🎓 Degree: ${academic.degreeLevel} (${academic.graduationYear || 'unknown year'})`)

      try {
        // Search LinkedIn for profile
        const searchQuery = `${academic.name} ${academic.institution || ''}`
        onProgress?.(`    🔍 Searching LinkedIn for: "${searchQuery}"`)

        const profiles = await searchLinkedIn(searchQuery)

        if (profiles.length === 0) {
          totalSkipped++
          onProgress?.(`    ⚠️  No LinkedIn profiles found for ${academic.name}`)
          await prisma.academic.update({
            where: { id: academic.id },
            data: { enrichmentStatus: 'PENDING' },
          })
          continue
        }

        onProgress?.(`    ✨ Found ${profiles.length} potential matches on LinkedIn`)

        // Take the first match (best match)
        const profile = profiles[0]
        onProgress?.(`    🎯 Best match: ${profile.name}`)
        onProgress?.(`    📍 Location: ${profile.location || 'N/A'}`)
        onProgress?.(`    💼 Headline: ${profile.headline || 'N/A'}`)
        onProgress?.(`    🔗 Profile URL: ${profile.profileUrl}`)

        // Extract detailed profile information
        onProgress?.(`    📥 Extracting detailed profile information...`)
        const details = await extractProfileDetails(profile.profileUrl)

        if (details.currentTitle || details.currentCompany) {
          onProgress?.(`    💼 Current Position: ${details.currentTitle || 'N/A'} at ${details.currentCompany || 'N/A'}`)
        } else {
          onProgress?.(`    ⚠️  No current employment information found`)
        }

        // Enrich the academic record
        onProgress?.(`    💾 Saving to database...`)
        await enrichAcademicFromLinkedIn(academic.id, {
          ...profile,
          ...details,
        })

        totalCreated++
        onProgress?.(`    ✅ Successfully enriched ${academic.name}!`)

        // Rate limiting - delay between profiles
        onProgress?.(`    ⏳ Waiting 5s before next profile...`)
        await new Promise(resolve => setTimeout(resolve, 5000))

      } catch (error: any) {
        totalErrors++
        const errorMsg = `${academic.name}: ${error.message}`
        errorMessages.push(errorMsg)
        onProgress?.(`    ❌ ${errorMsg}`)

        // Mark as pending so it can be retried
        await prisma.academic.update({
          where: { id: academic.id },
          data: { enrichmentStatus: 'PENDING' },
        })
      }
    }

    onProgress?.(`\n🎉 Complete: ${totalCreated} enriched, ${totalSkipped} skipped, ${totalErrors} errors`)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown'
    totalErrors++
    errorMessages.push(errorMsg)
    onProgress?.(`❌ Fatal: ${errorMsg}`)
  }

  return {
    success: totalErrors === 0,
    totalCreated,
    totalSkipped,
    totalErrors,
    duration: Date.now() - startTime,
    errorMessages: totalErrors > 0 ? errorMessages : undefined
  }
}
