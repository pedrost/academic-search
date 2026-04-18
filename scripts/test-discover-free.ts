/**
 * Quick test: discover an academic via FREE tier (lattes + linkedin)
 * Usage: npx tsx scripts/test-discover-free.ts "Pedro augusto sturmer"
 */

async function main() {
  const searchName = process.argv[2] || 'Pedro augusto sturmer'
  const sources = process.argv[3] || 'lattes,linkedin'
  const url = `http://localhost:3000/api/discover-academic?name=${encodeURIComponent(searchName)}&sources=${sources}`
  console.log(`\n→ GET ${url}\n`)

  const res = await fetch(url)
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`)
    process.exit(1)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith(': ping')) continue
      if (!line.startsWith('data: ')) continue

      try {
        const event = JSON.parse(line.slice(6))
        const ts = new Date().toISOString().slice(11, 19)

        if (event.phase === 'done') {
          if (event.status === 'success') {
            console.log(`[${ts}] ✓ DONE — academic: ${event.academic?.name} (id: ${event.academic?.id})`)
            console.log(`         enrichment: ${event.enrichmentSummary?.enrichmentStatus}`)
            console.log(`         sources: ${event.enrichmentSummary?.sources?.join(', ') || 'none'}`)
            console.log(`         duration: ${event.enrichmentSummary?.durationMs}ms`)
            console.log(`         lattes: ${event.academic?.lattesUrl || 'n/a'}`)
            console.log(`         linkedin: ${event.academic?.linkedinUrl || 'n/a'}`)
            console.log(`         emprego: ${event.academic?.currentJobTitle || '?'} @ ${event.academic?.currentCompany || '?'}`)
          } else {
            console.log(`[${ts}] ✗ NOT FOUND — ${event.reason}`)
          }
        } else if (event.phase === 'error') {
          console.log(`[${ts}] ✗ ERROR — ${event.message}`)
        } else {
          console.log(`[${ts}] [${event.phase}] ${event.status} — ${event.message || ''}`)
        }
      } catch {
        // skip malformed
      }
    }
  }

  console.log('\n--- done ---')
}

main().catch(err => { console.error(err); process.exit(1) })
