'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { AcademicWithDissertations } from '@/types'

async function fetchAcademic(id: string): Promise<AcademicWithDissertations> {
  const res = await fetch(`/api/academics/${id}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

async function enrichAcademic(academicId: string) {
  const res = await fetch(`/api/search-academic?academicId=${academicId}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to enrich')
  }
  return res.json()
}

export default function AcademicDetailPage() {
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const { data: academic, isLoading, error } = useQuery({
    queryKey: ['academic', id],
    queryFn: () => fetchAcademic(id),
  })

  const enrichMutation = useMutation({
    mutationFn: () => enrichAcademic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic', id] })
    },
  })

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
        isOpen={enrichMutation.isPending}
        academicName={academic.name}
      />

      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <ProfileHeader
          academic={academic}
          onEnrich={() => enrichMutation.mutate()}
          isEnriching={enrichMutation.isPending}
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
