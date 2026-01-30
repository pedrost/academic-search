import { chromium } from 'playwright'

async function takeScreenshots() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const screenshotDir = '/private/tmp/claude-501/-Users-pedro-projects-academic-search/d71a1d7e-ea7f-42fc-b28d-e50a9a6a59de/scratchpad'

  // Home page
  console.log('Taking screenshot of home page...')
  await page.goto('http://localhost:3000')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${screenshotDir}/home.png`, fullPage: true })

  // Look for "Carla" which has LinkedIn in seed data
  console.log('Searching for Carla (has LinkedIn)...')
  const searchInput = await page.$('input[placeholder*="agricultura"]')
  if (searchInput) {
    await searchInput.fill('Carla')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${screenshotDir}/search-carla.png`, fullPage: true })
  }

  // Find link to Carla's profile
  const carlaLink = await page.$('a[href*="/academic/"]')
  if (carlaLink) {
    const href = await carlaLink.getAttribute('href')
    const academicId = href?.split('/academic/')[1]
    console.log('Found academic ID:', academicId)

    // Academic detail page - Overview tab
    await page.goto(`http://localhost:3000/academic/${academicId}`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${screenshotDir}/academic-overview.png`, fullPage: true })

    // Timeline tab
    console.log('Taking Timeline tab...')
    await page.click('button:has-text("Timeline")')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${screenshotDir}/academic-timeline.png`, fullPage: true })

    // Publications tab
    console.log('Taking Publications tab...')
    await page.click('button:has-text("Publicações")')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${screenshotDir}/academic-publications.png`, fullPage: true })

    // Enrichment tab
    console.log('Taking Enrichment tab...')
    await page.click('button:has-text("Enriquecimento")')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${screenshotDir}/academic-enrichment.png`, fullPage: true })
  }

  await browser.close()
  console.log('Done!')
}

takeScreenshots().catch(console.error)
