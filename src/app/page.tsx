'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { SearchFiltersV2, SearchResultsV2 } from '@/components/search-v2'
import { SearchFilters as SearchFiltersType, SearchResult } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { motion } from 'framer-motion'
import { GraduationCap, Search, Sparkles } from 'lucide-react'

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

  // Debounce text search only
  const debouncedQuery = useDebounce(filters.query, 300)

  // Create effective filters with debounced query
  const effectiveFilters = {
    ...filters,
    query: debouncedQuery,
  }

  // Reset page when filters change
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
  ])

  const router = useRouter()

  const handleWebSearchComplete = (academicId: string) => {
    router.push(`/academic/${academicId}`)
  }

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['academics', effectiveFilters, page],
    queryFn: () => fetchAcademics(effectiveFilters, page),
    placeholderData: (previousData) => previousData,
  })

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-violet-600 text-white">
        <div
          className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]"
          aria-hidden="true"
        />
        <div className="container mx-auto px-4 pt-16 pb-24 md:pt-20 md:pb-32 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              Encontre Pesquisadores
              <span className="block text-violet-200 drop-shadow-sm">
                em Mato Grosso do Sul
              </span>
            </h1>

            <p className="text-base md:text-lg text-white/90 mb-6 max-w-2xl mx-auto">
              Explore perfis de acadêmicos, dissertações e teses de mestrado e doutorado.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-violet-300" aria-hidden="true" />
                <span>{stats?.total || '...'} perfis</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-violet-300" aria-hidden="true" />
                <span>Busca instantânea</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-300" aria-hidden="true" />
                <span>Dados atualizados</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="rgb(249 250 251)"
            />
          </svg>
        </div>
      </section>

      {/* Search Section */}
      <section className="container mx-auto px-4 py-8">
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
            />
          </div>
        </div>
      </section>
    </main>
  )
}
