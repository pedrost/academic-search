'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { SearchFiltersV2, SearchResultsV2 } from '@/components/search-v2'
import { SearchFilters as SearchFiltersType, SearchResult } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { motion } from 'framer-motion'
import { Terminal, Database, Zap } from 'lucide-react'

async function fetchAcademics(
  filters: SearchFiltersType,
  page: number
): Promise<SearchResult> {
  const params = new URLSearchParams()

  if (filters.query) params.set('q', filters.query)
  if (filters.researchField) params.set('researchField', filters.researchField)
  filters.degreeLevel?.forEach((d) => params.append('degreeLevel', d))
  if (filters.graduationYearMin)
    params.set('yearMin', filters.graduationYearMin.toString())
  if (filters.graduationYearMax)
    params.set('yearMax', filters.graduationYearMax.toString())
  if (filters.currentState) params.set('state', filters.currentState)
  if (filters.currentCity) params.set('city', filters.currentCity)
  filters.currentSector?.forEach((s) => params.append('sector', s))
  filters.ids?.forEach((id) => params.append('id', id))
  params.set('page', page.toString())

  const res = await fetch(`/api/academics/search?${params}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

async function fetchStats(): Promise<{ total: number }> {
  const res = await fetch('/api/academics/search?page=1')
  if (!res.ok) return { total: 0 }
  const data = await res.json()
  return { total: data.total }
}

export default function HomePage() {
  const [filters, setFilters] = useState<SearchFiltersType>({})
  const [page, setPage] = useState(1)

  const debouncedQuery = useDebounce(filters.query, 300)

  const effectiveFilters = {
    ...filters,
    query: debouncedQuery,
  }

  useEffect(() => {
    setPage(1)
  }, [
    debouncedQuery,
    filters.researchField,
    filters.degreeLevel,
    filters.currentSector,
    filters.currentCity,
    filters.graduationYearMin,
    filters.graduationYearMax,
    filters.ids,
  ])

  const router = useRouter()

  const handleWebSearchComplete = (academicId: string) => {
    router.push(`/academic/${academicId}`)
  }

  const handleImportComplete = (result: { academicIds: string[]; enhancedIds: string[] }) => {
    if (result.academicIds.length > 0) {
      setFilters({ ids: result.academicIds })
      setPage(1)
    }
  }

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    staleTime: 5 * 60 * 1000,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['academics', effectiveFilters, page],
    queryFn: () => fetchAcademics(effectiveFilters, page),
    placeholderData: (previousData) => previousData,
  })

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-transparent" />

        <div className="container mx-auto px-4 pt-12 pb-16 md:pt-16 md:pb-20 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-mono mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              hunter v2.0
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight tracking-tight">
              <span className="text-gray-100">Academic </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                Discovery
              </span>
            </h1>

            <p className="text-base md:text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              Pesquisadores, dissertações e teses de mestrado e doutorado em Mato Grosso do Sul.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-mono">
              <div className="flex items-center gap-2 text-gray-500">
                <Database className="w-4 h-4 text-violet-400" />
                <span className="text-gray-300">{stats?.total?.toLocaleString() || '...'}</span>
                <span>perfis</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>multi-source</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>real-time</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Search Section */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <SearchFiltersV2 filters={filters} onFilterChange={setFilters} />
          </aside>

          <div className="lg:col-span-3">
            <SearchResultsV2
              result={data}
              isLoading={isLoading || isFetching}
              page={page}
              onPageChange={setPage}
              filters={effectiveFilters}
              onWebSearchComplete={handleWebSearchComplete}
              onImportComplete={handleImportComplete}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
