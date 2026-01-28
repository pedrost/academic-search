import { NextRequest, NextResponse } from 'next/server'
import {
  initLinkedInSession,
  checkLinkedInLoginStatus,
  closeLinkedInSession,
} from '@/lib/scrapers/linkedin'

export async function GET() {
  try {
    const isLoggedIn = await checkLinkedInLoginStatus()
    return NextResponse.json({ isLoggedIn })
  } catch (error) {
    return NextResponse.json({ isLoggedIn: false })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'start') {
      const { isNew } = await initLinkedInSession()
      const isLoggedIn = await checkLinkedInLoginStatus()
      return NextResponse.json({
        message: isNew ? 'Session started' : 'Session already active',
        isLoggedIn,
      })
    }

    if (action === 'stop') {
      await closeLinkedInSession()
      return NextResponse.json({ message: 'Session closed' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('LinkedIn session error:', error)
    return NextResponse.json(
      { error: 'Session operation failed' },
      { status: 500 }
    )
  }
}
