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
import type { EnrichmentStep, EnrichmentPhase } from '@/components/profile-v2/EnrichmentProgress'
import { AcademicWithDissertations } from '@/types'

async function fetchAcademic(id: string): Promise<AcademicWithDissertations> {
  const res = await fetch(`/api/academics/${id}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

const INITIAL_STEPS: EnrichmentStep[] = [
  { phase: 'search', status: 'pending' },
  { phase: 'linkedin', status: 'pending' },
  { phase: 'save', status: 'pending' },
]

export default function AcademicDetailPage() {
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()
  const [isEnriching, setIsEnriching] = useState(false)
  const [enrichSteps, setEnrichSteps] = useState<EnrichmentStep[]>(INITIAL_STEPS)
  const [enrichError, setEnrichError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { data: academic, isLoading, error } = useQuery({
    queryKey: ['academic', id],
    queryFn: () => fetchAcademic(id),
  })

  const updateStep = useCallback((phase: EnrichmentPhase, status: EnrichmentStep['status'], message?: string) => {
    setEnrichSteps(prev =>
      prev.map(s => s.phase === phase ? { ...s, status, message } : s)
    )
  }, [])

  const handleEnrich = useCallback(async () => {
    setIsEnriching(true)
    setEnrichError(null)
    setEnrichSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending', message: undefined })))

    abortRef.current = new AbortController()

    try {
      const res = await fetch(
        `/api/search-academic?academicId=${id}`,
        { signal: abortRef.current.signal }
      )

      if (!res.ok || !res.body) {
        throw new Error('Failed to start enrichment')
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

            if (event.phase === 'done') {
              if (event.status === 'success') {
                queryClient.invalidateQueries({ queryKey: ['academic', id] })
              }
              setIsEnriching(false)
              return
            }

            if (event.phase === 'error') {
              setEnrichError(event.message || 'Erro durante o enriquecimento')
              setIsEnriching(false)
              return
            }

            const phase = event.phase as EnrichmentPhase
            if (event.status === 'start') {
              updateStep(phase, 'active', event.message)
            } else if (event.status === 'complete') {
              updateStep(phase, 'complete', event.message)
            } else if (event.status === 'skipped') {
              updateStep(phase, 'skipped', event.message)
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      setIsEnriching(false)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setEnrichError('Erro ao enriquecer perfil. Tente novamente.')
      setIsEnriching(false)
    }
  }, [id, queryClient, updateStep])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" color="primary" />
      </div>
    )
  }

  if (error || !academic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <p className="text-default-500">Acadêmico não encontrado</p>
        <a href="/" className="text-primary-600 hover:underline">
          Voltar à busca
        </a>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Enrichment Progress Modal */}
      <EnrichmentProgress
        isOpen={isEnriching}
        academicName={academic.name}
        steps={enrichSteps}
        error={enrichError}
      />

      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <ProfileHeader
          academic={academic}
          onEnrich={handleEnrich}
          isEnriching={isEnriching}
        />

        <div className="mt-6">
          <Tabs
            aria-label="Seções do perfil"
            color="primary"
            variant="underlined"
            classNames={{
              tabList: 'gap-6',
              cursor: 'bg-primary-500',
              tab: 'px-0 h-12',
            }}
          >
            <Tab
              key="overview"
              title={
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Visão Geral</span>
                </div>
              }
            >
              <div className="pt-4">
                <OverviewTab academic={academic} />
              </div>
            </Tab>
            <Tab
              key="timeline"
              title={
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Timeline</span>
                </div>
              }
            >
              <div className="pt-4">
                <TimelineTab academic={academic} />
              </div>
            </Tab>
            <Tab
              key="publications"
              title={
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Publicações</span>
                  {academic.dissertations.length > 0 && (
                    <span className="text-xs bg-default-100 px-2 py-0.5 rounded-full">
                      {academic.dissertations.length}
                    </span>
                  )}
                </div>
              }
            >
              <div className="pt-4">
                <PublicationsTab academic={academic} />
              </div>
            </Tab>
            <Tab
              key="enrichment"
              title={
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span>Enriquecimento</span>
                </div>
              }
            >
              <div className="pt-4">
                <EnrichmentLogTab academic={academic} />
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>
    </main>
  )
}
