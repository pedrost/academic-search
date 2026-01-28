import { chromium, Browser, BrowserContext, Page } from 'playwright'

let browserInstance: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    })
  }
  return browserInstance
}

export async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Campo_Grande',
    geolocation: { latitude: -20.4697, longitude: -54.6201 },
    permissions: ['geolocation'],
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    })

    Object.defineProperty(navigator, 'languages', {
      get: () => ['pt-BR', 'pt', 'en-US', 'en'],
    })

    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters)
  })

  return context
}

export async function randomDelay(minMs: number = 1000, maxMs: number = 3000) {
  const delay = Math.random() * (maxMs - minMs) + minMs
  await new Promise((resolve) => setTimeout(resolve, delay))
}

export async function humanScroll(page: Page) {
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight)
  const viewportHeight = await page.evaluate(() => window.innerHeight)

  let currentPosition = 0
  while (currentPosition < scrollHeight - viewportHeight) {
    const scrollAmount = Math.random() * 300 + 100
    currentPosition += scrollAmount
    await page.evaluate((y) => window.scrollTo(0, y), currentPosition)
    await randomDelay(200, 500)
  }
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}
