'use client'

import { useCallback, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Tabs, Tab, Spinner } from '@nextui-org/react'
import { LayoutDashboard, Clock, FileText, Database } from 'lucide-react'
import {
  ProfileHeader,
  OverviewTab,
  TimelineTab,
  PublicationsTab,
  EnrichmentLogTab,
  EnrichmentProgress,
} from '@/components/profile-v2'
import type { TerminalLine } from '@/components/profile-v2/EnrichmentProgress'
import type { EnrichmentConfig } from '@/components/profile-v2/EnrichmentConfigurator'
import { AcademicWithDissertations } from '@/types'

async function fetchAcademic(id: string): Promise<AcademicWithDissertations> {
  const res = await fetch(`/api/academics/${id}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

const DEFAULT_CONFIG: EnrichmentConfig = { sources: ['lattes', 'linkedin'] }

export default function AcademicDetailPage() {
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()
  const [isEnriching, setIsEnriching] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [config, setConfig] = useState<EnrichmentConfig>(DEFAULT_CONFIG)
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([])
  const [enrichError, setEnrichError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { data: academic, isLoading, error } = useQuery({
    queryKey: ['academic', id],
    queryFn: () => fetchAcademic(id),
  })

  const pushLine = useCallback((text: string, type: TerminalLine['type'] = 'info') => {
    setTerminalLines(prev => [...prev, { text, type }])
  }, [])

  const handleConfigChange = useCallback((newConfig: EnrichmentConfig) => {
    setConfig(newConfig)
  }, [])

  const handleCloseProgress = useCallback(() => {
    setShowProgress(false)
    setIsEnriching(false)
    setIsDone(false)
  }, [])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    setIsEnriching(false)
    setShowProgress(false)
    setIsDone(false)
  }, [])

  const handleEnrich = useCallback(async () => {
    setIsEnriching(true)
    setShowProgress(true)
    setIsDone(false)
    setEnrichError(null)
    setTerminalLines([])

    abortRef.current = new AbortController()

    const sourcesParam = config.sources.join(',')

    // Initial command line
    pushLine(`$ enrich --id ${id} --sources ${sourcesParam}`, 'command')
    pushLine('')

    try {
      const res = await fetch(
        `/api/discover-academic?id=${id}&sources=${sourcesParam}`,
        { signal: abortRef.current.signal }
      )

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.phase === 'log') {
              pushLine(event.message, 'dim')
              continue
            }

            if (event.phase === 'init') {
              pushLine(event.message, 'info')
              continue
            }

            if (event.phase === 'done') {
              pushLine('')
              if (event.status === 'success') {
                const src = event.enrichmentSummary?.sources?.join(', ') || sourcesParam
                const dur = event.enrichmentSummary?.durationMs
                  ? `${(event.enrichmentSummary.durationMs / 1000).toFixed(1)}s`
                  : ''
                pushLine(`✓ Enriquecimento concluído — fontes: ${src}${dur ? ` (${dur})` : ''}`, 'success')
                queryClient.invalidateQueries({ queryKey: ['academic', id] })
              } else if (event.status === 'not_found') {
                pushLine(`⚠ ${event.reason}`, 'warn')
              }
              setIsDone(true)
              setIsEnriching(false)
              return
            }

            if (event.phase === 'error') {
              pushLine('')
              pushLine(`✗ ${event.message}`, 'error')
              setEnrichError(event.message)
              setIsEnriching(false)
              setIsDone(true)
              return
            }

            // Phase events (start/complete/skipped)
            const phase = event.phase as string
            if (event.status === 'start') {
              pushLine('')
              pushLine(`[${phase}] ${event.message || 'Iniciando...'}`, 'info')
            } else if (event.status === 'complete') {
              pushLine(`[${phase}] ✓ concluído`, 'success')
            } else if (event.status === 'skipped') {
              pushLine(`[${phase}] — pulado${event.message ? `: ${event.message}` : ''}`, 'dim')
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }

      // Stream ended without explicit done event
      if (!isDone) {
        pushLine('')
        pushLine('Stream encerrado', 'dim')
        setIsDone(true)
        setIsEnriching(false)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      pushLine('')
      pushLine(`✗ Erro de conexão: ${err instanceof Error ? err.message : 'desconhecido'}`, 'error')
      setEnrichError('Erro de conexão')
      setIsEnriching(false)
      setIsDone(true)
    }
  }, [id, config, queryClient, pushLine, isDone])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    )
  }

  if (error || !academic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Acadêmico não encontrado</p>
        <a href="/" className="text-violet-400 hover:underline">Voltar à busca</a>
      </div>
    )
  }

  return (
    <main className="min-h-screen">
      <EnrichmentProgress
        isOpen={showProgress}
        academicName={academic.name}
        lines={terminalLines}
        isDone={isDone}
        error={enrichError}
        onClose={handleCloseProgress}
        onCancel={handleCancel}
      />

      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <ProfileHeader
          academic={academic}
          onEnrich={handleEnrich}
          isEnriching={isEnriching}
          config={config}
          onConfigChange={handleConfigChange}
        />

        <div className="mt-6">
          <Tabs
            aria-label="Seções do perfil"
            variant="underlined"
            classNames={{
              tabList: 'gap-6 border-b border-white/5',
              cursor: 'bg-violet-500',
              tab: 'px-0 h-12 text-gray-500 data-[selected=true]:text-violet-400',
              tabContent: 'group-data-[selected=true]:text-violet-400',
            }}
          >
            <Tab key="overview" title={<div className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4" /><span>Visão Geral</span></div>}>
              <div className="pt-4"><OverviewTab academic={academic} /></div>
            </Tab>
            <Tab key="timeline" title={<div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>Timeline</span></div>}>
              <div className="pt-4"><TimelineTab academic={academic} /></div>
            </Tab>
            <Tab key="publications" title={
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Publicações</span>
                {academic.dissertations.length > 0 && (
                  <span className="text-xs bg-default-100 px-2 py-0.5 rounded-full">{academic.dissertations.length}</span>
                )}
              </div>
            }>
              <div className="pt-4"><PublicationsTab academic={academic} /></div>
            </Tab>
            <Tab key="enrichment" title={<div className="flex items-center gap-2"><Database className="w-4 h-4" /><span>Enriquecimento</span></div>}>
              <div className="pt-4"><EnrichmentLogTab academic={academic} /></div>
            </Tab>
          </Tabs>
        </div>
      </div>
    </main>
  )
}
