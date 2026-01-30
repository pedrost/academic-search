# Frontend V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign frontend with NextUI, instant search, rich academic cards, tabbed profile pages, and timeline visualization.

**Architecture:** Replace Shadcn components with NextUI. Build v2 components in separate directories (`search-v2/`, `profile-v2/`). Use feature flag to switch between v1/v2.

**Tech Stack:** NextUI v2, Tailwind CSS v4, Framer Motion, TanStack Query, Lucide React

---

## Task 1: Install NextUI and Configure Tailwind

**Files:**
- Modify: `package.json`
- Modify: `src/app/globals.css`
- Create: `src/app/providers.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Install NextUI dependencies**

Run:
```bash
npm install @nextui-org/react
```

**Step 2: Update globals.css with NextUI theme colors**

Add to `src/app/globals.css` after line 71 (after the accent colors):

```css
  /* NextUI custom theme colors */
  --color-success-50: #f0fdf4;
  --color-success-500: #22c55e;
  --color-success-600: #16a34a;
  --color-warning-50: #fffbeb;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  --color-danger-50: #fef2f2;
  --color-danger-500: #ef4444;
  --color-danger-600: #dc2626;
  --color-violet-50: #f5f3ff;
  --color-violet-500: #8b5cf6;
  --color-violet-600: #7c3aed;
```

**Step 3: Create providers.tsx with NextUIProvider**

Create `src/app/providers.tsx`:

```tsx
'use client'

import { NextUIProvider } from '@nextui-org/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <NextUIProvider>
        {children}
      </NextUIProvider>
    </QueryClientProvider>
  )
}
```

**Step 4: Update layout.tsx to use new Providers**

Modify `src/app/layout.tsx` to import from `./providers` instead of `@/components/providers/QueryProvider`.

**Step 5: Verify installation works**

Run:
```bash
npm run dev
```

Expected: App starts without errors.

**Step 6: Commit**

```bash
git add -A && git commit -m "chore: install NextUI and configure providers"
```

---

## Task 2: Create useDebounce Hook

**Files:**
- Create: `src/hooks/useDebounce.ts`

**Step 1: Create the debounce hook**

Create `src/hooks/useDebounce.ts`:

```ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
```

**Step 2: Commit**

```bash
git add src/hooks/useDebounce.ts && git commit -m "feat: add useDebounce hook for instant search"
```

---

## Task 3: Create Skeleton Card Component

**Files:**
- Create: `src/components/search-v2/SkeletonCard.tsx`

**Step 1: Create skeleton card component**

Create `src/components/search-v2/SkeletonCard.tsx`:

```tsx
import { Card, CardBody, Skeleton } from '@nextui-org/react'

export function SkeletonCard() {
  return (
    <Card className="w-full">
      <CardBody className="gap-3">
        <div className="flex gap-3">
          <Skeleton className="rounded-full w-12 h-12" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-3/4 rounded-lg" />
            <Skeleton className="h-3 w-1/2 rounded-lg" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="flex justify-between">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </CardBody>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/search-v2/SkeletonCard.tsx && git commit -m "feat: add skeleton card for loading state"
```

---

## Task 4: Create AcademicCard V2 Component

**Files:**
- Create: `src/components/search-v2/AcademicCardV2.tsx`

**Step 1: Create the enhanced academic card**

Create `src/components/search-v2/AcademicCardV2.tsx`:

```tsx
'use client'

import { Card, CardBody, CardFooter, Chip, Button, Avatar } from '@nextui-org/react'
import { Building2, GraduationCap, MapPin, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
  onEnrich?: (id: string) => void
  isEnriching?: boolean
}

const degreeColors: Record<string, 'primary' | 'secondary' | 'success'> = {
  MASTERS: 'primary',
  PHD: 'secondary',
  POSTDOC: 'success',
}

const statusColors: Record<string, 'success' | 'warning' | 'default'> = {
  COMPLETE: 'success',
  PARTIAL: 'warning',
  PENDING: 'default',
}

const statusLabels: Record<string, string> = {
  COMPLETE: 'Completo',
  PARTIAL: 'Parcial',
  PENDING: 'Pendente',
}

const sectorIcons: Record<string, string> = {
  ACADEMIA: '🎓',
  GOVERNMENT: '🏛️',
  PRIVATE: '🏢',
  NGO: '🤝',
  UNKNOWN: '❓',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function AcademicCardV2({ academic, onEnrich, isEnriching }: Props) {
  const firstDissertation = academic.dissertations[0]
  const location = [academic.currentCity, academic.currentState].filter(Boolean).join(', ')

  return (
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardBody className="gap-3">
        {/* Header: Avatar, Name, Status */}
        <div className="flex gap-3 items-start">
          <Avatar
            name={getInitials(academic.name)}
            className="bg-gradient-to-br from-primary-500 to-violet-500 text-white font-semibold"
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{academic.name}</h3>
            {academic.currentJobTitle && (
              <p className="text-sm text-default-500 truncate">
                {academic.currentJobTitle}
                {academic.currentCompany && ` @ ${academic.currentCompany}`}
              </p>
            )}
            {location && (
              <p className="text-xs text-default-400 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {location}
              </p>
            )}
          </div>
          <Chip
            size="sm"
            color={statusColors[academic.enrichmentStatus]}
            variant="flat"
          >
            {statusLabels[academic.enrichmentStatus]}
          </Chip>
        </div>

        {/* Badges: Degree, Field, Publications, Sector */}
        <div className="flex flex-wrap gap-2">
          {academic.degreeLevel && (
            <Chip
              size="sm"
              color={degreeColors[academic.degreeLevel]}
              variant="flat"
              startContent={<GraduationCap className="w-3 h-3" />}
            >
              {DEGREE_LEVEL_LABELS[academic.degreeLevel]}
            </Chip>
          )}
          {academic.researchField && (
            <Chip size="sm" variant="bordered" className="text-xs">
              {academic.researchField}
            </Chip>
          )}
          {academic.dissertations.length > 0 && (
            <Chip
              size="sm"
              variant="flat"
              startContent={<FileText className="w-3 h-3" />}
            >
              {academic.dissertations.length} pub{academic.dissertations.length > 1 ? 's' : ''}
            </Chip>
          )}
          {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
            <Chip size="sm" variant="flat" startContent={<Building2 className="w-3 h-3" />}>
              {sectorIcons[academic.currentSector]} {SECTOR_LABELS[academic.currentSector]}
            </Chip>
          )}
        </div>

        {/* Dissertation preview */}
        {firstDissertation && (
          <p className="text-sm text-default-600 line-clamp-2 bg-default-50 p-2 rounded-lg">
            &ldquo;{firstDissertation.title}&rdquo;
          </p>
        )}
      </CardBody>

      <CardFooter className="justify-between gap-2 pt-0">
        <Link href={`/academic/${academic.id}`}>
          <Button color="primary" variant="flat" size="sm">
            Ver Perfil
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {academic.graduationYear && (
            <span className="text-xs text-default-400">{academic.graduationYear}</span>
          )}
          {academic.enrichmentStatus !== 'COMPLETE' && onEnrich && (
            <Button
              size="sm"
              variant="ghost"
              isLoading={isEnriching}
              onPress={() => onEnrich(academic.id)}
              startContent={!isEnriching && <Sparkles className="w-3 h-3" />}
            >
              Enriquecer
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/search-v2/AcademicCardV2.tsx && git commit -m "feat: add enhanced AcademicCard with NextUI"
```

---

## Task 5: Create SearchFilters V2 Component

**Files:**
- Create: `src/components/search-v2/SearchFiltersV2.tsx`

**Step 1: Create instant search filter component**

Create `src/components/search-v2/SearchFiltersV2.tsx`:

```tsx
'use client'

import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  CheckboxGroup,
  Checkbox,
  Chip,
  Button,
  Divider,
} from '@nextui-org/react'
import { Search, X, Filter } from 'lucide-react'
import {
  RESEARCH_FIELDS,
  MS_CITIES,
  DEGREE_LEVEL_LABELS,
  SECTOR_LABELS,
} from '@/lib/constants'
import { SearchFilters as SearchFiltersType } from '@/types'

type Props = {
  filters: SearchFiltersType
  onFilterChange: (filters: SearchFiltersType) => void
}

export function SearchFiltersV2({ filters, onFilterChange }: Props) {
  const hasActiveFilters =
    filters.query ||
    filters.researchField ||
    (filters.degreeLevel && filters.degreeLevel.length > 0) ||
    (filters.currentSector && filters.currentSector.length > 0) ||
    filters.currentCity ||
    filters.graduationYearMin ||
    filters.graduationYearMax

  const clearAllFilters = () => {
    onFilterChange({})
  }

  const removeFilter = (key: keyof SearchFiltersType, value?: string) => {
    if (key === 'degreeLevel' && value) {
      onFilterChange({
        ...filters,
        degreeLevel: filters.degreeLevel?.filter((d) => d !== value),
      })
    } else if (key === 'currentSector' && value) {
      onFilterChange({
        ...filters,
        currentSector: filters.currentSector?.filter((s) => s !== value),
      })
    } else {
      onFilterChange({ ...filters, [key]: undefined })
    }
  }

  return (
    <div className="lg:sticky lg:top-4 space-y-4">
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary-500 to-violet-500 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <span className="font-semibold">Filtros de Busca</span>
          </div>
        </CardHeader>
        <CardBody className="gap-5">
          {/* Active Filters */}
          {hasActiveFilters && (
            <>
              <div className="flex flex-wrap gap-2">
                {filters.query && (
                  <Chip
                    onClose={() => removeFilter('query')}
                    variant="flat"
                    color="primary"
                    size="sm"
                  >
                    &ldquo;{filters.query}&rdquo;
                  </Chip>
                )}
                {filters.researchField && (
                  <Chip
                    onClose={() => removeFilter('researchField')}
                    variant="flat"
                    color="secondary"
                    size="sm"
                  >
                    {filters.researchField}
                  </Chip>
                )}
                {filters.degreeLevel?.map((level) => (
                  <Chip
                    key={level}
                    onClose={() => removeFilter('degreeLevel', level)}
                    variant="flat"
                    color="success"
                    size="sm"
                  >
                    {DEGREE_LEVEL_LABELS[level as keyof typeof DEGREE_LEVEL_LABELS]}
                  </Chip>
                ))}
                {filters.currentSector?.map((sector) => (
                  <Chip
                    key={sector}
                    onClose={() => removeFilter('currentSector', sector)}
                    variant="flat"
                    color="warning"
                    size="sm"
                  >
                    {SECTOR_LABELS[sector as keyof typeof SECTOR_LABELS]}
                  </Chip>
                ))}
                {filters.currentCity && (
                  <Chip
                    onClose={() => removeFilter('currentCity')}
                    variant="flat"
                    size="sm"
                  >
                    {filters.currentCity}
                  </Chip>
                )}
                {(filters.graduationYearMin || filters.graduationYearMax) && (
                  <Chip
                    onClose={() => {
                      onFilterChange({
                        ...filters,
                        graduationYearMin: undefined,
                        graduationYearMax: undefined,
                      })
                    }}
                    variant="flat"
                    size="sm"
                  >
                    {filters.graduationYearMin || '...'} - {filters.graduationYearMax || '...'}
                  </Chip>
                )}
              </div>
              <Button
                size="sm"
                variant="light"
                color="danger"
                startContent={<X className="w-4 h-4" />}
                onPress={clearAllFilters}
              >
                Limpar todos os filtros
              </Button>
              <Divider />
            </>
          )}

          {/* Search Input */}
          <Input
            label="Buscar por nome ou palavra-chave"
            placeholder="Ex: agricultura familiar, Maria Silva..."
            value={filters.query || ''}
            onValueChange={(value) => onFilterChange({ ...filters, query: value })}
            startContent={<Search className="w-4 h-4 text-default-400" />}
            isClearable
            onClear={() => onFilterChange({ ...filters, query: '' })}
          />

          {/* Research Field */}
          <Select
            label="Área de Pesquisa"
            placeholder="Todas as áreas"
            selectedKeys={filters.researchField ? [filters.researchField] : []}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string
              onFilterChange({ ...filters, researchField: value || undefined })
            }}
          >
            {RESEARCH_FIELDS.map((field) => (
              <SelectItem key={field}>{field}</SelectItem>
            ))}
          </Select>

          {/* Degree Level */}
          <CheckboxGroup
            label="Nível de Formação"
            value={filters.degreeLevel || []}
            onValueChange={(value) =>
              onFilterChange({ ...filters, degreeLevel: value as string[] })
            }
          >
            {Object.entries(DEGREE_LEVEL_LABELS).map(([key, label]) => (
              <Checkbox key={key} value={key} size="sm">
                {label}
              </Checkbox>
            ))}
          </CheckboxGroup>

          {/* City */}
          <Select
            label="Cidade Atual"
            placeholder="Todas as cidades"
            selectedKeys={filters.currentCity ? [filters.currentCity] : []}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string
              onFilterChange({ ...filters, currentCity: value || undefined })
            }}
          >
            {MS_CITIES.map((city) => (
              <SelectItem key={city}>{city}</SelectItem>
            ))}
          </Select>

          {/* Sector */}
          <CheckboxGroup
            label="Setor Atual"
            value={filters.currentSector || []}
            onValueChange={(value) =>
              onFilterChange({ ...filters, currentSector: value as string[] })
            }
          >
            {Object.entries(SECTOR_LABELS)
              .filter(([key]) => key !== 'UNKNOWN')
              .map(([key, label]) => (
                <Checkbox key={key} value={key} size="sm">
                  {label}
                </Checkbox>
              ))}
          </CheckboxGroup>

          {/* Year Range */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Ano Mín."
              placeholder="2010"
              value={filters.graduationYearMin?.toString() || ''}
              onValueChange={(value) =>
                onFilterChange({
                  ...filters,
                  graduationYearMin: value ? parseInt(value) : undefined,
                })
              }
            />
            <Input
              type="number"
              label="Ano Máx."
              placeholder="2024"
              value={filters.graduationYearMax?.toString() || ''}
              onValueChange={(value) =>
                onFilterChange({
                  ...filters,
                  graduationYearMax: value ? parseInt(value) : undefined,
                })
              }
            />
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/search-v2/SearchFiltersV2.tsx && git commit -m "feat: add instant search filters with NextUI"
```

---

## Task 6: Create SearchResults V2 Component

**Files:**
- Create: `src/components/search-v2/SearchResultsV2.tsx`

**Step 1: Create the search results component**

Create `src/components/search-v2/SearchResultsV2.tsx`:

```tsx
'use client'

import { Button, ButtonGroup, Pagination, Chip } from '@nextui-org/react'
import { Grid3X3, List, SortAsc } from 'lucide-react'
import { useState } from 'react'
import { AcademicCardV2 } from './AcademicCardV2'
import { SkeletonCard } from './SkeletonCard'
import { SearchResult } from '@/types'

type Props = {
  result?: SearchResult
  isLoading: boolean
  page: number
  onPageChange: (page: number) => void
  onEnrich?: (id: string) => void
  enrichingIds?: string[]
}

type ViewMode = 'grid' | 'list'

export function SearchResultsV2({
  result,
  isLoading,
  page,
  onPageChange,
  onEnrich,
  enrichingIds = [],
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0
  const showingStart = result ? (page - 1) * result.pageSize + 1 : 0
  const showingEnd = result ? Math.min(page * result.pageSize, result.total) : 0

  return (
    <div className="space-y-4">
      {/* Header: Sort, View Toggle, Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            startContent={<SortAsc className="w-4 h-4" />}
          >
            Relevância
          </Button>
          {result && result.total > 0 && (
            <Chip size="sm" variant="flat">
              {result.total} resultado{result.total !== 1 ? 's' : ''}
            </Chip>
          )}
        </div>
        <ButtonGroup size="sm" variant="flat">
          <Button
            isIconOnly
            color={viewMode === 'grid' ? 'primary' : 'default'}
            onPress={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            isIconOnly
            color={viewMode === 'list' ? 'primary' : 'default'}
            onPress={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </ButtonGroup>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
              : 'flex flex-col gap-4'
          }
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!result || result.academics.length === 0) && (
        <div className="text-center py-16 bg-default-50 rounded-2xl">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-default-700 mb-2">
            Nenhum acadêmico encontrado
          </h3>
          <p className="text-default-500 max-w-md mx-auto">
            Tente remover alguns filtros ou buscar por termos diferentes.
          </p>
        </div>
      )}

      {/* Results Grid/List */}
      {!isLoading && result && result.academics.length > 0 && (
        <>
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                : 'flex flex-col gap-4'
            }
          >
            {result.academics.map((academic) => (
              <AcademicCardV2
                key={academic.id}
                academic={academic}
                onEnrich={onEnrich}
                isEnriching={enrichingIds.includes(academic.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-2 pt-4">
              <Pagination
                total={totalPages}
                page={page}
                onChange={onPageChange}
                showControls
                color="primary"
              />
              <p className="text-sm text-default-400">
                Mostrando {showingStart}-{showingEnd} de {result.total}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/search-v2/SearchResultsV2.tsx && git commit -m "feat: add SearchResults with grid/list view and skeleton loading"
```

---

## Task 7: Create Index Export for Search V2 Components

**Files:**
- Create: `src/components/search-v2/index.ts`

**Step 1: Create barrel export**

Create `src/components/search-v2/index.ts`:

```ts
export { AcademicCardV2 } from './AcademicCardV2'
export { SearchFiltersV2 } from './SearchFiltersV2'
export { SearchResultsV2 } from './SearchResultsV2'
export { SkeletonCard } from './SkeletonCard'
```

**Step 2: Commit**

```bash
git add src/components/search-v2/index.ts && git commit -m "chore: add barrel export for search-v2 components"
```

---

## Task 8: Update Home Page with V2 Components and Instant Search

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Rewrite page.tsx with instant search**

Replace entire contents of `src/app/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchFiltersV2, SearchResultsV2 } from '@/components/search-v2'
import { SearchFilters as SearchFiltersType, SearchResult } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { motion } from 'framer-motion'
import { GraduationCap, Search, Sparkles } from 'lucide-react'
import { Chip } from '@nextui-org/react'

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
  const [enrichingIds, setEnrichingIds] = useState<string[]>([])

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

  const handleEnrich = async (id: string) => {
    setEnrichingIds((prev) => [...prev, id])
    try {
      const res = await fetch(`/api/search-academic?academicId=${id}`)
      if (!res.ok) throw new Error('Failed to enrich')
      // Refetch to update the card
      // queryClient handled by the hook
    } finally {
      setEnrichingIds((prev) => prev.filter((i) => i !== id))
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-violet-600 text-white">
        <div
          className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]"
          aria-hidden="true"
        />
        <div className="container mx-auto px-4 py-12 md:py-16 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <Chip
              color="secondary"
              variant="flat"
              className="mb-4 bg-white/10 text-white"
              startContent={<Sparkles className="w-4 h-4" />}
            >
              Enriquecido com IA
            </Chip>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              Encontre Pesquisadores
              <span className="block bg-gradient-to-r from-violet-200 to-violet-400 bg-clip-text text-transparent">
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
              onEnrich={handleEnrich}
              enrichingIds={enrichingIds}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
```

**Step 2: Verify the page works**

Run:
```bash
npm run dev
```

Expected: Home page loads with new NextUI components, instant search works.

**Step 3: Commit**

```bash
git add src/app/page.tsx && git commit -m "feat: update home page with instant search and NextUI components"
```

---

## Task 9: Create Profile Header Component

**Files:**
- Create: `src/components/profile-v2/ProfileHeader.tsx`

**Step 1: Create the profile header**

Create `src/components/profile-v2/ProfileHeader.tsx`:

```tsx
'use client'

import { Avatar, Button, Chip, Link } from '@nextui-org/react'
import { ArrowLeft, Linkedin, GraduationCap, Mail, Sparkles, ExternalLink } from 'lucide-react'
import NextLink from 'next/link'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
  onEnrich: () => void
  isEnriching: boolean
}

const statusColors: Record<string, 'success' | 'warning' | 'default'> = {
  COMPLETE: 'success',
  PARTIAL: 'warning',
  PENDING: 'default',
}

const statusLabels: Record<string, string> = {
  COMPLETE: 'Completo',
  PARTIAL: 'Parcial',
  PENDING: 'Pendente',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function ProfileHeader({ academic, onEnrich, isEnriching }: Props) {
  const location = [academic.currentCity, academic.currentState].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      {/* Back button */}
      <NextLink href="/" className="inline-flex items-center gap-1 text-sm text-default-500 hover:text-default-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Voltar à busca
      </NextLink>

      {/* Main header card */}
      <div className="bg-gradient-to-r from-primary-500 to-violet-500 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Avatar */}
          <Avatar
            name={getInitials(academic.name)}
            className="w-24 h-24 text-2xl bg-white/20 text-white font-bold"
          />

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{academic.name}</h1>
                {academic.currentJobTitle && (
                  <p className="text-white/90 mt-1">
                    {academic.currentJobTitle}
                    {academic.currentCompany && ` @ ${academic.currentCompany}`}
                  </p>
                )}
                {location && (
                  <p className="text-white/70 text-sm mt-1">
                    {location}
                    {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
                      <> · {SECTOR_LABELS[academic.currentSector]}</>
                    )}
                  </p>
                )}
              </div>
              <Chip color={statusColors[academic.enrichmentStatus]} variant="solid" className="shrink-0">
                {statusLabels[academic.enrichmentStatus]}
              </Chip>
            </div>

            {/* Links and actions */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              {academic.linkedinUrl && (
                <Link
                  href={academic.linkedinUrl}
                  isExternal
                  className="text-white/90 hover:text-white"
                >
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-white/20 text-white"
                    startContent={<Linkedin className="w-4 h-4" />}
                  >
                    LinkedIn
                  </Button>
                </Link>
              )}
              {academic.lattesUrl && (
                <Link
                  href={academic.lattesUrl}
                  isExternal
                  className="text-white/90 hover:text-white"
                >
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-white/20 text-white"
                    startContent={<GraduationCap className="w-4 h-4" />}
                  >
                    Lattes
                  </Button>
                </Link>
              )}
              {academic.email && (
                <Link
                  href={`mailto:${academic.email}`}
                  className="text-white/90 hover:text-white"
                >
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-white/20 text-white"
                    startContent={<Mail className="w-4 h-4" />}
                  >
                    Email
                  </Button>
                </Link>
              )}
              <Button
                size="sm"
                variant="solid"
                color="secondary"
                isLoading={isEnriching}
                onPress={onEnrich}
                startContent={!isEnriching && <Sparkles className="w-4 h-4" />}
              >
                {isEnriching ? 'Enriquecendo...' : 'Enriquecer'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/profile-v2/ProfileHeader.tsx && git commit -m "feat: add ProfileHeader component with NextUI"
```

---

## Task 10: Create Profile Overview Tab

**Files:**
- Create: `src/components/profile-v2/OverviewTab.tsx`

**Step 1: Create the overview tab content**

Create `src/components/profile-v2/OverviewTab.tsx`:

```tsx
'use client'

import { Card, CardBody, Chip } from '@nextui-org/react'
import { GraduationCap, Building2, Calendar, BookOpen } from 'lucide-react'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
}

export function OverviewTab({ academic }: Props) {
  const firstDissertation = academic.dissertations[0]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Education Card */}
      <Card>
        <CardBody className="gap-4">
          <div className="flex items-center gap-2 text-primary-600">
            <GraduationCap className="w-5 h-5" />
            <h3 className="font-semibold">Formação</h3>
          </div>
          <dl className="space-y-3 text-sm">
            {academic.degreeLevel && (
              <div>
                <dt className="text-default-500">Nível</dt>
                <dd className="font-medium">{DEGREE_LEVEL_LABELS[academic.degreeLevel]}</dd>
              </div>
            )}
            {academic.institution && (
              <div>
                <dt className="text-default-500">Instituição</dt>
                <dd className="font-medium">{academic.institution}</dd>
              </div>
            )}
            {academic.graduationYear && (
              <div>
                <dt className="text-default-500">Ano de Conclusão</dt>
                <dd className="font-medium">{academic.graduationYear}</dd>
              </div>
            )}
            {academic.researchField && (
              <div>
                <dt className="text-default-500">Área de Pesquisa</dt>
                <dd>
                  <Chip size="sm" variant="flat" color="primary">
                    {academic.researchField}
                  </Chip>
                </dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Employment Card */}
      <Card>
        <CardBody className="gap-4">
          <div className="flex items-center gap-2 text-success-600">
            <Building2 className="w-5 h-5" />
            <h3 className="font-semibold">Situação Atual</h3>
          </div>
          <dl className="space-y-3 text-sm">
            {academic.currentJobTitle && (
              <div>
                <dt className="text-default-500">Cargo</dt>
                <dd className="font-medium">{academic.currentJobTitle}</dd>
              </div>
            )}
            {academic.currentCompany && (
              <div>
                <dt className="text-default-500">Empresa/Instituição</dt>
                <dd className="font-medium">{academic.currentCompany}</dd>
              </div>
            )}
            {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
              <div>
                <dt className="text-default-500">Setor</dt>
                <dd>
                  <Chip size="sm" variant="flat" color="success">
                    {SECTOR_LABELS[academic.currentSector]}
                  </Chip>
                </dd>
              </div>
            )}
            {(academic.currentCity || academic.currentState) && (
              <div>
                <dt className="text-default-500">Localização</dt>
                <dd className="font-medium">
                  {[academic.currentCity, academic.currentState].filter(Boolean).join(', ')}
                </dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Latest Dissertation Card */}
      {firstDissertation && (
        <Card className="md:col-span-2">
          <CardBody className="gap-4">
            <div className="flex items-center gap-2 text-violet-600">
              <BookOpen className="w-5 h-5" />
              <h3 className="font-semibold">Última Dissertação/Tese</h3>
            </div>
            <div>
              <h4 className="font-medium text-lg">{firstDissertation.title}</h4>
              <p className="text-sm text-default-500 mt-1">
                {firstDissertation.institution} · {firstDissertation.defenseYear}
                {firstDissertation.program && ` · ${firstDissertation.program}`}
              </p>
              {firstDissertation.advisorName && (
                <p className="text-sm mt-2">
                  <span className="text-default-500">Orientador:</span> {firstDissertation.advisorName}
                </p>
              )}
              {firstDissertation.abstract && (
                <p className="text-sm text-default-600 mt-3 line-clamp-4">
                  {firstDissertation.abstract}
                </p>
              )}
              {firstDissertation.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {firstDissertation.keywords.map((kw, i) => (
                    <Chip key={i} size="sm" variant="bordered">
                      {kw}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/profile-v2/OverviewTab.tsx && git commit -m "feat: add OverviewTab component for profile page"
```

---

## Task 11: Create Profile Timeline Tab

**Files:**
- Create: `src/components/profile-v2/TimelineTab.tsx`

**Step 1: Create the timeline visualization**

Create `src/components/profile-v2/TimelineTab.tsx`:

```tsx
'use client'

import { Card, CardBody, Chip, CheckboxGroup, Checkbox } from '@nextui-org/react'
import { GraduationCap, FileText, Building2, Award } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
}

type TimelineEvent = {
  id: string
  type: 'degree' | 'dissertation' | 'employment' | 'award'
  year: number | null
  title: string
  subtitle: string
  details?: string
}

const eventIcons = {
  degree: GraduationCap,
  dissertation: FileText,
  employment: Building2,
  award: Award,
}

const eventColors = {
  degree: 'secondary',
  dissertation: 'primary',
  employment: 'success',
  award: 'warning',
} as const

function buildTimeline(academic: AcademicWithDissertations): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Degree completion
  if (academic.graduationYear && academic.degreeLevel) {
    events.push({
      id: 'degree-' + academic.id,
      type: 'degree',
      year: academic.graduationYear,
      title: DEGREE_LEVEL_LABELS[academic.degreeLevel],
      subtitle: academic.institution || 'Instituição não informada',
      details: academic.researchField,
    })
  }

  // Dissertations
  academic.dissertations.forEach((diss) => {
    events.push({
      id: 'diss-' + diss.id,
      type: 'dissertation',
      year: diss.defenseYear,
      title: diss.title,
      subtitle: `${diss.institution} · ${diss.program || 'Programa não informado'}`,
      details: diss.advisorName ? `Orientador: ${diss.advisorName}` : undefined,
    })
  })

  // Employment (from grokMetadata if available)
  const grokData = academic.grokMetadata as Record<string, unknown> | null
  if (grokData?.employment) {
    const employment = grokData.employment as Array<{
      year?: number
      jobTitle?: string
      company?: string
      location?: string
    }>
    employment.forEach((job, i) => {
      events.push({
        id: 'job-' + i,
        type: 'employment',
        year: job.year || null,
        title: job.jobTitle || 'Cargo não informado',
        subtitle: job.company || 'Empresa não informada',
        details: job.location,
      })
    })
  }

  // Current employment (if not already added from grokMetadata)
  if (academic.currentJobTitle && !grokData?.employment) {
    events.push({
      id: 'current-job',
      type: 'employment',
      year: null,
      title: academic.currentJobTitle,
      subtitle: academic.currentCompany || 'Empresa não informada',
      details: [academic.currentCity, academic.currentState].filter(Boolean).join(', '),
    })
  }

  // Sort by year descending, null years at top
  return events.sort((a, b) => {
    if (a.year === null && b.year === null) return 0
    if (a.year === null) return -1
    if (b.year === null) return 1
    return b.year - a.year
  })
}

export function TimelineTab({ academic }: Props) {
  const [visibleTypes, setVisibleTypes] = useState<string[]>([
    'degree',
    'dissertation',
    'employment',
    'award',
  ])

  const allEvents = buildTimeline(academic)
  const events = allEvents.filter((e) => visibleTypes.includes(e.type))

  // Group events by year
  const groupedEvents: Record<string, TimelineEvent[]> = {}
  events.forEach((event) => {
    const key = event.year?.toString() || 'Atual'
    if (!groupedEvents[key]) groupedEvents[key] = []
    groupedEvents[key].push(event)
  })

  const years = Object.keys(groupedEvents).sort((a, b) => {
    if (a === 'Atual') return -1
    if (b === 'Atual') return 1
    return parseInt(b) - parseInt(a)
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardBody>
          <CheckboxGroup
            label="Mostrar eventos"
            orientation="horizontal"
            value={visibleTypes}
            onValueChange={setVisibleTypes}
          >
            <Checkbox value="degree" size="sm">
              <span className="flex items-center gap-1">
                <GraduationCap className="w-4 h-4 text-secondary-500" /> Formação
              </span>
            </Checkbox>
            <Checkbox value="dissertation" size="sm">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4 text-primary-500" /> Dissertações
              </span>
            </Checkbox>
            <Checkbox value="employment" size="sm">
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4 text-success-500" /> Emprego
              </span>
            </Checkbox>
          </CheckboxGroup>
        </CardBody>
      </Card>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="text-center py-12 text-default-500">
          Nenhum evento para exibir. Tente selecionar mais tipos de evento.
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-default-200" />

          {years.map((year, yearIndex) => (
            <div key={year} className="mb-6">
              {/* Year marker */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center z-10">
                  <span className="text-xs font-bold text-default-600">{year}</span>
                </div>
                <div className="h-px flex-1 bg-default-200" />
              </div>

              {/* Events for this year */}
              <div className="space-y-3 ml-12">
                {groupedEvents[year].map((event, eventIndex) => {
                  const Icon = eventIcons[event.type]
                  const color = eventColors[event.type]

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: yearIndex * 0.1 + eventIndex * 0.05 }}
                    >
                      <Card>
                        <CardBody className="flex-row gap-3 items-start">
                          <div className={`p-2 rounded-lg bg-${color}-100`}>
                            <Icon className={`w-5 h-5 text-${color}-600`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium line-clamp-2">{event.title}</h4>
                            <p className="text-sm text-default-500">{event.subtitle}</p>
                            {event.details && (
                              <p className="text-xs text-default-400 mt-1">{event.details}</p>
                            )}
                          </div>
                          <Chip size="sm" variant="flat" color={color}>
                            {event.type === 'degree' && 'Formação'}
                            {event.type === 'dissertation' && 'Dissertação'}
                            {event.type === 'employment' && 'Emprego'}
                            {event.type === 'award' && 'Prêmio'}
                          </Chip>
                        </CardBody>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/profile-v2/TimelineTab.tsx && git commit -m "feat: add TimelineTab with event visualization"
```

---

## Task 12: Create Profile Publications Tab

**Files:**
- Create: `src/components/profile-v2/PublicationsTab.tsx`

**Step 1: Create the publications list**

Create `src/components/profile-v2/PublicationsTab.tsx`:

```tsx
'use client'

import { Card, CardBody, Chip, Button, Link } from '@nextui-org/react'
import { FileText, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { AcademicWithDissertations } from '@/types'

type Props = {
  academic: AcademicWithDissertations
}

export function PublicationsTab({ academic }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (academic.dissertations.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-default-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-default-600">Nenhuma publicação encontrada</h3>
        <p className="text-default-400 mt-1">
          Este acadêmico ainda não possui dissertações ou teses cadastradas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {academic.dissertations.map((diss) => {
        const isExpanded = expandedIds.has(diss.id)

        return (
          <Card key={diss.id}>
            <CardBody className="gap-3">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{diss.title}</h3>
                  <p className="text-sm text-default-500 mt-1">
                    {diss.institution} · {diss.defenseYear}
                    {diss.program && ` · ${diss.program}`}
                  </p>
                </div>
                <Chip size="sm" variant="flat" color="primary">
                  {diss.defenseYear}
                </Chip>
              </div>

              {diss.advisorName && (
                <p className="text-sm">
                  <span className="text-default-500">Orientador:</span> {diss.advisorName}
                </p>
              )}

              {diss.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {diss.keywords.map((kw, i) => (
                    <Chip key={i} size="sm" variant="bordered">
                      {kw}
                    </Chip>
                  ))}
                </div>
              )}

              {diss.abstract && (
                <>
                  <p className={`text-sm text-default-600 ${!isExpanded && 'line-clamp-3'}`}>
                    {diss.abstract}
                  </p>
                  {diss.abstract.length > 200 && (
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => toggleExpanded(diss.id)}
                      endContent={
                        isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      }
                    >
                      {isExpanded ? 'Ver menos' : 'Ver mais'}
                    </Button>
                  )}
                </>
              )}

              {diss.sourceUrl && (
                <Link
                  href={diss.sourceUrl}
                  isExternal
                  className="inline-flex items-center gap-1 text-sm text-primary-600"
                >
                  Ver no Sucupira <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/profile-v2/PublicationsTab.tsx && git commit -m "feat: add PublicationsTab with expandable abstracts"
```

---

## Task 13: Create Profile Enrichment Log Tab

**Files:**
- Create: `src/components/profile-v2/EnrichmentLogTab.tsx`

**Step 1: Create the enrichment log display**

Create `src/components/profile-v2/EnrichmentLogTab.tsx`:

```tsx
'use client'

import { Card, CardBody, Chip, Code } from '@nextui-org/react'
import { Clock, CheckCircle, AlertCircle, Database } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AcademicWithDissertations } from '@/types'

type Props = {
  academic: AcademicWithDissertations
}

export function EnrichmentLogTab({ academic }: Props) {
  const grokData = academic.grokMetadata as Record<string, unknown> | null

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardBody className="gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold">Status do Enriquecimento</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              {academic.enrichmentStatus === 'COMPLETE' ? (
                <CheckCircle className="w-5 h-5 text-success-500" />
              ) : academic.enrichmentStatus === 'PARTIAL' ? (
                <AlertCircle className="w-5 h-5 text-warning-500" />
              ) : (
                <Clock className="w-5 h-5 text-default-400" />
              )}
              <div>
                <p className="text-sm text-default-500">Status</p>
                <Chip
                  size="sm"
                  color={
                    academic.enrichmentStatus === 'COMPLETE'
                      ? 'success'
                      : academic.enrichmentStatus === 'PARTIAL'
                      ? 'warning'
                      : 'default'
                  }
                >
                  {academic.enrichmentStatus === 'COMPLETE'
                    ? 'Completo'
                    : academic.enrichmentStatus === 'PARTIAL'
                    ? 'Parcial'
                    : 'Pendente'}
                </Chip>
              </div>
            </div>
            <div>
              <p className="text-sm text-default-500">Último enriquecimento</p>
              <p className="font-medium">
                {academic.lastEnrichedAt
                  ? format(new Date(academic.lastEnrichedAt), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })
                  : 'Nunca'}
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500">Enriquecimento via IA</p>
              <p className="font-medium">
                {academic.grokEnrichedAt
                  ? format(new Date(academic.grokEnrichedAt), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })
                  : 'Nunca'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Grok Data Card */}
      {grokData && (
        <Card>
          <CardBody className="gap-4">
            <h3 className="font-semibold">Dados do Enriquecimento</h3>

            {/* Sources */}
            {Array.isArray(grokData.sources) && grokData.sources.length > 0 && (
              <div>
                <p className="text-sm text-default-500 mb-2">Fontes utilizadas</p>
                <div className="flex flex-wrap gap-2">
                  {(grokData.sources as string[]).map((source, i) => (
                    <Chip key={i} size="sm" variant="flat">
                      {source}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* Raw data */}
            <div>
              <p className="text-sm text-default-500 mb-2">Dados brutos (JSON)</p>
              <Code className="w-full overflow-auto max-h-64 p-3 text-xs">
                <pre>{JSON.stringify(grokData, null, 2)}</pre>
              </Code>
            </div>
          </CardBody>
        </Card>
      )}

      {/* No data state */}
      {!grokData && academic.enrichmentStatus === 'PENDING' && (
        <div className="text-center py-12 bg-default-50 rounded-xl">
          <Database className="w-12 h-12 text-default-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-default-600">
            Nenhum enriquecimento realizado
          </h3>
          <p className="text-default-400 mt-1">
            Clique em &ldquo;Enriquecer&rdquo; para buscar informações atualizadas.
          </p>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/profile-v2/EnrichmentLogTab.tsx && git commit -m "feat: add EnrichmentLogTab with raw data display"
```

---

## Task 14: Create Index Export for Profile V2 Components

**Files:**
- Create: `src/components/profile-v2/index.ts`

**Step 1: Create barrel export**

Create `src/components/profile-v2/index.ts`:

```ts
export { ProfileHeader } from './ProfileHeader'
export { OverviewTab } from './OverviewTab'
export { TimelineTab } from './TimelineTab'
export { PublicationsTab } from './PublicationsTab'
export { EnrichmentLogTab } from './EnrichmentLogTab'
```

**Step 2: Commit**

```bash
git add src/components/profile-v2/index.ts && git commit -m "chore: add barrel export for profile-v2 components"
```

---

## Task 15: Update Academic Detail Page with V2 Components

**Files:**
- Modify: `src/app/academic/[id]/page.tsx`

**Step 1: Rewrite the academic detail page**

Replace entire contents of `src/app/academic/[id]/page.tsx`:

```tsx
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
```

**Step 2: Verify the page works**

Run:
```bash
npm run dev
```

Navigate to an academic profile page. Expected: New tabbed interface with NextUI components.

**Step 3: Commit**

```bash
git add src/app/academic/[id]/page.tsx && git commit -m "feat: update academic detail page with tabs and v2 components"
```

---

## Task 16: Clean Up Old V1 Components (Optional)

**Files:**
- Delete: `src/components/providers/QueryProvider.tsx`
- Keep: `src/components/search/` (for reference, can delete later)
- Keep: `src/components/ui/` (still used by admin pages)

**Step 1: Remove unused QueryProvider**

```bash
rm src/components/providers/QueryProvider.tsx
rmdir src/components/providers
```

**Step 2: Commit**

```bash
git add -A && git commit -m "chore: remove unused QueryProvider (now in providers.tsx)"
```

---

## Task 17: Final Verification

**Step 1: Run build to check for errors**

```bash
npm run build
```

Expected: Build completes successfully.

**Step 2: Run dev and test features**

```bash
npm run dev
```

Verify:
- [ ] Home page loads with new hero and instant search
- [ ] Typing in search box triggers search after 300ms delay
- [ ] Filter changes trigger immediate search
- [ ] Active filters show as chips with remove buttons
- [ ] "Clear all filters" button works
- [ ] Grid/List view toggle works
- [ ] Skeleton loading shows during fetch
- [ ] Academic cards show enrichment status, degree badge, publication count
- [ ] "View Profile" button navigates to detail page
- [ ] Academic detail page has tabbed interface
- [ ] Overview tab shows education and employment info
- [ ] Timeline tab shows events with filters
- [ ] Publications tab shows dissertations with expandable abstracts
- [ ] Enrichment tab shows status and raw data
- [ ] "Enrich" button works from both card and profile

**Step 3: Final commit**

```bash
git add -A && git commit -m "feat: complete frontend v2 with NextUI, instant search, and profile tabs"
```

---

## Summary

**Created files:**
- `src/app/providers.tsx`
- `src/hooks/useDebounce.ts`
- `src/components/search-v2/SkeletonCard.tsx`
- `src/components/search-v2/AcademicCardV2.tsx`
- `src/components/search-v2/SearchFiltersV2.tsx`
- `src/components/search-v2/SearchResultsV2.tsx`
- `src/components/search-v2/index.ts`
- `src/components/profile-v2/ProfileHeader.tsx`
- `src/components/profile-v2/OverviewTab.tsx`
- `src/components/profile-v2/TimelineTab.tsx`
- `src/components/profile-v2/PublicationsTab.tsx`
- `src/components/profile-v2/EnrichmentLogTab.tsx`
- `src/components/profile-v2/index.ts`

**Modified files:**
- `package.json` (NextUI dependency)
- `src/app/globals.css` (theme colors)
- `src/app/layout.tsx` (providers import)
- `src/app/page.tsx` (v2 components + instant search)
- `src/app/academic/[id]/page.tsx` (tabbed interface)

**Deleted files:**
- `src/components/providers/QueryProvider.tsx`
