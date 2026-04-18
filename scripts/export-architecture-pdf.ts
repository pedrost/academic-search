/**
 * Export architecture diagram to PDF using Playwright.
 * Usage: npx tsx scripts/export-architecture-pdf.ts
 */

import { chromium } from 'playwright'
import path from 'path'

const URL = process.env.BRAINSTORM_URL ?? 'http://localhost:59035'
const OUTPUT = path.resolve('docs/architecture.pdf')

async function main() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  console.log(`Opening ${URL}...`)
  await page.goto(URL, { waitUntil: 'networkidle' })

  // Wait for Mermaid to finish rendering
  await page.waitForSelector('.mermaid svg', { timeout: 15000 })
  await page.waitForTimeout(1500) // let fonts settle

  console.log(`Saving PDF to ${OUTPUT}...`)
  await page.pdf({
    path: OUTPUT,
    format: 'A3',
    landscape: true,
    printBackground: true,
    margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' },
  })

  await browser.close()
  console.log(`Done: ${OUTPUT}`)
}

main().catch(err => { console.error(err); process.exit(1) })
