/**
 * Manual Worker Execution API
 *
 * Directly executes scraper services without requiring BullMQ workers to be running.
 * Progress is logged to worker activity logs for display in admin UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logWorkerActivity } from '@/lib/worker-logger'
import { runSucupiraScrape } from '@/services/scrapers/sucupira-scraper'
import { runBdtdScrape } from '@/services/scrapers/bdtd-scraper'
import { runUfmsScrape } from '@/services/scrapers/ufms-scraper'
import { runLinkedinEnrichment } from '@/services/scrapers/linkedin-scraper'

type WorkerName = 'sucupira' | 'bdtd' | 'ufms' | 'linkedin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worker } = body as { worker: WorkerName }

    if (!worker || !['sucupira', 'bdtd', 'ufms', 'linkedin'].includes(worker)) {
      return NextResponse.json(
        { error: 'Invalid worker. Use "sucupira", "bdtd", "ufms", or "linkedin"' },
        { status: 400 }
      )
    }

    await logWorkerActivity(worker, 'info', '▶️  Manual execution started')

    let result

    switch (worker) {
      case 'sucupira':
        result = await runSucupiraScrape({
          onProgress: (msg) => logWorkerActivity('sucupira', 'info', msg)
        })
        break

      case 'bdtd':
        result = await runBdtdScrape({
          onProgress: (msg) => logWorkerActivity('bdtd', 'info', msg)
        })
        break

      case 'ufms':
        result = await runUfmsScrape({
          onProgress: (msg) => logWorkerActivity('ufms', 'info', msg)
        })
        break

      case 'linkedin':
        result = await runLinkedinEnrichment({
          onProgress: (msg) => logWorkerActivity('linkedin', 'info', msg)
        })
        break
    }

    const message = result.success
      ? `${worker} scrape completed successfully`
      : `${worker} scrape completed with errors`

    await logWorkerActivity(
      worker,
      result.success ? 'success' : 'error',
      `✅ Manual execution complete: ${result.totalCreated} created, ${result.totalSkipped} skipped, ${result.totalErrors} errors`
    )

    return NextResponse.json({
      success: result.success,
      message,
      result
    })

  } catch (error) {
    console.error('Manual worker execution error:', error)
    return NextResponse.json(
      { error: 'Failed to execute worker', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
