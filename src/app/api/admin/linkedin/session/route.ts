export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  initLinkedInSession,
  openLoginBrowser,
  checkLinkedInLoginStatus,
  closeLinkedInSession,
} from '@/lib/scrapers/linkedin'
import { hasSavedCookies } from '@/lib/scrapers/linkedin-auth'

export async function GET() {
  try {
    const isLoggedIn = await checkLinkedInLoginStatus()
    return NextResponse.json({ isLoggedIn, hasCookies: hasSavedCookies() })
  } catch {
    return NextResponse.json({ isLoggedIn: false, hasCookies: hasSavedCookies() })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'start') {
      // Admin-initiated: open browser for manual login (ignores saved cookies)
      await openLoginBrowser()
      const isLoggedIn = await checkLinkedInLoginStatus()
      return NextResponse.json({ message: 'Browser opened for login', isLoggedIn })
    }

    if (action === 'resume') {
      // Use saved cookies (for enrichment session reuse)
      const result = await initLinkedInSession()
      if ('isLoggedIn' in result) {
        return NextResponse.json({ message: 'No saved cookies', isLoggedIn: false })
      }
      const isLoggedIn = await checkLinkedInLoginStatus()
      return NextResponse.json({ message: 'Session resumed', isLoggedIn })
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
