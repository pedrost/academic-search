/**
 * LinkedIn Authentication Helper
 *
 * Manages LinkedIn session cookies for the enrichment worker.
 */

import { redis } from '@/lib/queue'

const COOKIES_KEY = 'linkedin:cookies'

/**
 * Check if we have saved LinkedIn cookies
 */
export async function hasSavedCookies(): Promise<boolean> {
  const cookies = await redis.get(COOKIES_KEY)
  return cookies !== null && cookies !== ''
}

/**
 * Save LinkedIn cookies to Redis
 */
export async function saveCookies(cookies: string): Promise<void> {
  await redis.set(COOKIES_KEY, cookies)
}

/**
 * Get saved LinkedIn cookies
 */
export async function getCookies(): Promise<string | null> {
  return redis.get(COOKIES_KEY)
}

/**
 * Clear saved LinkedIn cookies
 */
export async function clearCookies(): Promise<void> {
  await redis.del(COOKIES_KEY)
}
