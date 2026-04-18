export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { freeTierEnrich } from '@/lib/enrichment/free-tier'
import { apiTierEnrich } from '@/lib/enrichment/api-tier'
import { aiTierEnrich } from '@/lib/enrichment/ai-tier'
import { upsertAcademic } from '@/lib/academic-upsert'
import { hasSavedCookies } from '@/lib/scrapers/linkedin-auth'
import type { EnrichmentSource } from '@/components/profile-v2/EnrichmentConfigurator'

type SSEEvent =
  | { phase: 'init'; status: 'start'; message: string }
  | { phase: 'lattes' | 'linkedin' | 'serpapi' | 'proxycurl' | 'discovery' | 'enrichment' | 'saving'; status: 'start' | 'complete' | 'skipped'; message?: string }
  | { phase: 'done'; status: 'success'; academic: any; enrichmentSummary: any }
  | { phase: 'done'; status: 'not_found'; reason: string }
  | { phase: 'error'; status: 'error'; message: string }

const ALL_SOURCES: EnrichmentSource[] = ['lattes', 'linkedin', 'serpapi', 'proxycurl', 'grok']

function parseSources(param: string | null): EnrichmentSource[] {
  if (!param) return ['lattes', 'linkedin']
  return param.split(',').filter((s): s is EnrichmentSource => ALL_SOURCES.includes(s as any))
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const id = params.get('id')
  const name = params.get('name')
  const state = params.get('state')
  const city = params.get('city')
  const institution = params.get('institution')
  const sources = parseSources(params.get('sources'))

  if (!id && !name) {
    return new Response(JSON.stringify({ error: 'Provide ?id or ?name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const useGrok = sources.includes('grok')

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
        // ── Pre-flight: validate required sessions/keys ────────────────
        if (sources.includes('linkedin') && !hasSavedCookies()) {
          send({ phase: 'error', status: 'error', message: 'LinkedIn selecionado mas nenhuma sessão salva. Faça login em /admin/browser primeiro.' })
          return
        }

        send({ phase: 'init', status: 'start', message: `Iniciando enriquecimento [${sources.join(', ')}]...` })

        // ── Resolve academic ID ────────────────────────────────────────
        let academicId: string | null = id

        if (!academicId && name) {
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

        // Create a stub academic for cold discovery (any tier)
        if (!academicId && name) {
          send({ phase: 'saving', status: 'start', message: 'Criando perfil stub...' })
          const result = await upsertAcademic(
            { name: name!, institution: institution ?? '', graduationYear: new Date().getFullYear() },
            { source: 'LINKEDIN', scrapedAt: new Date() }
          )
          academicId = result.id
          send({ phase: 'saving', status: 'complete', message: `Perfil criado: ${academicId}` })
        }

        if (!academicId) {
          send({ phase: 'done', status: 'not_found', reason: 'Nenhum nome informado para busca.' })
          return
        }

        // ── Run enrichment per source ──────────────────────────────────
        const onLog = (msg: string) => send({ phase: 'log', status: 'info', message: msg } as any)
        const ctx = { name: name ?? undefined, state: state ?? null, city: city ?? null, institution: institution ?? null, onLog }

        let result: { success: boolean; enrichmentStatus: string; sources: string[]; durationMs: number; academicId?: string }

        const hasFreeSources = sources.includes('lattes') || sources.includes('linkedin')
        const hasApiSources = sources.includes('serpapi') || sources.includes('proxycurl')

        if (useGrok) {
          send({ phase: 'discovery', status: 'start', message: 'Pesquisando na web (Grok)...' })
          result = await aiTierEnrich(academicId, { ...ctx, sources })
          academicId = result.academicId ?? academicId
          send({ phase: 'discovery', status: 'complete' })
        } else if (hasApiSources) {
          send({ phase: 'serpapi', status: 'start', message: 'Buscando via SerpAPI + Proxycurl...' })
          result = await apiTierEnrich(academicId!, { ...ctx, sources })
          send({ phase: 'serpapi', status: 'complete' })
        } else {
          // FREE sources (lattes + linkedin) — handled individually
          send({ phase: 'lattes', status: sources.includes('lattes') ? 'start' : 'skipped', message: 'Buscando Lattes (Scrapling)...' })
          result = await freeTierEnrich(academicId!, { ...ctx, sources })
          if (sources.includes('lattes')) send({ phase: 'lattes', status: 'complete' })
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
