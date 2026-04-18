export const dynamic = 'force-dynamic'
export const maxDuration = 600 // 10 min max for long scrapes

import { NextRequest } from 'next/server'
import { runSucupiraScrape } from '@/services/scrapers/sucupira-scraper'
import { runBdtdScrape } from '@/services/scrapers/bdtd-scraper'
import { runUfmsScrape } from '@/services/scrapers/ufms-scraper'

type WorkerName = 'sucupira' | 'bdtd' | 'ufms'

const WORKERS: Record<WorkerName, (opts: { onProgress: (msg: string) => void; signal: AbortSignal }) => Promise<unknown>> = {
  sucupira: runSucupiraScrape,
  bdtd: runBdtdScrape,
  ufms: runUfmsScrape,
}

export async function POST(request: NextRequest) {
  const { worker, limit, dryRun } = await request.json() as { worker: WorkerName; limit?: number; dryRun?: boolean }

  if (!WORKERS[worker]) {
    return new Response(JSON.stringify({ error: 'Invalid worker' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const abortController = new AbortController()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // client disconnected
        }
      }

      send({ type: 'start', worker })

      try {
        const result = await WORKERS[worker]({
          onProgress: (msg: string) => send({ type: 'log', msg }),
          signal: abortController.signal,
          ...(limit ? { limit } : {}),
          ...(dryRun ? { dryRun } : {}),
        })
        send({ type: 'done', result })
      } catch (err) {
        send({ type: 'error', msg: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
    cancel() {
      abortController.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
