'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchFilters } from '@/components/search/SearchFilters'
import { SearchResults } from '@/components/search/SearchResults'
import { SearchFilters as SearchFiltersType, SearchResult } from '@/types'
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

export default function HomePage() {
  const [filters, setFilters] = useState<SearchFiltersType>({})
  const [page, setPage] = useState(1)
  const [searchTrigger, setSearchTrigger] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['academics', filters, page, searchTrigger],
    queryFn: () => fetchAcademics(filters, page),
  })

  const handleSearch = () => {
    setPage(1)
    setSearchTrigger((t) => t + 1)
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600 text-white">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Enriquecido com IA</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Encontre Pesquisadores
              <span className="block bg-gradient-to-r from-accent-200 to-accent-400 bg-clip-text text-transparent">
                em Mato Grosso do Sul
              </span>
            </h1>

            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Explore perfis de acadêmicos, dissertações e teses de mestrado e doutorado.
              Dados enriquecidos com informações profissionais atualizadas.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-accent-300" />
                <span>Milhares de perfis</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-accent-300" />
                <span>Busca avançada</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent-300" />
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
      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <SearchFilters
              filters={filters}
              onFilterChange={setFilters}
              onSearch={handleSearch}
            />
          </aside>

          <div className="lg:col-span-3">
            <SearchResults
              result={data}
              isLoading={isLoading}
              page={page}
              onPageChange={setPage}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
