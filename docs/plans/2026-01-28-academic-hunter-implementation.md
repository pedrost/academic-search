# Academic Hunter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a POC system to discover and track Brazilian academics in Mato Grosso do Sul, with search UI and operator-assisted data enrichment.

**Architecture:** Next.js full-stack app with Playwright scrapers running as background workers. PostgreSQL for data, Redis + BullMQ for job queues. Operators intervene via admin dashboard when scrapers hit obstacles.

**Tech Stack:** TypeScript, Next.js 14 (App Router), Prisma, PostgreSQL, Redis, BullMQ, Playwright + stealth plugin, Tailwind CSS, shadcn/ui

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `.gitignore`

**Step 1: Initialize Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Select defaults when prompted. This creates the base Next.js structure.

**Step 2: Verify Next.js runs**

Run:
```bash
npm run dev
```

Expected: Server starts at http://localhost:3000, shows Next.js welcome page.

Stop the dev server (Ctrl+C).

**Step 3: Install additional dependencies**

Run:
```bash
npm install prisma @prisma/client bullmq ioredis playwright playwright-extra puppeteer-extra-plugin-stealth @tanstack/react-query zod date-fns
```

**Step 4: Install shadcn/ui**

Run:
```bash
npx shadcn@latest init
```

Select:
- Style: Default
- Base color: Neutral
- CSS variables: Yes

**Step 5: Add shadcn components we'll need**

Run:
```bash
npx shadcn@latest add button input card table badge select checkbox dialog tabs
```

**Step 6: Create Docker Compose file**

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: hunter-postgres
    environment:
      POSTGRES_USER: hunter
      POSTGRES_PASSWORD: hunter_dev
      POSTGRES_DB: hunter
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: hunter-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

**Step 7: Create environment file**

Create `.env.example`:

```env
DATABASE_URL="postgresql://hunter:hunter_dev@localhost:5432/hunter"
REDIS_URL="redis://localhost:6379"
```

Copy to `.env`:
```bash
cp .env.example .env
```

**Step 8: Update .gitignore**

Add to `.gitignore`:

```
# Environment
.env
.env.local

# Playwright
/playwright-data/
/browser-profiles/

# IDE
.idea/
.vscode/
```

**Step 9: Start Docker services**

Run:
```bash
docker-compose up -d
```

Expected: Both postgres and redis containers start.

Verify:
```bash
docker-compose ps
```

Expected: Both services show "Up".

**Step 10: Commit**

```bash
git add -A
git commit -m "chore: initialize Next.js project with Docker infrastructure"
```

---

## Task 2: Database Schema with Prisma

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db/index.ts`

**Step 1: Initialize Prisma**

Run:
```bash
npx prisma init
```

**Step 2: Define the database schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum DegreeLevel {
  MASTERS
  PHD
  POSTDOC
}

enum Sector {
  ACADEMIA
  GOVERNMENT
  PRIVATE
  NGO
  UNKNOWN
}

enum EnrichmentStatus {
  PENDING
  PARTIAL
  COMPLETE
}

enum TaskType {
  CAPTCHA
  LINKEDIN_MATCH
  LOGIN_EXPIRED
  MANUAL_REVIEW
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
}

enum ScraperSource {
  SUCUPIRA
  LATTES
  LINKEDIN
}

enum ScraperStatus {
  RUNNING
  PAUSED
  WAITING_INTERVENTION
  COMPLETED
  FAILED
}

model Academic {
  id               String           @id @default(cuid())
  name             String
  email            String?
  researchField    String?          @map("research_field")
  degreeLevel      DegreeLevel?     @map("degree_level")
  graduationYear   Int?             @map("graduation_year")
  institution      String?
  currentCity      String?          @map("current_city")
  currentState     String?          @map("current_state")
  currentSector    Sector           @default(UNKNOWN) @map("current_sector")
  currentJobTitle  String?          @map("current_job_title")
  currentCompany   String?          @map("current_company")
  linkedinUrl      String?          @map("linkedin_url")
  lattesUrl        String?          @map("lattes_url")
  enrichmentStatus EnrichmentStatus @default(PENDING) @map("enrichment_status")
  lastEnrichedAt   DateTime?        @map("last_enriched_at")
  createdAt        DateTime         @default(now()) @map("created_at")
  updatedAt        DateTime         @updatedAt @map("updated_at")

  dissertations    Dissertation[]
  enrichmentTasks  EnrichmentTask[]

  @@map("academics")
}

model Dissertation {
  id           String   @id @default(cuid())
  academicId   String   @map("academic_id")
  title        String
  abstract     String?
  keywords     String[]
  defenseYear  Int      @map("defense_year")
  institution  String
  program      String?
  advisorName  String?  @map("advisor_name")
  sourceUrl    String?  @map("source_url")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  academic     Academic @relation(fields: [academicId], references: [id], onDelete: Cascade)

  @@map("dissertations")
}

model EnrichmentTask {
  id          String     @id @default(cuid())
  academicId  String?    @map("academic_id")
  taskType    TaskType   @map("task_type")
  status      TaskStatus @default(PENDING)
  payload     Json?
  assignedTo  String?    @map("assigned_to")
  priority    Int        @default(0)
  createdAt   DateTime   @default(now()) @map("created_at")
  completedAt DateTime?  @map("completed_at")

  academic    Academic?  @relation(fields: [academicId], references: [id], onDelete: Cascade)

  @@index([status, priority])
  @@map("enrichment_tasks")
}

model ScraperSession {
  id              String        @id @default(cuid())
  source          ScraperSource
  status          ScraperStatus @default(RUNNING)
  profilesScraped Int           @default(0) @map("profiles_scraped")
  tasksCreated    Int           @default(0) @map("tasks_created")
  errors          Int           @default(0)
  lastActivityAt  DateTime      @default(now()) @map("last_activity_at")
  metadata        Json?
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  @@map("scraper_sessions")
}
```

**Step 3: Create Prisma client singleton**

Create `src/lib/db/index.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 4: Run database migration**

Run:
```bash
npx prisma migrate dev --name init
```

Expected: Migration created and applied. Prisma Client generated.

**Step 5: Verify with Prisma Studio**

Run:
```bash
npx prisma studio
```

Expected: Opens browser at http://localhost:5555, shows empty tables.

Close Prisma Studio (Ctrl+C).

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema with Academic, Dissertation, EnrichmentTask, ScraperSession models"
```

---

## Task 3: Shared Types and Constants

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/constants.ts`

**Step 1: Create shared types**

Create `src/types/index.ts`:

```typescript
import { Academic, Dissertation, EnrichmentTask, ScraperSession } from '@prisma/client'

export type AcademicWithDissertations = Academic & {
  dissertations: Dissertation[]
}

export type SearchFilters = {
  query?: string
  researchField?: string
  degreeLevel?: string[]
  graduationYearMin?: number
  graduationYearMax?: number
  currentState?: string
  currentCity?: string
  currentSector?: string[]
}

export type SearchResult = {
  academics: AcademicWithDissertations[]
  total: number
  page: number
  pageSize: number
}

export type TaskWithAcademic = EnrichmentTask & {
  academic: Academic | null
}

export type LinkedInCandidate = {
  name: string
  headline: string
  location: string
  profileUrl: string
  imageUrl?: string
}

export type CaptchaPayload = {
  imageUrl: string
  siteUrl: string
}

export type LinkedInMatchPayload = {
  candidates: LinkedInCandidate[]
  searchQuery: string
}
```

**Step 2: Create constants**

Create `src/lib/constants.ts`:

```typescript
export const RESEARCH_FIELDS = [
  'Ciências Agrárias',
  'Ciências Biológicas',
  'Ciências da Saúde',
  'Ciências Exatas e da Terra',
  'Ciências Humanas',
  'Ciências Sociais Aplicadas',
  'Engenharias',
  'Linguística, Letras e Artes',
  'Multidisciplinar',
] as const

export const MS_INSTITUTIONS = [
  'UFMS - Universidade Federal de Mato Grosso do Sul',
  'UEMS - Universidade Estadual de Mato Grosso do Sul',
  'UFGD - Universidade Federal da Grande Dourados',
  'UCDB - Universidade Católica Dom Bosco',
  'Uniderp - Universidade Anhanguera-Uniderp',
] as const

export const MS_CITIES = [
  'Campo Grande',
  'Dourados',
  'Três Lagoas',
  'Corumbá',
  'Ponta Porã',
  'Naviraí',
  'Nova Andradina',
  'Aquidauana',
  'Paranaíba',
  'Coxim',
] as const

export const BRAZILIAN_STATES = [
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'GO', name: 'Goiás' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PR', name: 'Paraná' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'RS', name: 'Rio Grande do Sul' },
] as const

export const DEGREE_LEVEL_LABELS = {
  MASTERS: 'Mestrado',
  PHD: 'Doutorado',
  POSTDOC: 'Pós-Doutorado',
} as const

export const SECTOR_LABELS = {
  ACADEMIA: 'Academia',
  GOVERNMENT: 'Governo',
  PRIVATE: 'Setor Privado',
  NGO: 'ONG',
  UNKNOWN: 'Não informado',
} as const
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add shared types and constants"
```

---

## Task 4: Search API Endpoint

**Files:**
- Create: `src/app/api/academics/search/route.ts`
- Create: `src/lib/db/academics.ts`

**Step 1: Create academics query helpers**

Create `src/lib/db/academics.ts`:

```typescript
import { prisma } from '@/lib/db'
import { SearchFilters, SearchResult } from '@/types'
import { Prisma } from '@prisma/client'

export async function searchAcademics(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<SearchResult> {
  const where: Prisma.AcademicWhereInput = {}

  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query, mode: 'insensitive' } },
      { researchField: { contains: filters.query, mode: 'insensitive' } },
      {
        dissertations: {
          some: {
            OR: [
              { title: { contains: filters.query, mode: 'insensitive' } },
              { keywords: { has: filters.query } },
            ],
          },
        },
      },
    ]
  }

  if (filters.researchField) {
    where.researchField = { contains: filters.researchField, mode: 'insensitive' }
  }

  if (filters.degreeLevel && filters.degreeLevel.length > 0) {
    where.degreeLevel = { in: filters.degreeLevel as any[] }
  }

  if (filters.graduationYearMin || filters.graduationYearMax) {
    where.graduationYear = {}
    if (filters.graduationYearMin) {
      where.graduationYear.gte = filters.graduationYearMin
    }
    if (filters.graduationYearMax) {
      where.graduationYear.lte = filters.graduationYearMax
    }
  }

  if (filters.currentState) {
    where.currentState = filters.currentState
  }

  if (filters.currentCity) {
    where.currentCity = { contains: filters.currentCity, mode: 'insensitive' }
  }

  if (filters.currentSector && filters.currentSector.length > 0) {
    where.currentSector = { in: filters.currentSector as any[] }
  }

  const [academics, total] = await Promise.all([
    prisma.academic.findMany({
      where,
      include: { dissertations: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
    }),
    prisma.academic.count({ where }),
  ])

  return { academics, total, page, pageSize }
}

export async function getAcademicById(id: string) {
  return prisma.academic.findUnique({
    where: { id },
    include: { dissertations: true },
  })
}
```

**Step 2: Create search API route**

Create `src/app/api/academics/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { searchAcademics } from '@/lib/db/academics'
import { SearchFilters } from '@/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const filters: SearchFilters = {
    query: searchParams.get('q') || undefined,
    researchField: searchParams.get('researchField') || undefined,
    degreeLevel: searchParams.getAll('degreeLevel'),
    graduationYearMin: searchParams.get('yearMin')
      ? parseInt(searchParams.get('yearMin')!)
      : undefined,
    graduationYearMax: searchParams.get('yearMax')
      ? parseInt(searchParams.get('yearMax')!)
      : undefined,
    currentState: searchParams.get('state') || undefined,
    currentCity: searchParams.get('city') || undefined,
    currentSector: searchParams.getAll('sector'),
  }

  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')

  try {
    const result = await searchAcademics(filters, page, pageSize)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Failed to search academics' },
      { status: 500 }
    )
  }
}
```

**Step 3: Verify API works**

Run:
```bash
npm run dev
```

In another terminal:
```bash
curl "http://localhost:3000/api/academics/search"
```

Expected: Returns JSON with empty academics array, total 0.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add search API endpoint with filters"
```

---

## Task 5: Search UI - Page Layout

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/layout.tsx` (modify existing)
- Create: `src/components/search/SearchFilters.tsx`
- Create: `src/components/search/SearchResults.tsx`
- Create: `src/components/search/AcademicCard.tsx`

**Step 1: Set up React Query provider**

Create `src/components/providers/QueryProvider.tsx`:

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
```

**Step 2: Update root layout**

Modify `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/components/providers/QueryProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Hunter - Academic Search',
  description: 'Find academic experts in Mato Grosso do Sul',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
```

**Step 3: Create SearchFilters component**

Create `src/components/search/SearchFilters.tsx`:

```typescript
'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  onSearch: () => void
}

export function SearchFilters({ filters, onFilterChange, onSearch }: Props) {
  const handleDegreeLevelChange = (level: string, checked: boolean) => {
    const current = filters.degreeLevel || []
    const updated = checked
      ? [...current, level]
      : current.filter((l) => l !== level)
    onFilterChange({ ...filters, degreeLevel: updated })
  }

  const handleSectorChange = (sector: string, checked: boolean) => {
    const current = filters.currentSector || []
    const updated = checked
      ? [...current, sector]
      : current.filter((s) => s !== sector)
    onFilterChange({ ...filters, currentSector: updated })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Buscar por nome ou palavra-chave
          </label>
          <Input
            placeholder="Ex: agricultura familiar, Maria Silva..."
            value={filters.query || ''}
            onChange={(e) =>
              onFilterChange({ ...filters, query: e.target.value })
            }
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Área de Pesquisa
          </label>
          <Select
            value={filters.researchField || ''}
            onValueChange={(value) =>
              onFilterChange({
                ...filters,
                researchField: value || undefined,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as áreas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as áreas</SelectItem>
              {RESEARCH_FIELDS.map((field) => (
                <SelectItem key={field} value={field}>
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Nível de Formação
          </label>
          <div className="space-y-2">
            {Object.entries(DEGREE_LEVEL_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={`degree-${key}`}
                  checked={filters.degreeLevel?.includes(key) || false}
                  onCheckedChange={(checked) =>
                    handleDegreeLevelChange(key, checked as boolean)
                  }
                />
                <label htmlFor={`degree-${key}`} className="text-sm">
                  {label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Cidade Atual</label>
          <Select
            value={filters.currentCity || ''}
            onValueChange={(value) =>
              onFilterChange({ ...filters, currentCity: value || undefined })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as cidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as cidades</SelectItem>
              {MS_CITIES.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Setor Atual</label>
          <div className="space-y-2">
            {Object.entries(SECTOR_LABELS)
              .filter(([key]) => key !== 'UNKNOWN')
              .map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sector-${key}`}
                    checked={filters.currentSector?.includes(key) || false}
                    onCheckedChange={(checked) =>
                      handleSectorChange(key, checked as boolean)
                    }
                  />
                  <label htmlFor={`sector-${key}`} className="text-sm">
                    {label}
                  </label>
                </div>
              ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Ano Mín.</label>
            <Input
              type="number"
              placeholder="2010"
              value={filters.graduationYearMin || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  graduationYearMin: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Ano Máx.</label>
            <Input
              type="number"
              placeholder="2024"
              value={filters.graduationYearMax || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  graduationYearMax: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
        </div>

        <Button onClick={onSearch} className="w-full">
          Buscar
        </Button>
      </CardContent>
    </Card>
  )
}
```

**Step 4: Create AcademicCard component**

Create `src/components/search/AcademicCard.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'
import Link from 'next/link'

type Props = {
  academic: AcademicWithDissertations
}

export function AcademicCard({ academic }: Props) {
  return (
    <Link href={`/academic/${academic.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">{academic.name}</CardTitle>
            {academic.degreeLevel && (
              <Badge variant="secondary">
                {DEGREE_LEVEL_LABELS[academic.degreeLevel]}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {academic.researchField && (
            <p className="text-sm text-muted-foreground">
              {academic.researchField}
            </p>
          )}

          {academic.institution && (
            <p className="text-sm">
              <span className="font-medium">Instituição:</span>{' '}
              {academic.institution}
            </p>
          )}

          {(academic.currentCity || academic.currentState) && (
            <p className="text-sm">
              <span className="font-medium">Localização:</span>{' '}
              {[academic.currentCity, academic.currentState]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}

          {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
            <p className="text-sm">
              <span className="font-medium">Setor:</span>{' '}
              {SECTOR_LABELS[academic.currentSector]}
            </p>
          )}

          {academic.currentJobTitle && (
            <p className="text-sm">
              <span className="font-medium">Cargo:</span>{' '}
              {academic.currentJobTitle}
              {academic.currentCompany && ` @ ${academic.currentCompany}`}
            </p>
          )}

          {academic.dissertations.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {academic.dissertations.length} dissertação(ões)
              </p>
              <p className="text-sm truncate">
                {academic.dissertations[0].title}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
```

**Step 5: Create SearchResults component**

Create `src/components/search/SearchResults.tsx`:

```typescript
'use client'

import { AcademicCard } from './AcademicCard'
import { SearchResult } from '@/types'
import { Button } from '@/components/ui/button'

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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!result || result.academics.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum acadêmico encontrado. Tente ajustar os filtros.
      </div>
    )
  }

  const totalPages = Math.ceil(result.total / result.pageSize)

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {result.total} resultado(s) encontrado(s)
      </div>

      <div className="grid gap-4">
        {result.academics.map((academic) => (
          <AcademicCard key={academic.id} academic={academic} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="flex items-center px-4">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
```

**Step 6: Create main search page**

Replace `src/app/page.tsx`:

```typescript
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
```

**Step 7: Verify the search UI**

Run:
```bash
npm run dev
```

Open http://localhost:3000 in browser.

Expected: Search page with filters sidebar and empty results message.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add search UI with filters and results display"
```

---

## Task 6: Academic Detail Page

**Files:**
- Create: `src/app/academic/[id]/page.tsx`
- Create: `src/app/api/academics/[id]/route.ts`

**Step 1: Create API route for single academic**

Create `src/app/api/academics/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAcademicById } from '@/lib/db/academics'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const academic = await getAcademicById(params.id)

    if (!academic) {
      return NextResponse.json(
        { error: 'Academic not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(academic)
  } catch (error) {
    console.error('Error fetching academic:', error)
    return NextResponse.json(
      { error: 'Failed to fetch academic' },
      { status: 500 }
    )
  }
}
```

**Step 2: Create academic detail page**

Create `src/app/academic/[id]/page.tsx`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'

async function fetchAcademic(id: string): Promise<AcademicWithDissertations> {
  const res = await fetch(`/api/academics/${id}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function AcademicDetailPage() {
  const params = useParams()
  const id = params.id as string

  const { data: academic, isLoading, error } = useQuery({
    queryKey: ['academic', id],
    queryFn: () => fetchAcademic(id),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !academic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Acadêmico não encontrado</p>
        <Link href="/">
          <Button variant="outline">Voltar à busca</Button>
        </Link>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 max-w-4xl">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Voltar à busca
        </Link>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{academic.name}</CardTitle>
                {academic.researchField && (
                  <p className="text-muted-foreground mt-1">
                    {academic.researchField}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {academic.degreeLevel && (
                  <Badge variant="secondary">
                    {DEGREE_LEVEL_LABELS[academic.degreeLevel]}
                  </Badge>
                )}
                {academic.enrichmentStatus && (
                  <Badge
                    variant={
                      academic.enrichmentStatus === 'COMPLETE'
                        ? 'default'
                        : 'outline'
                    }
                  >
                    {academic.enrichmentStatus === 'COMPLETE'
                      ? 'Dados completos'
                      : 'Dados parciais'}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <section className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Formação</h3>
                <dl className="space-y-1 text-sm">
                  {academic.institution && (
                    <>
                      <dt className="text-muted-foreground">Instituição</dt>
                      <dd>{academic.institution}</dd>
                    </>
                  )}
                  {academic.graduationYear && (
                    <>
                      <dt className="text-muted-foreground">Ano de conclusão</dt>
                      <dd>{academic.graduationYear}</dd>
                    </>
                  )}
                </dl>
              </div>

              <div>
                <h3 className="font-medium mb-2">Situação Atual</h3>
                <dl className="space-y-1 text-sm">
                  {academic.currentJobTitle && (
                    <>
                      <dt className="text-muted-foreground">Cargo</dt>
                      <dd>
                        {academic.currentJobTitle}
                        {academic.currentCompany &&
                          ` @ ${academic.currentCompany}`}
                      </dd>
                    </>
                  )}
                  {academic.currentSector &&
                    academic.currentSector !== 'UNKNOWN' && (
                      <>
                        <dt className="text-muted-foreground">Setor</dt>
                        <dd>{SECTOR_LABELS[academic.currentSector]}</dd>
                      </>
                    )}
                  {(academic.currentCity || academic.currentState) && (
                    <>
                      <dt className="text-muted-foreground">Localização</dt>
                      <dd>
                        {[academic.currentCity, academic.currentState]
                          .filter(Boolean)
                          .join(', ')}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            </section>

            <section>
              <h3 className="font-medium mb-2">Links</h3>
              <div className="flex gap-4">
                {academic.linkedinUrl && (
                  <a
                    href={academic.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    LinkedIn →
                  </a>
                )}
                {academic.lattesUrl && (
                  <a
                    href={academic.lattesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Lattes →
                  </a>
                )}
              </div>
            </section>

            {academic.dissertations.length > 0 && (
              <section>
                <h3 className="font-medium mb-4">Dissertações / Teses</h3>
                <div className="space-y-4">
                  {academic.dissertations.map((diss) => (
                    <Card key={diss.id}>
                      <CardContent className="pt-4">
                        <h4 className="font-medium">{diss.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {diss.institution} • {diss.defenseYear}
                          {diss.program && ` • ${diss.program}`}
                        </p>
                        {diss.advisorName && (
                          <p className="text-sm mt-1">
                            Orientador: {diss.advisorName}
                          </p>
                        )}
                        {diss.abstract && (
                          <p className="text-sm mt-2 text-muted-foreground">
                            {diss.abstract.substring(0, 300)}
                            {diss.abstract.length > 300 && '...'}
                          </p>
                        )}
                        {diss.keywords.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {diss.keywords.map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
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
                            className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                          >
                            Ver no Sucupira →
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

**Step 3: Verify detail page**

Run dev server if not running. Since we have no data, we can't fully test, but verify the route exists by visiting http://localhost:3000/academic/test

Expected: "Acadêmico não encontrado" message with back link.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add academic detail page"
```

---

## Task 7: Seed Database with Test Data

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

**Step 1: Create seed script**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient, DegreeLevel, Sector, EnrichmentStatus } from '@prisma/client'

const prisma = new PrismaClient()

const testAcademics = [
  {
    name: 'Maria Silva Santos',
    researchField: 'Ciências Agrárias',
    degreeLevel: DegreeLevel.PHD,
    graduationYear: 2020,
    institution: 'UFMS - Universidade Federal de Mato Grosso do Sul',
    currentCity: 'Campo Grande',
    currentState: 'MS',
    currentSector: Sector.ACADEMIA,
    currentJobTitle: 'Professora Adjunta',
    currentCompany: 'UFMS',
    enrichmentStatus: EnrichmentStatus.COMPLETE,
    dissertations: [
      {
        title: 'Impactos da agricultura familiar na segurança alimentar do Mato Grosso do Sul',
        abstract: 'Esta tese investiga os impactos da agricultura familiar na segurança alimentar das comunidades rurais do estado de Mato Grosso do Sul, analisando aspectos socioeconômicos e ambientais.',
        keywords: ['agricultura familiar', 'segurança alimentar', 'desenvolvimento rural'],
        defenseYear: 2020,
        institution: 'UFMS',
        program: 'Programa de Pós-Graduação em Agronomia',
        advisorName: 'Dr. João Carlos Mendes',
      },
    ],
  },
  {
    name: 'Pedro Henrique Oliveira',
    researchField: 'Ciências da Saúde',
    degreeLevel: DegreeLevel.MASTERS,
    graduationYear: 2022,
    institution: 'UFGD - Universidade Federal da Grande Dourados',
    currentCity: 'Dourados',
    currentState: 'MS',
    currentSector: Sector.GOVERNMENT,
    currentJobTitle: 'Coordenador de Vigilância Epidemiológica',
    currentCompany: 'Secretaria de Saúde de Dourados',
    enrichmentStatus: EnrichmentStatus.PARTIAL,
    dissertations: [
      {
        title: 'Análise epidemiológica da dengue na região da Grande Dourados entre 2015 e 2021',
        abstract: 'Estudo epidemiológico descritivo que analisa a incidência de dengue na região da Grande Dourados.',
        keywords: ['epidemiologia', 'dengue', 'saúde pública'],
        defenseYear: 2022,
        institution: 'UFGD',
        program: 'Programa de Pós-Graduação em Ciências da Saúde',
        advisorName: 'Dra. Ana Paula Fernandes',
      },
    ],
  },
  {
    name: 'Carla Beatriz Ferreira',
    researchField: 'Ciências Humanas',
    degreeLevel: DegreeLevel.PHD,
    graduationYear: 2019,
    institution: 'UEMS - Universidade Estadual de Mato Grosso do Sul',
    currentCity: 'Campo Grande',
    currentState: 'MS',
    currentSector: Sector.PRIVATE,
    currentJobTitle: 'Consultora de Políticas Públicas',
    currentCompany: 'Instituto Cerrado',
    enrichmentStatus: EnrichmentStatus.COMPLETE,
    linkedinUrl: 'https://linkedin.com/in/carlabferreira',
    dissertations: [
      {
        title: 'Políticas públicas de educação indígena no Mato Grosso do Sul: desafios e perspectivas',
        abstract: 'Análise crítica das políticas públicas voltadas à educação indígena no estado.',
        keywords: ['educação indígena', 'políticas públicas', 'diversidade cultural'],
        defenseYear: 2019,
        institution: 'UEMS',
        program: 'Programa de Pós-Graduação em Educação',
        advisorName: 'Dr. Roberto Lima Costa',
      },
    ],
  },
  {
    name: 'Lucas Martins Almeida',
    researchField: 'Engenharias',
    degreeLevel: DegreeLevel.MASTERS,
    graduationYear: 2023,
    institution: 'UFMS - Universidade Federal de Mato Grosso do Sul',
    currentCity: 'Três Lagoas',
    currentState: 'MS',
    currentSector: Sector.ACADEMIA,
    currentJobTitle: 'Pesquisador',
    currentCompany: 'UFMS Campus Três Lagoas',
    enrichmentStatus: EnrichmentStatus.PENDING,
    dissertations: [
      {
        title: 'Otimização de sistemas fotovoltaicos para aplicação em propriedades rurais',
        abstract: 'Desenvolvimento de metodologia para dimensionamento otimizado de sistemas fotovoltaicos.',
        keywords: ['energia solar', 'fotovoltaico', 'energia rural'],
        defenseYear: 2023,
        institution: 'UFMS',
        program: 'Programa de Pós-Graduação em Engenharia Elétrica',
        advisorName: 'Dr. Marcos Antônio Ribeiro',
      },
    ],
  },
  {
    name: 'Juliana Costa Rodrigues',
    researchField: 'Ciências Biológicas',
    degreeLevel: DegreeLevel.PHD,
    graduationYear: 2021,
    institution: 'UFGD - Universidade Federal da Grande Dourados',
    currentCity: 'Campo Grande',
    currentState: 'MS',
    currentSector: Sector.NGO,
    currentJobTitle: 'Diretora de Pesquisa',
    currentCompany: 'ONG Pantanal Vivo',
    enrichmentStatus: EnrichmentStatus.COMPLETE,
    linkedinUrl: 'https://linkedin.com/in/julianacrodrigues',
    lattesUrl: 'http://lattes.cnpq.br/1234567890',
    dissertations: [
      {
        title: 'Biodiversidade de peixes do Rio Paraguai: mapeamento e conservação',
        abstract: 'Estudo sobre a biodiversidade de peixes nativos do Rio Paraguai e propostas de conservação.',
        keywords: ['biodiversidade', 'ictiofauna', 'Pantanal', 'conservação'],
        defenseYear: 2021,
        institution: 'UFGD',
        program: 'Programa de Pós-Graduação em Biologia',
        advisorName: 'Dra. Sandra Melo',
      },
    ],
  },
]

async function main() {
  console.log('Seeding database...')

  for (const data of testAcademics) {
    const { dissertations, ...academicData } = data

    const academic = await prisma.academic.create({
      data: {
        ...academicData,
        dissertations: {
          create: dissertations,
        },
      },
    })

    console.log(`Created academic: ${academic.name}`)
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 2: Add seed script to package.json**

Add to `package.json` in the "prisma" section (create if doesn't exist):

```json
{
  "prisma": {
    "seed": "npx ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

**Step 3: Install ts-node**

Run:
```bash
npm install -D ts-node
```

**Step 4: Run seed**

Run:
```bash
npx prisma db seed
```

Expected: Creates 5 test academics with dissertations.

**Step 5: Verify with search UI**

Open http://localhost:3000

Expected: Search shows 5 academics. Filters work. Clicking opens detail page.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add database seed with test academics"
```

---

## Task 8: Admin Dashboard - Layout and Task Queue

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/api/admin/tasks/route.ts`
- Create: `src/app/api/admin/scrapers/route.ts`
- Create: `src/components/admin/TaskQueue.tsx`
- Create: `src/components/admin/ScraperStatus.tsx`
- Create: `src/lib/db/tasks.ts`
- Create: `src/lib/db/scrapers.ts`

**Step 1: Create task query helpers**

Create `src/lib/db/tasks.ts`:

```typescript
import { prisma } from '@/lib/db'
import { TaskStatus, TaskType } from '@prisma/client'

export async function getTasks(status?: TaskStatus, limit: number = 50) {
  return prisma.enrichmentTask.findMany({
    where: status ? { status } : undefined,
    include: { academic: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  })
}

export async function getTaskById(id: string) {
  return prisma.enrichmentTask.findUnique({
    where: { id },
    include: { academic: true },
  })
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  assignedTo?: string
) {
  return prisma.enrichmentTask.update({
    where: { id },
    data: {
      status,
      assignedTo,
      completedAt: status === 'COMPLETED' ? new Date() : undefined,
    },
  })
}

export async function createTask(
  taskType: TaskType,
  academicId?: string,
  payload?: any,
  priority: number = 0
) {
  return prisma.enrichmentTask.create({
    data: {
      taskType,
      academicId,
      payload,
      priority,
    },
  })
}

export async function getTaskStats() {
  const [pending, inProgress, completed, total] = await Promise.all([
    prisma.enrichmentTask.count({ where: { status: 'PENDING' } }),
    prisma.enrichmentTask.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.enrichmentTask.count({ where: { status: 'COMPLETED' } }),
    prisma.enrichmentTask.count(),
  ])

  return { pending, inProgress, completed, total }
}
```

**Step 2: Create scraper query helpers**

Create `src/lib/db/scrapers.ts`:

```typescript
import { prisma } from '@/lib/db'
import { ScraperSource, ScraperStatus } from '@prisma/client'

export async function getScraperSessions() {
  return prisma.scraperSession.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
  })
}

export async function getActiveScrapers() {
  return prisma.scraperSession.findMany({
    where: {
      status: { in: ['RUNNING', 'PAUSED', 'WAITING_INTERVENTION'] },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function createScraperSession(source: ScraperSource) {
  return prisma.scraperSession.create({
    data: { source },
  })
}

export async function updateScraperSession(
  id: string,
  data: {
    status?: ScraperStatus
    profilesScraped?: number
    tasksCreated?: number
    errors?: number
    metadata?: any
  }
) {
  return prisma.scraperSession.update({
    where: { id },
    data: {
      ...data,
      lastActivityAt: new Date(),
    },
  })
}
```

**Step 3: Create tasks API route**

Create `src/app/api/admin/tasks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getTasks, getTaskStats, updateTaskStatus } from '@/lib/db/tasks'
import { TaskStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') as TaskStatus | null

  try {
    const [tasks, stats] = await Promise.all([
      getTasks(status || undefined),
      getTaskStats(),
    ])

    return NextResponse.json({ tasks, stats })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, assignedTo } = body

    const task = await updateTaskStatus(id, status, assignedTo)
    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
```

**Step 4: Create scrapers API route**

Create `src/app/api/admin/scrapers/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getActiveScrapers, getScraperSessions } from '@/lib/db/scrapers'

export async function GET() {
  try {
    const [active, recent] = await Promise.all([
      getActiveScrapers(),
      getScraperSessions(),
    ])

    return NextResponse.json({ active, recent })
  } catch (error) {
    console.error('Error fetching scrapers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scrapers' },
      { status: 500 }
    )
  }
}
```

**Step 5: Create TaskQueue component**

Create `src/components/admin/TaskQueue.tsx`:

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TaskWithAcademic } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const TASK_TYPE_LABELS: Record<string, string> = {
  CAPTCHA: 'CAPTCHA',
  LINKEDIN_MATCH: 'LinkedIn Match',
  LOGIN_EXPIRED: 'Login Expirado',
  MANUAL_REVIEW: 'Revisão Manual',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  IN_PROGRESS: 'secondary',
  COMPLETED: 'default',
  SKIPPED: 'destructive',
}

type TasksResponse = {
  tasks: TaskWithAcademic[]
  stats: { pending: number; inProgress: number; completed: number; total: number }
}

async function fetchTasks(): Promise<TasksResponse> {
  const res = await fetch('/api/admin/tasks')
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

async function updateTask(id: string, status: string) {
  const res = await fetch('/api/admin/tasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

export function TaskQueue() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tasks'],
    queryFn: fetchTasks,
    refetchInterval: 5000,
  })

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateTask(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tasks'] })
    },
  })

  if (isLoading) {
    return <div>Carregando...</div>
  }

  const { tasks, stats } = data || { tasks: [], stats: { pending: 0, inProgress: 0, completed: 0, total: 0 } }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-sm text-muted-foreground">Em progresso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-sm text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fila de Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma tarefa na fila
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Acadêmico</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.academic?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[task.status]}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(task.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      {task.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            mutation.mutate({ id: task.id, status: 'IN_PROGRESS' })
                          }
                        >
                          Iniciar
                        </Button>
                      )}
                      {task.status === 'IN_PROGRESS' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              mutation.mutate({ id: task.id, status: 'COMPLETED' })
                            }
                          >
                            Concluir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              mutation.mutate({ id: task.id, status: 'SKIPPED' })
                            }
                          >
                            Pular
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 6: Create ScraperStatus component**

Create `src/components/admin/ScraperStatus.tsx`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScraperSession } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  RUNNING: 'default',
  PAUSED: 'secondary',
  WAITING_INTERVENTION: 'outline',
  COMPLETED: 'secondary',
  FAILED: 'destructive',
}

const SOURCE_LABELS: Record<string, string> = {
  SUCUPIRA: 'Sucupira',
  LATTES: 'Lattes',
  LINKEDIN: 'LinkedIn',
}

type ScrapersResponse = {
  active: ScraperSession[]
  recent: ScraperSession[]
}

async function fetchScrapers(): Promise<ScrapersResponse> {
  const res = await fetch('/api/admin/scrapers')
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export function ScraperStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-scrapers'],
    queryFn: fetchScrapers,
    refetchInterval: 5000,
  })

  if (isLoading) {
    return <div>Carregando...</div>
  }

  const { active, recent } = data || { active: [], recent: [] }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Scrapers Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum scraper ativo no momento
            </p>
          ) : (
            <div className="space-y-4">
              {active.map((scraper) => (
                <div
                  key={scraper.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {SOURCE_LABELS[scraper.source]}
                      </span>
                      <Badge variant={STATUS_VARIANTS[scraper.status]}>
                        {scraper.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {scraper.profilesScraped} perfis • {scraper.tasksCreated}{' '}
                      tarefas • {scraper.errors} erros
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Última atividade:{' '}
                    {formatDistanceToNow(new Date(scraper.lastActivityAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessões Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma sessão registrada
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((scraper) => (
                <div
                  key={scraper.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {SOURCE_LABELS[scraper.source]}
                    </span>
                    <Badge variant={STATUS_VARIANTS[scraper.status]} className="text-xs">
                      {scraper.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {scraper.profilesScraped} perfis
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 7: Create admin layout**

Create `src/app/admin/layout.tsx`:

```typescript
import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="text-xl font-bold">
                Hunter Admin
              </Link>
              <div className="flex gap-4">
                <Link
                  href="/admin"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/browser"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Browser
                </Link>
              </div>
            </div>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Voltar à busca
            </Link>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
```

**Step 8: Create admin dashboard page**

Create `src/app/admin/page.tsx`:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TaskQueue } from '@/components/admin/TaskQueue'
import { ScraperStatus } from '@/components/admin/ScraperStatus'

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Painel do Operador</h1>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Fila de Tarefas</TabsTrigger>
          <TabsTrigger value="scrapers">Scrapers</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <TaskQueue />
        </TabsContent>

        <TabsContent value="scrapers" className="mt-6">
          <ScraperStatus />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Step 9: Verify admin dashboard**

Open http://localhost:3000/admin

Expected: Admin dashboard with tabs for Tasks and Scrapers. Shows empty states.

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: add admin dashboard with task queue and scraper status"
```

---

## Task 9: Redis and BullMQ Setup

**Files:**
- Create: `src/lib/queue/index.ts`
- Create: `src/lib/queue/jobs.ts`

**Step 1: Create queue configuration**

Create `src/lib/queue/index.ts`:

```typescript
import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const scraperQueue = new Queue('scraper', { connection })

export const enrichmentQueue = new Queue('enrichment', { connection })

export { connection }
export type { Job }
```

**Step 2: Create job definitions**

Create `src/lib/queue/jobs.ts`:

```typescript
import { scraperQueue, enrichmentQueue } from './index'

export type SucupiraJobData = {
  institution: string
  page?: number
}

export type LinkedInJobData = {
  academicId: string
  name: string
  institution?: string
}

export type CaptchaSolvedData = {
  taskId: string
  solution: string
}

export async function queueSucupiraScrape(data: SucupiraJobData) {
  return scraperQueue.add('sucupira-scrape', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}

export async function queueLinkedInEnrichment(data: LinkedInJobData) {
  return enrichmentQueue.add('linkedin-enrich', data, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
  })
}

export async function queueCaptchaSolved(data: CaptchaSolvedData) {
  return enrichmentQueue.add('captcha-solved', data, {
    priority: 1,
  })
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add BullMQ queue configuration"
```

---

## Task 10: Sucupira Scraper - Base Implementation

**Files:**
- Create: `src/lib/scrapers/browser.ts`
- Create: `src/lib/scrapers/sucupira.ts`

**Step 1: Create browser utility with stealth**

Create `src/lib/scrapers/browser.ts`:

```typescript
import { chromium, Browser, BrowserContext, Page } from 'playwright'

let browserInstance: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    })
  }
  return browserInstance
}

export async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Campo_Grande',
    geolocation: { latitude: -20.4697, longitude: -54.6201 },
    permissions: ['geolocation'],
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    })

    Object.defineProperty(navigator, 'languages', {
      get: () => ['pt-BR', 'pt', 'en-US', 'en'],
    })

    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters)
  })

  return context
}

export async function randomDelay(minMs: number = 1000, maxMs: number = 3000) {
  const delay = Math.random() * (maxMs - minMs) + minMs
  await new Promise((resolve) => setTimeout(resolve, delay))
}

export async function humanScroll(page: Page) {
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight)
  const viewportHeight = await page.evaluate(() => window.innerHeight)

  let currentPosition = 0
  while (currentPosition < scrollHeight - viewportHeight) {
    const scrollAmount = Math.random() * 300 + 100
    currentPosition += scrollAmount
    await page.evaluate((y) => window.scrollTo(0, y), currentPosition)
    await randomDelay(200, 500)
  }
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}
```

**Step 2: Create Sucupira scraper**

Create `src/lib/scrapers/sucupira.ts`:

```typescript
import { Page } from 'playwright'
import { getBrowser, createStealthContext, randomDelay, humanScroll } from './browser'
import { prisma } from '@/lib/db'
import { createScraperSession, updateScraperSession } from '@/lib/db/scrapers'
import { DegreeLevel } from '@prisma/client'

const SUCUPIRA_BASE_URL = 'https://sucupira-v2.capes.gov.br/observatorio/teses-e-dissertacoes'

type DissertationData = {
  authorName: string
  title: string
  abstract?: string
  keywords: string[]
  defenseYear: number
  institution: string
  program?: string
  advisorName?: string
  degreeLevel: DegreeLevel
  sourceUrl: string
}

export async function scrapeSucupira(
  institution: string,
  onProgress?: (message: string) => void
) {
  const session = await createScraperSession('SUCUPIRA')
  const log = (msg: string) => {
    console.log(`[Sucupira] ${msg}`)
    onProgress?.(msg)
  }

  const browser = await getBrowser()
  const context = await createStealthContext(browser)
  const page = await context.newPage()

  let profilesScraped = 0
  let errors = 0

  try {
    log(`Starting scrape for institution: ${institution}`)

    const searchUrl = `${SUCUPIRA_BASE_URL}?search=${encodeURIComponent(institution)}`
    await page.goto(searchUrl, { waitUntil: 'networkidle' })
    await randomDelay(2000, 4000)

    log('Page loaded, extracting data...')

    const dissertations = await extractDissertations(page)
    log(`Found ${dissertations.length} dissertations`)

    for (const diss of dissertations) {
      try {
        await saveDissertation(diss)
        profilesScraped++

        if (profilesScraped % 10 === 0) {
          await updateScraperSession(session.id, {
            profilesScraped,
            errors,
          })
          log(`Progress: ${profilesScraped} saved`)
        }

        await randomDelay(500, 1500)
      } catch (err) {
        errors++
        log(`Error saving dissertation: ${err}`)
      }
    }

    await updateScraperSession(session.id, {
      status: 'COMPLETED',
      profilesScraped,
      errors,
    })

    log(`Completed! ${profilesScraped} profiles, ${errors} errors`)
  } catch (err) {
    await updateScraperSession(session.id, {
      status: 'FAILED',
      profilesScraped,
      errors: errors + 1,
    })
    log(`Failed: ${err}`)
    throw err
  } finally {
    await context.close()
  }

  return { profilesScraped, errors, sessionId: session.id }
}

async function extractDissertations(page: Page): Promise<DissertationData[]> {
  // This is a placeholder - actual implementation depends on Sucupira's HTML structure
  // You'll need to inspect the page and adjust selectors

  const dissertations: DissertationData[] = []

  const items = await page.$$('article, .result-item, [data-testid="result"]')

  for (const item of items) {
    try {
      const title = await item.$eval(
        'h2, h3, .title, [data-testid="title"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => '')

      if (!title) continue

      const authorName = await item.$eval(
        '.author, [data-testid="author"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => 'Unknown Author')

      const yearText = await item.$eval(
        '.year, [data-testid="year"], time',
        (el) => el.textContent?.trim() || ''
      ).catch(() => '')
      const defenseYear = parseInt(yearText) || new Date().getFullYear()

      const institution = await item.$eval(
        '.institution, [data-testid="institution"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => 'UFMS')

      const program = await item.$eval(
        '.program, [data-testid="program"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => undefined)

      const advisorName = await item.$eval(
        '.advisor, [data-testid="advisor"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => undefined)

      const degreeText = await item.$eval(
        '.degree, [data-testid="degree"]',
        (el) => el.textContent?.toLowerCase() || ''
      ).catch(() => '')

      const degreeLevel = degreeText.includes('doutorado')
        ? DegreeLevel.PHD
        : DegreeLevel.MASTERS

      const sourceUrl = await item.$eval(
        'a[href]',
        (el) => el.getAttribute('href') || ''
      ).catch(() => '')

      const keywords = await item.$$eval(
        '.keyword, [data-testid="keyword"]',
        (els) => els.map((el) => el.textContent?.trim() || '').filter(Boolean)
      ).catch(() => [])

      dissertations.push({
        authorName,
        title,
        keywords,
        defenseYear,
        institution,
        program,
        advisorName,
        degreeLevel,
        sourceUrl: sourceUrl.startsWith('http')
          ? sourceUrl
          : `${SUCUPIRA_BASE_URL}${sourceUrl}`,
      })
    } catch (err) {
      console.error('Error extracting item:', err)
    }
  }

  return dissertations
}

async function saveDissertation(data: DissertationData) {
  // Find or create academic
  let academic = await prisma.academic.findFirst({
    where: {
      name: { equals: data.authorName, mode: 'insensitive' },
    },
  })

  if (!academic) {
    academic = await prisma.academic.create({
      data: {
        name: data.authorName,
        institution: data.institution,
        degreeLevel: data.degreeLevel,
        graduationYear: data.defenseYear,
        currentState: 'MS',
      },
    })
  }

  // Check if dissertation already exists
  const existingDiss = await prisma.dissertation.findFirst({
    where: {
      academicId: academic.id,
      title: { equals: data.title, mode: 'insensitive' },
    },
  })

  if (!existingDiss) {
    await prisma.dissertation.create({
      data: {
        academicId: academic.id,
        title: data.title,
        abstract: data.abstract,
        keywords: data.keywords,
        defenseYear: data.defenseYear,
        institution: data.institution,
        program: data.program,
        advisorName: data.advisorName,
        sourceUrl: data.sourceUrl,
      },
    })
  }
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Sucupira scraper with Playwright stealth"
```

---

## Task 11: Admin Scraper Control API

**Files:**
- Create: `src/app/api/admin/scrapers/start/route.ts`
- Modify: `src/components/admin/ScraperStatus.tsx`

**Step 1: Create scraper start API**

Create `src/app/api/admin/scrapers/start/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { scrapeSucupira } from '@/lib/scrapers/sucupira'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, institution } = body

    if (source === 'SUCUPIRA') {
      // Run in background (don't await)
      scrapeSucupira(institution || 'UFMS').catch((err) => {
        console.error('Scraper error:', err)
      })

      return NextResponse.json({
        message: 'Scraper started',
        source,
        institution,
      })
    }

    return NextResponse.json(
      { error: 'Unknown source' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error starting scraper:', error)
    return NextResponse.json(
      { error: 'Failed to start scraper' },
      { status: 500 }
    )
  }
}
```

**Step 2: Add start button to ScraperStatus component**

Update `src/components/admin/ScraperStatus.tsx` to add a start scraper button:

After the imports, add:

```typescript
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'
import { MS_INSTITUTIONS } from '@/lib/constants'
```

Add this inside the component, before the return:

```typescript
const [selectedInstitution, setSelectedInstitution] = useState(MS_INSTITUTIONS[0])
const [isStarting, setIsStarting] = useState(false)

const startScraper = async () => {
  setIsStarting(true)
  try {
    await fetch('/api/admin/scrapers/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'SUCUPIRA',
        institution: selectedInstitution,
      }),
    })
  } catch (err) {
    console.error('Failed to start scraper:', err)
  } finally {
    setIsStarting(false)
  }
}
```

Add this card before the "Scrapers Ativos" card in the return:

```typescript
<Card className="mb-4">
  <CardHeader>
    <CardTitle>Iniciar Scraper</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex gap-4 items-end">
      <div className="flex-1">
        <label className="text-sm font-medium mb-2 block">
          Instituição
        </label>
        <Select
          value={selectedInstitution}
          onValueChange={setSelectedInstitution}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MS_INSTITUTIONS.map((inst) => (
              <SelectItem key={inst} value={inst}>
                {inst}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={startScraper} disabled={isStarting}>
        {isStarting ? 'Iniciando...' : 'Iniciar Sucupira'}
      </Button>
    </div>
  </CardContent>
</Card>
```

**Step 3: Verify scraper can be started**

Open http://localhost:3000/admin, go to Scrapers tab, click "Iniciar Sucupira".

Expected: Button shows "Iniciando...", then resets. Check console for scraper logs.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add scraper start control in admin dashboard"
```

---

## Task 12: LinkedIn Enrichment - Browser Session Page

**Files:**
- Create: `src/app/admin/browser/page.tsx`
- Create: `src/lib/scrapers/linkedin.ts`
- Create: `src/app/api/admin/linkedin/session/route.ts`

**Step 1: Create LinkedIn scraper utilities**

Create `src/lib/scrapers/linkedin.ts`:

```typescript
import { Page, BrowserContext } from 'playwright'
import { getBrowser, createStealthContext, randomDelay } from './browser'
import { prisma } from '@/lib/db'
import { createTask } from '@/lib/db/tasks'
import { Sector } from '@prisma/client'

const LINKEDIN_BASE = 'https://www.linkedin.com'

export type LinkedInProfile = {
  name: string
  headline?: string
  location?: string
  currentTitle?: string
  currentCompany?: string
  profileUrl: string
}

let linkedInContext: BrowserContext | null = null
let linkedInPage: Page | null = null

export async function initLinkedInSession() {
  if (linkedInContext) {
    return { page: linkedInPage!, isNew: false }
  }

  const browser = await getBrowser()
  linkedInContext = await createStealthContext(browser)
  linkedInPage = await linkedInContext.newPage()

  await linkedInPage.goto(LINKEDIN_BASE, { waitUntil: 'networkidle' })

  return { page: linkedInPage, isNew: true }
}

export async function checkLinkedInLoginStatus(): Promise<boolean> {
  if (!linkedInPage) return false

  try {
    const isLoggedIn = await linkedInPage.evaluate(() => {
      return !document.querySelector('a[data-tracking-control-name="guest_homepage-basic_sign-in-button"]')
    })
    return isLoggedIn
  } catch {
    return false
  }
}

export async function searchLinkedIn(
  query: string
): Promise<LinkedInProfile[]> {
  if (!linkedInPage) {
    throw new Error('LinkedIn session not initialized')
  }

  const searchUrl = `${LINKEDIN_BASE}/search/results/people/?keywords=${encodeURIComponent(query)}`
  await linkedInPage.goto(searchUrl, { waitUntil: 'networkidle' })
  await randomDelay(2000, 4000)

  const profiles = await linkedInPage.evaluate(() => {
    const results: LinkedInProfile[] = []
    const cards = document.querySelectorAll('.reusable-search__result-container')

    cards.forEach((card) => {
      const nameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]')
      const headlineEl = card.querySelector('.entity-result__primary-subtitle')
      const locationEl = card.querySelector('.entity-result__secondary-subtitle')
      const linkEl = card.querySelector('.entity-result__title-text a') as HTMLAnchorElement

      if (nameEl && linkEl) {
        results.push({
          name: nameEl.textContent?.trim() || '',
          headline: headlineEl?.textContent?.trim(),
          location: locationEl?.textContent?.trim(),
          profileUrl: linkEl.href.split('?')[0],
        })
      }
    })

    return results
  })

  return profiles
}

export async function extractProfileDetails(
  profileUrl: string
): Promise<Partial<LinkedInProfile>> {
  if (!linkedInPage) {
    throw new Error('LinkedIn session not initialized')
  }

  await linkedInPage.goto(profileUrl, { waitUntil: 'networkidle' })
  await randomDelay(2000, 4000)

  const details = await linkedInPage.evaluate(() => {
    const headline = document.querySelector('.text-body-medium')?.textContent?.trim()
    const location = document.querySelector('.text-body-small.inline')?.textContent?.trim()

    const experienceSection = document.querySelector('#experience')
    let currentTitle: string | undefined
    let currentCompany: string | undefined

    if (experienceSection) {
      const firstExperience = experienceSection.parentElement?.querySelector('li')
      if (firstExperience) {
        currentTitle = firstExperience.querySelector('.t-bold span[aria-hidden="true"]')?.textContent?.trim()
        currentCompany = firstExperience.querySelector('.t-normal span[aria-hidden="true"]')?.textContent?.trim()
      }
    }

    return { headline, location, currentTitle, currentCompany }
  })

  return details
}

export async function enrichAcademicFromLinkedIn(
  academicId: string,
  profile: LinkedInProfile & Partial<{ currentTitle: string; currentCompany: string }>
) {
  const sector = guessSector(profile.currentTitle, profile.currentCompany)

  await prisma.academic.update({
    where: { id: academicId },
    data: {
      linkedinUrl: profile.profileUrl,
      currentJobTitle: profile.currentTitle,
      currentCompany: profile.currentCompany,
      currentSector: sector,
      enrichmentStatus: 'PARTIAL',
      lastEnrichedAt: new Date(),
    },
  })
}

function guessSector(title?: string, company?: string): Sector {
  const text = `${title || ''} ${company || ''}`.toLowerCase()

  if (text.includes('professor') || text.includes('universidade') || text.includes('pesquisador')) {
    return Sector.ACADEMIA
  }
  if (text.includes('secretaria') || text.includes('ministério') || text.includes('governo') || text.includes('prefeitura')) {
    return Sector.GOVERNMENT
  }
  if (text.includes('ong') || text.includes('instituto') || text.includes('fundação')) {
    return Sector.NGO
  }
  if (company) {
    return Sector.PRIVATE
  }

  return Sector.UNKNOWN
}

export async function createLinkedInMatchTask(
  academicId: string,
  candidates: LinkedInProfile[]
) {
  return createTask('LINKEDIN_MATCH', academicId, {
    candidates,
    searchQuery: '',
  })
}

export async function closeLinkedInSession() {
  if (linkedInContext) {
    await linkedInContext.close()
    linkedInContext = null
    linkedInPage = null
  }
}
```

**Step 2: Create LinkedIn session API**

Create `src/app/api/admin/linkedin/session/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import {
  initLinkedInSession,
  checkLinkedInLoginStatus,
  closeLinkedInSession,
} from '@/lib/scrapers/linkedin'

export async function GET() {
  try {
    const isLoggedIn = await checkLinkedInLoginStatus()
    return NextResponse.json({ isLoggedIn })
  } catch (error) {
    return NextResponse.json({ isLoggedIn: false })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'start') {
      const { isNew } = await initLinkedInSession()
      const isLoggedIn = await checkLinkedInLoginStatus()
      return NextResponse.json({
        message: isNew ? 'Session started' : 'Session already active',
        isLoggedIn,
      })
    }

    if (action === 'stop') {
      await closeLinkedInSession()
      return NextResponse.json({ message: 'Session closed' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('LinkedIn session error:', error)
    return NextResponse.json(
      { error: 'Session operation failed' },
      { status: 500 }
    )
  }
}
```

**Step 3: Create browser control page**

Create `src/app/admin/browser/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

async function getSessionStatus() {
  const res = await fetch('/api/admin/linkedin/session')
  return res.json()
}

async function sessionAction(action: string) {
  const res = await fetch('/api/admin/linkedin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  return res.json()
}

export default function BrowserPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: status } = useQuery({
    queryKey: ['linkedin-session'],
    queryFn: getSessionStatus,
    refetchInterval: 5000,
  })

  const startMutation = useMutation({
    mutationFn: () => sessionAction('start'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-session'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => sessionAction('stop'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-session'] })
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Controle do Browser LinkedIn</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Status da Sessão
            <Badge variant={status?.isLoggedIn ? 'default' : 'outline'}>
              {status?.isLoggedIn ? 'Logado' : 'Não logado'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A sessão do LinkedIn roda em background. Após iniciar, você precisará
            fazer login manualmente na janela do Playwright que abrirá.
          </p>

          <div className="flex gap-4">
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? 'Iniciando...' : 'Iniciar Sessão'}
            </Button>
            <Button
              variant="outline"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              {stopMutation.isPending ? 'Fechando...' : 'Fechar Sessão'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instruções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Clique em "Iniciar Sessão" para abrir o browser</li>
            <li>Uma janela do Chromium abrirá em segundo plano</li>
            <li>
              Faça login na sua conta do LinkedIn manualmente na janela do browser
            </li>
            <li>Após logado, o status acima mudará para "Logado"</li>
            <li>
              O sistema agora pode buscar e enriquecer perfis automaticamente
            </li>
          </ol>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-sm text-yellow-800">
              <strong>Importante:</strong> Navegue devagar e naturalmente para
              evitar detecção. O sistema adiciona delays automáticos, mas evite
              ações muito rápidas.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Busca Manual (Debug)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Nome do acadêmico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="outline" disabled={!status?.isLoggedIn}>
              Buscar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use isso para testar buscas manualmente. Em produção, o sistema busca
            automaticamente os acadêmicos pendentes de enriquecimento.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 4: Update browser launch to show window**

For debugging, update `src/lib/scrapers/browser.ts` - change `headless: true` to `headless: false` in `getBrowser()` so operators can see and interact with the browser.

**Step 5: Verify browser page**

Open http://localhost:3000/admin/browser

Expected: Page with session controls and instructions.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add LinkedIn browser session control page"
```

---

## Task 13: CAPTCHA Resolution Flow

**Files:**
- Create: `src/app/api/admin/tasks/[id]/route.ts`
- Create: `src/components/admin/CaptchaResolver.tsx`
- Update: `src/components/admin/TaskQueue.tsx`

**Step 1: Create single task API route**

Create `src/app/api/admin/tasks/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getTaskById, updateTaskStatus } from '@/lib/db/tasks'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await getTaskById(params.id)

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, solution, selectedProfile } = body

    const task = await getTaskById(params.id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Handle different task types
    if (task.taskType === 'CAPTCHA' && solution) {
      // Store solution for scraper to use
      await prisma.enrichmentTask.update({
        where: { id: params.id },
        data: {
          payload: { ...(task.payload as any), solution },
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
    } else if (task.taskType === 'LINKEDIN_MATCH' && selectedProfile) {
      // Update academic with selected profile data
      if (task.academicId) {
        await prisma.academic.update({
          where: { id: task.academicId },
          data: {
            linkedinUrl: selectedProfile.profileUrl,
            currentJobTitle: selectedProfile.currentTitle,
            currentCompany: selectedProfile.currentCompany,
            enrichmentStatus: 'PARTIAL',
            lastEnrichedAt: new Date(),
          },
        })
      }

      await updateTaskStatus(params.id, 'COMPLETED')
    } else {
      await updateTaskStatus(params.id, status)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
```

**Step 2: Create CaptchaResolver component**

Create `src/components/admin/CaptchaResolver.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { TaskWithAcademic, CaptchaPayload, LinkedInMatchPayload, LinkedInCandidate } from '@/types'

type Props = {
  task: TaskWithAcademic
  open: boolean
  onClose: () => void
}

async function resolveTask(taskId: string, data: any) {
  const res = await fetch(`/api/admin/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to resolve task')
  return res.json()
}

export function TaskResolver({ task, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [captchaSolution, setCaptchaSolution] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<LinkedInCandidate | null>(null)

  const mutation = useMutation({
    mutationFn: (data: any) => resolveTask(task.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tasks'] })
      onClose()
    },
  })

  const handleCaptchaSubmit = () => {
    mutation.mutate({ solution: captchaSolution, status: 'COMPLETED' })
  }

  const handleProfileSelect = (profile: LinkedInCandidate) => {
    mutation.mutate({ selectedProfile: profile, status: 'COMPLETED' })
  }

  const handleSkip = () => {
    mutation.mutate({ status: 'SKIPPED' })
  }

  const renderCaptchaTask = () => {
    const payload = task.payload as CaptchaPayload | null

    return (
      <div className="space-y-4">
        {payload?.imageUrl && (
          <div className="flex justify-center">
            <img
              src={payload.imageUrl}
              alt="CAPTCHA"
              className="border rounded max-w-full"
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">
            Digite o texto do CAPTCHA
          </label>
          <Input
            value={captchaSolution}
            onChange={(e) => setCaptchaSolution(e.target.value)}
            placeholder="Digite aqui..."
            onKeyDown={(e) => e.key === 'Enter' && handleCaptchaSubmit()}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleSkip}>
            Pular
          </Button>
          <Button onClick={handleCaptchaSubmit} disabled={!captchaSolution}>
            Enviar
          </Button>
        </div>
      </div>
    )
  }

  const renderLinkedInMatchTask = () => {
    const payload = task.payload as LinkedInMatchPayload | null
    const candidates = payload?.candidates || []

    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Acadêmico: <strong>{task.academic?.name}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Selecione o perfil correto do LinkedIn:
          </p>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum candidato encontrado
            </p>
          ) : (
            candidates.map((profile, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-colors ${
                  selectedProfile === profile
                    ? 'ring-2 ring-primary'
                    : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedProfile(profile)}
              >
                <CardContent className="p-4">
                  <p className="font-medium">{profile.name}</p>
                  {profile.headline && (
                    <p className="text-sm text-muted-foreground">
                      {profile.headline}
                    </p>
                  )}
                  {profile.location && (
                    <p className="text-xs text-muted-foreground">
                      {profile.location}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleSkip}>
            Nenhum corresponde
          </Button>
          <Button
            onClick={() => selectedProfile && handleProfileSelect(selectedProfile)}
            disabled={!selectedProfile}
          >
            Confirmar
          </Button>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (task.taskType) {
      case 'CAPTCHA':
        return renderCaptchaTask()
      case 'LINKEDIN_MATCH':
        return renderLinkedInMatchTask()
      default:
        return (
          <div className="space-y-4">
            <p>Tipo de tarefa: {task.taskType}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleSkip}>
                Pular
              </Button>
              <Button onClick={() => mutation.mutate({ status: 'COMPLETED' })}>
                Marcar como concluída
              </Button>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {task.taskType === 'CAPTCHA' && 'Resolver CAPTCHA'}
            {task.taskType === 'LINKEDIN_MATCH' && 'Confirmar Perfil LinkedIn'}
            {task.taskType === 'LOGIN_EXPIRED' && 'Login Expirado'}
            {task.taskType === 'MANUAL_REVIEW' && 'Revisão Manual'}
          </DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
```

**Step 3: Update TaskQueue to open resolver**

Update `src/components/admin/TaskQueue.tsx`:

Add import at top:
```typescript
import { TaskResolver } from './CaptchaResolver'
```

Add state inside the component:
```typescript
const [selectedTask, setSelectedTask] = useState<TaskWithAcademic | null>(null)
```

Update the "Iniciar" button to open the resolver:
```typescript
<Button
  size="sm"
  variant="outline"
  onClick={() => {
    mutation.mutate({ id: task.id, status: 'IN_PROGRESS' })
    setSelectedTask(task)
  }}
>
  Resolver
</Button>
```

Add dialog at the end of the component return, before the closing `</div>`:
```typescript
{selectedTask && (
  <TaskResolver
    task={selectedTask}
    open={!!selectedTask}
    onClose={() => setSelectedTask(null)}
  />
)}
```

**Step 4: Verify task resolution flow**

Create a test task manually via Prisma Studio or API, then resolve it via the admin UI.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add CAPTCHA and LinkedIn match resolution dialogs"
```

---

## Summary

This completes the core POC implementation with:

1. **Project scaffolding** - Next.js 14, Tailwind, shadcn/ui, Docker
2. **Database** - PostgreSQL with Prisma ORM
3. **Search UI** - Filters and results for finding academics
4. **Academic detail page** - Full profile view
5. **Test data** - Seed script with sample academics
6. **Admin dashboard** - Task queue and scraper status
7. **BullMQ queues** - Job queue infrastructure
8. **Sucupira scraper** - Base implementation with Playwright stealth
9. **LinkedIn integration** - Browser session control
10. **Task resolution** - CAPTCHA and profile matching dialogs

**Next steps for production:**
- Add authentication to admin routes
- Refine Sucupira scraper selectors based on actual page structure
- Add worker processes for background job execution
- Add error handling and retry logic
- Add logging and monitoring
- Deploy with Docker Compose on a VPS
