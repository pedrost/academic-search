export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getBrowser, createStealthContext } from '@/lib/scrapers/browser'
import { hasCnpqSession, saveCnpqCookies, clearCnpqSession } from '@/lib/scrapers/lattes'
import type { BrowserContext, Page } from 'playwright'

let cnpqContext: BrowserContext | null = null
let cnpqPage: Page | null = null

export async function GET() {
  const hasCookies = hasCnpqSession()
  let isOpen = false
  try {
    if (cnpqPage) {
      await cnpqPage.title()
      isOpen = true
    }
  } catch { cnpqPage = null }

  return NextResponse.json({ hasCookies, isOpen })
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()

    if (action === 'start') {
      const browser = await getBrowser()
      cnpqContext = await createStealthContext(browser)

      // Load saved cookies if any
      if (hasCnpqSession()) {
        const { loadCnpqCookies } = await import('@/lib/scrapers/lattes')
        const cookies = loadCnpqCookies()
        if (cookies.length > 0) await cnpqContext.addCookies(cookies)
      }

      cnpqPage = await cnpqContext.newPage()
      // Navigate to the CAPTCHA page so admin can solve it
      await cnpqPage.goto(
        'http://buscatextual.cnpq.br/buscatextual/visualizacv.do?metodo=apresentar&id=K4796434D8',
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      )

      return NextResponse.json({ message: 'Browser aberto — resolva o CAPTCHA na janela' })
    }

    if (action === 'save') {
      // Save cookies after admin solved CAPTCHA
      if (cnpqContext) {
        const cookies = await cnpqContext.cookies()
        saveCnpqCookies(cookies)
        return NextResponse.json({ message: 'Cookies salvos', count: cookies.length })
      }
      return NextResponse.json({ error: 'Nenhum browser aberto' }, { status: 400 })
    }

    if (action === 'stop') {
      // Save cookies before closing
      if (cnpqContext) {
        const cookies = await cnpqContext.cookies()
        saveCnpqCookies(cookies)
        try { await cnpqPage?.close() } catch { /* ignore */ }
        try { await cnpqContext.close() } catch { /* ignore */ }
      }
      cnpqPage = null
      cnpqContext = null
      return NextResponse.json({ message: 'Browser fechado, cookies salvos' })
    }

    if (action === 'clear') {
      clearCnpqSession()
      return NextResponse.json({ message: 'Sessão CNPq removida' })
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
