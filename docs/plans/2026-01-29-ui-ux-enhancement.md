# UI/UX Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use frontend-design skill to implement modern, distinctive UI components.

**Goal:** Transform the academic search platform into a modern, visually appealing, mobile-responsive people directory with intuitive UX and professional design.

**Architecture:** Component-based enhancement using Tailwind CSS with custom color palette, improved layouts, mobile-first responsive design, and modern UI patterns (gradients, glassmorphism, animations).

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, Radix UI, Lucide Icons, Framer Motion (for animations)

**Design References:**
- [Best User Directory Examples](https://wedevs.com/blog/508077/user-directory-site-examples/) - Clean layouts, filtering patterns
- [Profile Page Design](https://www.eleken.co/blog-posts/profile-page-design) - Professional profile layouts
- [Dribbble People Directory](https://dribbble.com/tags/people_directory) - Visual inspiration
- [2026 UI/UX Trends](https://www.promodo.com/blog/key-ux-ui-design-trends) - Modern design patterns

---

## Task 1: Install Dependencies and Setup Design System

**Files:**
- Modify: `package.json`
- Create: `src/lib/design-system.ts`
- Modify: `tailwind.config.ts`

**Step 1: Install Framer Motion for animations**

```bash
npm install framer-motion
```

Expected: Package installed successfully

**Step 2: Create design system constants**

Create `src/lib/design-system.ts`:

```typescript
/**
 * Design System
 * Color palette, spacing, and design tokens
 */

// Color palette - Academic professional theme
export const colors = {
  // Primary - Deep blue for trust and professionalism
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  // Accent - Vibrant purple for CTAs and highlights
  accent: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  // Sector colors for visual categorization
  sector: {
    academia: '#3b82f6',    // Blue
    government: '#10b981',  // Green
    private: '#f59e0b',     // Orange
    ngo: '#8b5cf6',        // Purple
    unknown: '#6b7280',    // Gray
  }
}

// Spacing scale
export const spacing = {
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem',  // 64px
}

// Border radius
export const borderRadius = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
}

// Shadows
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
}

// Helper function to get sector color
export function getSectorColor(sector: string): string {
  const normalized = sector.toLowerCase()
  return colors.sector[normalized as keyof typeof colors.sector] || colors.sector.unknown
}

// Helper function to get sector background class
export function getSectorBgClass(sector: string): string {
  const map: Record<string, string> = {
    ACADEMIA: 'bg-blue-100 text-blue-700',
    GOVERNMENT: 'bg-green-100 text-green-700',
    PRIVATE: 'bg-orange-100 text-orange-700',
    NGO: 'bg-purple-100 text-purple-700',
    UNKNOWN: 'bg-gray-100 text-gray-700',
  }
  return map[sector] || map.UNKNOWN
}
```

**Step 3: Update Tailwind config with custom colors**

Modify `tailwind.config.ts` to extend with custom palette:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

**Step 4: Verify setup**

```bash
npm run build
```

Expected: Build completes without errors

**Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/design-system.ts tailwind.config.ts
git commit -m "feat: add design system with color palette and spacing tokens"
```

---

## Task 2: Redesign Homepage with Modern Hero Section

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Update root layout with gradient background**

Modify `src/app/layout.tsx` - change body background:

Find the `<body>` tag and update:

```typescript
<body className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
```

**Step 2: Redesign homepage with hero section**

Modify `src/app/page.tsx`:

```typescript
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
```

**Step 3: Test homepage rendering**

```bash
npm run dev
```

Open http://localhost:3000 and verify:
- Gradient hero section displays
- Wave divider renders smoothly
- Animations work
- Mobile responsive

**Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add modern hero section with gradient and animations"
```

---

## Task 3: Enhanced Search Filters with Sticky Sidebar

**Files:**
- Modify: `src/components/search/SearchFilters.tsx`

**Step 1: Make filters sticky on desktop**

Update `SearchFilters.tsx` component wrapper:

```typescript
return (
  <div className="lg:sticky lg:top-4">
    <Card className="w-full shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b bg-gradient-to-r from-primary-50 to-accent-50">
        <CardTitle className="flex items-center gap-2 text-primary-700">
          <Search className="w-5 h-5" />
          Filtros de Busca
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* existing filter content */}
      </CardContent>
    </Card>
  </div>
)
```

**Step 2: Add visual feedback to active filters**

Import at top:
```typescript
import { Search, X } from 'lucide-react'
```

Add active filter badges before existing filters:

```typescript
<CardContent className="space-y-6 pt-6">
  {/* Active Filters Summary */}
  {(filters.query || filters.degreeLevel?.length > 0 || filters.currentSector?.length > 0) && (
    <div className="flex flex-wrap gap-2 pb-4 border-b">
      {filters.query && (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
          {filters.query}
          <X
            className="w-3 h-3 cursor-pointer hover:text-primary-900"
            onClick={() => onFilterChange({ ...filters, query: '' })}
          />
        </span>
      )}
      {filters.degreeLevel?.map(level => (
        <span key={level} className="inline-flex items-center gap-1 px-3 py-1 bg-accent-100 text-accent-700 rounded-full text-xs font-medium">
          {DEGREE_LEVEL_LABELS[level as keyof typeof DEGREE_LEVEL_LABELS]}
          <X
            className="w-3 h-3 cursor-pointer"
            onClick={() => {
              const updated = filters.degreeLevel?.filter(l => l !== level) || []
              onFilterChange({ ...filters, degreeLevel: updated })
            }}
          />
        </span>
      ))}
    </div>
  )}

  {/* Existing filters... */}
</CardContent>
```

**Step 3: Improve button styling**

Replace the search button:

```typescript
<Button
  onClick={onSearch}
  className="w-full bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
  size="lg"
>
  <Search className="w-4 h-4 mr-2" />
  Buscar Acadêmicos
</Button>
```

**Step 4: Test filters**

```bash
npm run dev
```

Verify:
- Sidebar is sticky on scroll (desktop)
- Active filters show as badges
- X button removes filters
- Button has gradient and hover effect

**Step 5: Commit**

```bash
git add src/components/search/SearchFilters.tsx
git commit -m "feat: add sticky sidebar, active filter badges, and improved styling"
```

---

## Task 4: Redesign Academic Cards with Visual Hierarchy

**Files:**
- Modify: `src/components/search/AcademicCard.tsx`

**Step 1: Enhance card with color-coded sectors and animations**

Completely rewrite `AcademicCard.tsx`:

```typescript
'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'
import { getSectorBgClass } from '@/lib/design-system'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  GraduationCap,
  MapPin,
  Briefcase,
  FileText,
  ExternalLink,
  Sparkles
} from 'lucide-react'

type Props = {
  academic: AcademicWithDissertations
}

export function AcademicCard({ academic }: Props) {
  const sectorColor = academic.currentSector
    ? getSectorBgClass(academic.currentSector)
    : 'bg-gray-100 text-gray-700'

  return (
    <Link href={`/academic/${academic.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
        transition={{ duration: 0.2 }}
      >
        <Card className="cursor-pointer border-l-4 border-l-primary-500 hover:border-l-accent-500 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                  {academic.name}
                  {academic.grokEnrichedAt && (
                    <Sparkles className="w-4 h-4 text-accent-500 flex-shrink-0" />
                  )}
                </h3>
                {academic.researchField && (
                  <p className="text-sm text-primary-600 font-medium">
                    {academic.researchField}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 items-end flex-shrink-0">
                {academic.degreeLevel && (
                  <Badge variant="secondary" className="bg-primary-100 text-primary-700 border-primary-200">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    {DEGREE_LEVEL_LABELS[academic.degreeLevel]}
                  </Badge>
                )}
                {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
                  <Badge className={sectorColor}>
                    <Briefcase className="w-3 h-3 mr-1" />
                    {SECTOR_LABELS[academic.currentSector]}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {academic.institution && (
                <div className="flex items-start gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Formação</p>
                    <p className="text-gray-700">{academic.institution}</p>
                    {academic.graduationYear && (
                      <p className="text-xs text-gray-500">{academic.graduationYear}</p>
                    )}
                  </div>
                </div>
              )}

              {(academic.currentCity || academic.currentState) && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Localização</p>
                    <p className="text-gray-700">
                      {[academic.currentCity, academic.currentState]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {academic.currentJobTitle && (
                <div className="flex items-start gap-2 text-sm md:col-span-2">
                  <Briefcase className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Posição Atual</p>
                    <p className="text-gray-700 font-medium">
                      {academic.currentJobTitle}
                      {academic.currentCompany && (
                        <span className="text-gray-600"> @ {academic.currentCompany}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {academic.dissertations.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 font-medium mb-1">
                      {academic.dissertations.length} dissertação(ões)
                    </p>
                    <p className="text-gray-700 line-clamp-2">
                      {academic.dissertations[0].title}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <span className="text-xs text-primary-600 font-medium flex items-center gap-1 hover:gap-2 transition-all">
                Ver perfil completo
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  )
}
```

**Step 2: Test card rendering**

```bash
npm run dev
```

Verify:
- Cards have colored left border
- Sector badges show correct colors
- Hover animation works
- Icons display correctly
- Mobile responsive layout

**Step 3: Commit**

```bash
git add src/components/search/AcademicCard.tsx
git commit -m "feat: redesign academic cards with icons, colors, and animations"
```

---

## Task 5: Improve Search Results Layout

**Files:**
- Modify: `src/components/search/SearchResults.tsx`

**Step 1: Add header with result count and sort options**

Update `SearchResults.tsx`:

```typescript
'use client'

import { AcademicCard } from './AcademicCard'
import { SearchResult } from '@/types'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Loader2, Users } from 'lucide-react'

type Props = {
  result: SearchResult | undefined
  isLoading: boolean
  page: number
  onPageChange: (page: number) => void
}

export function SearchResults({
  result,
  isLoading,
  page,
  onPageChange,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />
        <p className="text-gray-600">Buscando acadêmicos...</p>
      </div>
    )
  }

  if (!result || result.academics.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Nenhum resultado encontrado
        </h3>
        <p className="text-gray-600">
          Tente ajustar os filtros ou buscar por outros termos
        </p>
      </div>
    )
  }

  const totalPages = Math.ceil(result.total / result.pageSize)

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary-100 rounded-lg">
            <Users className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {result.total} {result.total === 1 ? 'Resultado' : 'Resultados'}
            </h2>
            <p className="text-sm text-gray-600">
              Página {page} de {totalPages}
            </p>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <motion.div
        className="grid gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {result.academics.map((academic) => (
          <AcademicCard key={academic.id} academic={academic} />
        ))}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-8">
          <Button
            variant="outline"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="min-w-[100px]"
          >
            ← Anterior
          </Button>

          <div className="flex items-center gap-2 px-4">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }

              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'ghost'}
                  onClick={() => onPageChange(pageNum)}
                  className={pageNum === page ? 'bg-primary-600' : ''}
                  size="sm"
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="min-w-[100px]"
          >
            Próxima →
          </Button>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Test results display**

```bash
npm run dev
```

Verify:
- Result count header displays
- Pagination shows page numbers
- Loading state shows spinner
- Empty state shows helpful message

**Step 3: Commit**

```bash
git add src/components/search/SearchResults.tsx
git commit -m "feat: improve results layout with header and better pagination"
```

---

## Task 6: Redesign Academic Detail Page

**Files:**
- Modify: `src/app/academic/[id]/page.tsx`

**Step 1: Enhance detail page layout**

Replace the detail page content (keep the fetch functions and hooks):

```typescript
return (
  <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium mb-6 group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar à busca
      </Link>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="shadow-xl border-0 overflow-hidden bg-white/80 backdrop-blur-sm">
          {/* Header with gradient */}
          <div className="h-32 bg-gradient-to-r from-primary-600 via-primary-700 to-accent-600 relative">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:30px_30px]" />
          </div>

          <CardHeader className="-mt-16 relative z-10">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Avatar */}
              <div className="w-32 h-32 bg-gradient-to-br from-primary-100 to-accent-100 rounded-2xl border-4 border-white shadow-xl flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-16 h-16 text-primary-600" />
              </div>

              {/* Name and basic info */}
              <div className="flex-1 pt-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  {academic.name}
                </h1>
                {academic.researchField && (
                  <p className="text-lg text-primary-600 font-medium mb-4">
                    {academic.researchField}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {academic.degreeLevel && (
                    <Badge className="bg-primary-100 text-primary-700 border-primary-200">
                      <GraduationCap className="w-3 h-3 mr-1" />
                      {DEGREE_LEVEL_LABELS[academic.degreeLevel]}
                    </Badge>
                  )}
                  {academic.enrichmentStatus && (
                    <Badge
                      variant={academic.enrichmentStatus === 'COMPLETE' ? 'default' : 'outline'}
                      className={academic.enrichmentStatus === 'COMPLETE' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                    >
                      {academic.enrichmentStatus === 'COMPLETE' ? 'Perfil completo' : 'Perfil parcial'}
                    </Badge>
                  )}
                  {academic.grokEnrichedAt && (
                    <Badge className="bg-accent-100 text-accent-700 border-accent-200">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Enriquecido com IA
                    </Badge>
                  )}
                </div>
              </div>

              {/* Enrich button */}
              <div className="pt-8">
                <Button
                  onClick={() => enrichMutation.mutate()}
                  disabled={enrichMutation.isPending}
                  className="bg-gradient-to-r from-accent-600 to-accent-700 hover:from-accent-700 hover:to-accent-800"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {enrichMutation.isPending ? 'Enriquecendo...' : 'Atualizar dados'}
                </Button>
                {enrichMutation.isError && (
                  <p className="text-xs text-red-600 mt-2">Erro ao atualizar</p>
                )}
                {enrichMutation.isSuccess && (
                  <p className="text-xs text-green-600 mt-2">Dados atualizados!</p>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 pt-8">
            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Education */}
              <Card className="border-l-4 border-l-primary-500 shadow-sm">
                <CardHeader className="pb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary-600" />
                    Formação Acadêmica
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {academic.institution && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Instituição</p>
                      <p className="text-gray-900 font-medium">{academic.institution}</p>
                    </div>
                  )}
                  {academic.graduationYear && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Ano de conclusão</p>
                      <p className="text-gray-900">{academic.graduationYear}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Current Position */}
              <Card className="border-l-4 border-l-accent-500 shadow-sm">
                <CardHeader className="pb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-accent-600" />
                    Posição Atual
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {academic.currentJobTitle ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Cargo</p>
                        <p className="text-gray-900 font-medium">
                          {academic.currentJobTitle}
                          {academic.currentCompany && ` @ ${academic.currentCompany}`}
                        </p>
                      </div>
                      {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Setor</p>
                          <Badge className={getSectorBgClass(academic.currentSector)}>
                            {SECTOR_LABELS[academic.currentSector]}
                          </Badge>
                        </div>
                      )}
                      {(academic.currentCity || academic.currentState) && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Localização</p>
                          <p className="text-gray-900 flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            {[academic.currentCity, academic.currentState].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500 italic">Informação não disponível</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Links */}
            {(academic.linkedinUrl || academic.lattesUrl) && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-gray-600" />
                    Links Profissionais
                  </h3>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {academic.linkedinUrl && (
                    <a
                      href={academic.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182] transition-colors font-medium"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </a>
                  )}
                  {academic.lattesUrl && (
                    <a
                      href={academic.lattesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-colors font-medium"
                    >
                      <FileText className="w-5 h-5" />
                      Currículo Lattes
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Dissertations */}
            {academic.dissertations.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-gray-600" />
                  Dissertações e Teses ({academic.dissertations.length})
                </h3>
                <div className="space-y-4">
                  {academic.dissertations.map((diss) => (
                    <Card key={diss.id} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <h4 className="font-semibold text-lg text-gray-900 mb-3">
                          {diss.title}
                        </h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600 mb-3">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-4 h-4" />
                            {diss.institution}
                          </span>
                          <span>•</span>
                          <span>{diss.defenseYear}</span>
                          {diss.program && (
                            <>
                              <span>•</span>
                              <span>{diss.program}</span>
                            </>
                          )}
                        </div>
                        {diss.advisorName && (
                          <p className="text-sm text-gray-700 mb-3">
                            <span className="font-medium">Orientador:</span> {diss.advisorName}
                          </p>
                        )}
                        {diss.abstract && (
                          <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                            {diss.abstract.substring(0, 400)}
                            {diss.abstract.length > 400 && '...'}
                          </p>
                        )}
                        {diss.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {diss.keywords.map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-gray-50">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {diss.sourceUrl && (
                          <a
                            href={diss.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Ver no Sucupira
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  </main>
)
```

Add missing imports at the top:

```typescript
import { motion } from 'framer-motion'
import {
  GraduationCap,
  Sparkles,
  Briefcase,
  MapPin,
  FileText,
  ExternalLink
} from 'lucide-react'
import { getSectorBgClass } from '@/lib/design-system'
```

**Step 2: Test detail page**

```bash
npm run dev
```

Verify:
- Gradient header displays
- Avatar placeholder shows
- Info cards have colored borders
- LinkedIn/Lattes buttons work
- Mobile responsive

**Step 3: Commit**

```bash
git add src/app/academic/[id]/page.tsx
git commit -m "feat: redesign academic detail page with modern layout and gradients"
```

---

## Task 7: Mobile Responsiveness and Touch Optimization

**Files:**
- Modify: `src/components/search/SearchFilters.tsx`
- Create: `src/components/search/MobileFilterDrawer.tsx`

**Step 1: Create mobile filter drawer component**

Create `src/components/search/MobileFilterDrawer.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SearchFilters } from './SearchFilters'
import { SearchFilters as SearchFiltersType } from '@/types'
import { SlidersHorizontal } from 'lucide-react'

type Props = {
  filters: SearchFiltersType
  onFilterChange: (filters: SearchFiltersType) => void
  onSearch: () => void
}

export function MobileFilterDrawer({ filters, onFilterChange, onSearch }: Props) {
  const [open, setOpen] = useState(false)

  const handleSearch = () => {
    onSearch()
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="w-full lg:hidden mb-4"
          size="lg"
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filtros de Busca
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros de Busca</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <SearchFilters
            filters={filters}
            onFilterChange={onFilterChange}
            onSearch={handleSearch}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

**Step 2: Add Sheet component from Radix**

Create `src/components/ui/sheet.tsx`:

```typescript
"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = {
  left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
  right: "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
}

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: keyof typeof sheetVariants
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 gap-4 bg-white p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
        sheetVariants[side],
        className
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-gray-100">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-gray-950", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
}
```

**Step 3: Install Radix Sheet dependency**

```bash
npm install @radix-ui/react-dialog
```

**Step 4: Update homepage to use mobile drawer**

Modify `src/app/page.tsx` to import and use the drawer:

```typescript
import { MobileFilterDrawer } from '@/components/search/MobileFilterDrawer'
```

Replace the search section grid:

```typescript
<section className="container mx-auto px-4 py-8 md:py-12">
  <MobileFilterDrawer
    filters={filters}
    onFilterChange={setFilters}
    onSearch={handleSearch}
  />

  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <aside className="hidden lg:block lg:col-span-1">
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
```

**Step 5: Test mobile responsiveness**

```bash
npm run dev
```

Open in mobile view (DevTools responsive mode):
- Verify filter drawer opens from left
- Sidebar hidden on mobile, shown on desktop
- Touch targets are large enough (min 44x44px)
- Buttons are easy to tap

**Step 6: Commit**

```bash
git add src/components/search/MobileFilterDrawer.tsx src/components/ui/sheet.tsx src/app/page.tsx package.json package-lock.json
git commit -m "feat: add mobile filter drawer and responsive layout"
```

---

## Task 8: Performance and Accessibility Improvements

**Files:**
- Modify: `src/components/search/AcademicCard.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Add loading skeletons**

Create `src/components/ui/skeleton.tsx`:

```typescript
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

**Step 2: Create loading skeleton for cards**

Add to `src/components/search/SearchResults.tsx`:

```typescript
import { Skeleton } from '@/components/ui/skeleton'

function AcademicCardSkeleton() {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  )
}
```

Use the skeleton in loading state:

```typescript
if (isLoading) {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <AcademicCardSkeleton key={i} />
      ))}
    </div>
  )
}
```

**Step 3: Add ARIA labels for accessibility**

Update `AcademicCard.tsx` link:

```typescript
<Link
  href={`/academic/${academic.id}`}
  aria-label={`Ver perfil de ${academic.name}, ${academic.researchField || 'pesquisador'}`}
>
```

Update search button in filters:

```typescript
<Button
  onClick={onSearch}
  className="..."
  aria-label="Buscar acadêmicos com os filtros selecionados"
>
```

**Step 4: Test accessibility**

```bash
npm run dev
```

Use browser DevTools Lighthouse:
- Run accessibility audit
- Verify ARIA labels present
- Check keyboard navigation works
- Test screen reader compatibility

**Step 5: Commit**

```bash
git add src/components/ui/skeleton.tsx src/components/search/SearchResults.tsx src/components/search/AcademicCard.tsx src/components/search/SearchFilters.tsx
git commit -m "feat: add loading skeletons and accessibility improvements"
```

---

## Task 9: Final Polish and Testing

**Step 1: Run production build**

```bash
npm run build
```

Expected: Build completes successfully with no errors

**Step 2: Test production build**

```bash
npm run start
```

Verify:
- All pages load correctly
- Animations are smooth
- Mobile drawer works
- Search functionality works
- Grok enrichment works
- No console errors

**Step 3: Run linter**

```bash
npm run lint
```

Fix any linting errors if present.

**Step 4: Create final commit**

```bash
git add -A
git commit -m "chore: final polish and production build verification"
```

**Step 5: Push to main**

```bash
git push origin main
```

---

## Implementation Summary

**What was built:**
1. ✅ Modern design system with color palette
2. ✅ Gradient hero section with animations
3. ✅ Sticky sidebar filters with active badges
4. ✅ Color-coded academic cards with icons
5. ✅ Enhanced search results with pagination
6. ✅ Redesigned detail page with gradients
7. ✅ Mobile-responsive drawer filters
8. ✅ Loading skeletons and accessibility
9. ✅ Production-ready build

**Design improvements:**
- Professional color scheme (blue/purple)
- Sector-based color coding
- Smooth animations and transitions
- Modern gradients and glassmorphism
- Mobile-first responsive design
- Rich visual hierarchy
- Icons from Lucide
- Improved spacing and typography

**UX improvements:**
- Sticky filters on desktop
- Mobile drawer for filters
- Active filter badges with remove
- Loading skeletons
- Better pagination
- Keyboard navigation
- Screen reader support
- Touch-optimized buttons

**Mobile optimizations:**
- Responsive breakpoints
- Collapsible filters in drawer
- Touch-friendly button sizes
- Optimized layouts for small screens
- Reduced content on mobile cards

**Ready for production!**
