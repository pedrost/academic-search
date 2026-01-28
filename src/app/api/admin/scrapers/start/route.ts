import { NextRequest, NextResponse } from 'next/server'
import { scrapeSucupira } from '@/lib/scrapers/sucupira'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, institution } = body

    if (source === 'SUCUPIRA') {
      // Run in background (don't await)
      scrapeSucupira(institution || 'UFMS').catch((err) => {
        console.error('Scraper error:', err)
      })

      return NextResponse.json({
        message: 'Scraper started',
        source,
        institution,
      })
    }

    return NextResponse.json(
      { error: 'Unknown source' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error starting scraper:', error)
    return NextResponse.json(
      { error: 'Failed to start scraper' },
      { status: 500 }
    )
  }
}
