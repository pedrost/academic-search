import { NextResponse } from 'next/server'
import { getActiveScrapers, getScraperSessions } from '@/lib/db/scrapers'

export async function GET() {
  try {
    const [active, recent] = await Promise.all([
      getActiveScrapers(),
      getScraperSessions(),
    ])

    return NextResponse.json({ active, recent })
  } catch (error) {
    console.error('Error fetching scrapers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scrapers' },
      { status: 500 }
    )
  }
}
