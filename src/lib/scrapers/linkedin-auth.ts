/**
 * LinkedIn session cookie persistence.
 * Stores cookies to disk so sessions survive server restarts.
 * Admin must log in once via /admin/browser; cookies are then reused automatically.
 */

import fs from 'fs'
import path from 'path'

const COOKIES_PATH = path.join(process.cwd(), 'data', 'linkedin-cookies.json')

export type CookieRecord = {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export function hasSavedCookies(): boolean {
  try {
    return fs.existsSync(COOKIES_PATH) && fs.statSync(COOKIES_PATH).size > 10
  } catch {
    return false
  }
}

export function loadCookies(): CookieRecord[] {
  try {
    return JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'))
  } catch {
    return []
  }
}

export function saveCookies(cookies: CookieRecord[]): void {
  fs.mkdirSync(path.dirname(COOKIES_PATH), { recursive: true })
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2))
}

export function clearCookies(): void {
  try { fs.unlinkSync(COOKIES_PATH) } catch { /* already gone */ }
}
