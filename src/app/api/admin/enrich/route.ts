export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/enrich
 *
 * Queues a batch of academics for tiered enrichment.
 * Streams progress via SSE.
 *
 * Body:
 *   tier: "FREE" | "API" | "AI"
 *   target: "all" | "pending" | string[]   (array = specific academic IDs)
 *   filters?: { state?, city?, institution? }
 *   limit?: number  (default 100)
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { queueTieredEnrich } from '@/lib/queue/jobs'
import { estimateCost, estimateSecondsPerAcademic, type EnrichmentTier } from '@/lib/enrichment/tier-router'

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { tier: rawTier, target, filters = {}, limit = 100 } = body

  const tier = (String(rawTier ?? 'FREE').toUpperCase()) as EnrichmentTier
  if (!['FREE', 'API', 'AI'].includes(tier)) {
    return new Response(JSON.stringify({ error: 'tier must be FREE, API, or AI' }), { status: 400 })
  }
  if (!target) {
    return new Response(JSON.stringify({ error: 'target required: "all" | "pending" | ["id1",...]' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      function send(event: Record<string, unknown>) {
        if (closed) return
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)) } catch { closed = true }
      }

      const keepAlive = setInterval(() => {
        if (closed) { clearInterval(keepAlive); return }
        try { controller.enqueue(encoder.encode(': ping\n\n')) } catch { closed = true; clearInterval(keepAlive) }
      }, 15000)

      try {
        // ── Resolve target academic IDs ──────────────────────────────
        let academicIds: string[]

        if (Array.isArray(target)) {
          academicIds = target.slice(0, limit)
        } else {
          const where: Record<string, any> = {}
          if (target === 'pending') {
            where.OR = [{ enrichmentStatus: 'PENDING' }, { enrichmentStatus: 'PARTIAL' }]
          }
          if (filters.state) where.currentState = filters.state
          if (filters.city) where.currentCity = { contains: filters.city, mode: 'insensitive' }
          if (filters.institution) where.institution = { contains: filters.institution, mode: 'insensitive' }

          const academics = await prisma.academic.findMany({
            where,
            select: { id: true, name: true },
            take: limit,
            orderBy: { createdAt: 'asc' },
          })
          academicIds = academics.map(a => a.id)
        }

        const total = academicIds.length
        const timeEst = estimateSecondsPerAcademic(tier)
        const estimatedSeconds = Math.round((timeEst.min + timeEst.max) / 2) * total

        send({
          phase: 'queued',
          count: total,
          tier,
          estimatedCost: estimateCost(tier, total),
          estimatedTimeSeconds: estimatedSeconds,
          estimatedTimeLabel: formatDuration(estimatedSeconds),
        })

        // ── Queue jobs ───────────────────────────────────────────────
        let queued = 0
        for (const academicId of academicIds) {
          await queueTieredEnrich({
            academicId,
            tier,
            context: {
              state: filters.state ?? null,
              city: filters.city ?? null,
              institution: filters.institution ?? null,
            },
          })
          queued++

          // Send progress every 50 jobs queued
          if (queued % 50 === 0) {
            send({ phase: 'queuing', queued, total })
          }
        }

        send({
          phase: 'done',
          queued: total,
          tier,
          estimatedCost: estimateCost(tier, total),
          message: `${total} academics queued for ${tier} enrichment. Jobs are processed by the enrichment worker.`,
        })
      } catch (err) {
        send({ phase: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      } finally {
        clearInterval(keepAlive)
        if (!closed) { try { controller.close() } catch { /* already closed */ } }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`
  if (seconds < 3600) return `~${Math.round(seconds / 60)}min`
  if (seconds < 86400) return `~${(seconds / 3600).toFixed(1)}h`
  return `~${(seconds / 86400).toFixed(1)} days`
}
