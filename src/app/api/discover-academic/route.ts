export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { freeTierEnrich } from '@/lib/enrichment/free-tier'
import { apiTierEnrich } from '@/lib/enrichment/api-tier'
import { aiTierEnrich } from '@/lib/enrichment/ai-tier'
import { estimateCost, type EnrichmentTier } from '@/lib/enrichment/tier-router'
import { upsertAcademic } from '@/lib/academic-upsert'

type SSEEvent =
  | { phase: 'init'; status: 'start'; message: string }
  | { phase: 'lattes' | 'linkedin' | 'serpapi' | 'proxycurl' | 'discovery' | 'enrichment'; status: 'start' | 'complete' | 'skipped'; message?: string }
  | { phase: 'done'; status: 'success'; academic: any; enrichmentSummary: any }
  | { phase: 'done'; status: 'not_found'; reason: string }
  | { phase: 'error'; status: 'error'; message: string }

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const id = params.get('id')
  const name = params.get('name')
  const tierParam = (params.get('tier') ?? 'AI').toUpperCase() as EnrichmentTier
  const state = params.get('state')
  const city = params.get('city')
  const institution = params.get('institution')

  if (!id && !name) {
    return new Response(JSON.stringify({ error: 'Provide ?id or ?name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const tier: EnrichmentTier = ['FREE', 'API', 'AI'].includes(tierParam) ? tierParam : 'AI'

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      function send(event: SSEEvent) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          closed = true
        }
      }

      const keepAlive = setInterval(() => {
        if (closed) { clearInterval(keepAlive); return }
        try { controller.enqueue(encoder.encode(': ping\n\n')) } catch { closed = true; clearInterval(keepAlive) }
      }, 15000)

      try {
        send({ phase: 'init', status: 'start', message: `Iniciando enriquecimento [${tier}]...` })

        // ── Resolve academic ID ────────────────────────────────────────
        let academicId: string | null = id

        if (!academicId && name) {
          // Try to find existing academic by name (+ context hints)
          const existing = await prisma.academic.findFirst({
            where: {
              name: { contains: name },
              ...(institution ? { institution: { contains: institution } } : {}),
              ...(state ? { currentState: state } : {}),
              ...(city ? { currentCity: city } : {}),
            },
            orderBy: { createdAt: 'desc' },
          })
          academicId = existing?.id ?? null
        }

        // If no existing academic and tier is AI, create a stub record
        if (!academicId && tier === 'AI' && name) {
          const result = await upsertAcademic(
            { name: name!, institution: institution ?? '', graduationYear: new Date().getFullYear() },
            { source: 'LINKEDIN', scrapedAt: new Date() }
          )
          academicId = result.id
        }

        if (!academicId && tier !== 'AI') {
          send({ phase: 'done', status: 'not_found', reason: 'Academic not found in database. Use tier=AI for cold discovery.' })
          return
        }

        // ── Run enrichment ────────────────────────────────────────────
        const ctx = { name: name ?? undefined, state: state ?? null, city: city ?? null, institution: institution ?? null }
        const startMs = Date.now()

        let result: { success: boolean; enrichmentStatus: string; sources: string[]; durationMs: number; academicId?: string }

        if (tier === 'FREE') {
          send({ phase: 'lattes', status: 'start', message: 'Buscando Lattes via Google...' })
          result = await freeTierEnrich(academicId!, ctx)
          send({ phase: 'lattes', status: 'complete' })
        } else if (tier === 'API') {
          send({ phase: 'serpapi', status: 'start', message: 'Buscando LinkedIn via SerpAPI...' })
          result = await apiTierEnrich(academicId!, ctx)
          send({ phase: 'serpapi', status: 'complete' })
        } else {
          send({ phase: 'discovery', status: 'start', message: 'Pesquisando na web (Grok-4)...' })
          result = await aiTierEnrich(academicId, ctx)
          academicId = result.academicId ?? academicId
          send({ phase: 'discovery', status: 'complete' })
        }

        if (!result.success && result.enrichmentStatus === 'PENDING') {
          send({ phase: 'done', status: 'not_found', reason: (result as any).error ?? 'Não foi possível encontrar dados para este acadêmico' })
          return
        }

        const finalAcademic = await prisma.academic.findUnique({
          where: { id: academicId! },
          include: { dissertations: true },
        })

        send({
          phase: 'done',
          status: 'success',
          academic: finalAcademic,
          enrichmentSummary: {
            tier,
            estimatedCost: estimateCost(tier),
            sources: result.sources,
            enrichmentStatus: result.enrichmentStatus,
            durationMs: result.durationMs,
          },
        })
      } catch (error) {
        send({ phase: 'error', status: 'error', message: error instanceof Error ? error.message : 'Unknown error' })
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
