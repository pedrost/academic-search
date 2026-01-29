import { NextRequest, NextResponse } from 'next/server'
import { scraperQueue, enrichmentQueue } from '@/lib/queue'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worker } = body

    if (worker === 'sucupira') {
      const job = await scraperQueue.add('sucupira-scrape', {}, { priority: 1 })
      return NextResponse.json({
        message: 'Sucupira scrape job queued',
        jobId: job.id,
      })
    }

    if (worker === 'bdtd') {
      const job = await scraperQueue.add('bdtd-scrape', {}, { priority: 1 })
      return NextResponse.json({
        message: 'BDTD scrape job queued',
        jobId: job.id,
      })
    }

    if (worker === 'ufms') {
      const job = await scraperQueue.add('ufms-scrape', {}, { priority: 1 })
      return NextResponse.json({
        message: 'UFMS scrape job queued',
        jobId: job.id,
      })
    }

    if (worker === 'linkedin') {
      const job = await enrichmentQueue.add('linkedin-enrich', {}, { priority: 1 })
      return NextResponse.json({
        message: 'LinkedIn enrichment job queued',
        jobId: job.id,
      })
    }

    return NextResponse.json(
      { error: 'Invalid worker. Use "sucupira", "bdtd", "ufms", or "linkedin"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Worker trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger worker' },
      { status: 500 }
    )
  }
}
