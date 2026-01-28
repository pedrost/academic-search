'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchFilters } from '@/components/search/SearchFilters'
import { SearchResults } from '@/components/search/SearchResults'
import { SearchFilters as SearchFiltersType, SearchResult } from '@/types'

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
  const [filters, setFilters] = useState<SearchFiltersType>({
    currentState: 'MS',
  })
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
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Hunter - Busca de Acadêmicos</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <aside className="md:col-span-1">
            <SearchFilters
              filters={filters}
              onFilterChange={setFilters}
              onSearch={handleSearch}
            />
          </aside>

          <section className="md:col-span-3">
            <SearchResults
              result={data}
              isLoading={isLoading}
              page={page}
              onPageChange={setPage}
            />
          </section>
        </div>
      </div>
    </main>
  )
}
