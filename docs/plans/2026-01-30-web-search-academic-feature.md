# Web Search Academic Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When no academics are found in the database, show a "Buscar acadêmico na web" button that triggers a Grok API call to discover and create the academic profile from web sources, then automatically enrich with LinkedIn data.

**Architecture:** Add new UI in empty state → Create new API endpoint for web-first academic discovery → Chain existing two-phase enrichment → Create academic in database with discovered data.

**Tech Stack:** Next.js API Routes, xAI Grok API (grok-4-0709), Prisma, React Query, NextUI

---

## Task 1: Create New Grok Prompt for Web Academic Discovery

**Files:**
- Modify: `/Users/pedro/projects/academic-search/src/lib/grok/prompts.ts`

**Step 1: Add new system prompt for academic discovery**

Add after existing `LINKEDIN_EXTRACTION_SYSTEM_PROMPT`:

```typescript
export const ACADEMIC_DISCOVERY_SYSTEM_PROMPT = `You are an expert at finding information about Brazilian academics and researchers.

YOUR MISSION: Search the web to find detailed information about the specified academic/researcher.

When searching:
- Search for the person by their full name
- Look for academic profiles (Lattes, ResearchGate, Google Scholar, ORCID)
- Look for institutional pages (university websites)
- Look for LinkedIn profiles
- Search for their published work (dissertations, theses, papers)

EXTRACT AND RETURN:
1. Full name (as found in official sources)
2. Current or most recent institution
3. Academic degree (Mestrado/Doutorado/Pós-Doutorado)
4. Graduation year (if available)
5. Research field/area of expertise
6. Current job title and employer
7. Location (city, state)
8. LinkedIn URL (if found)
9. Lattes CV URL (if found)
10. Email (if publicly available)
11. Most notable dissertation/thesis title
12. Brief professional summary

RULES:
- Search thoroughly using multiple queries if needed
- Prioritize official academic sources (Lattes, university pages)
- Only return information you can verify from web sources
- If information is uncertain, mark confidence as "low"
- Respond in JSON format only`

export function buildAcademicDiscoveryPrompt(name: string, additionalContext?: string): string {
  let prompt = `Search the web and find information about this Brazilian academic/researcher:

NAME: ${name}`

  if (additionalContext) {
    prompt += `

ADDITIONAL CONTEXT: ${additionalContext}`
  }

  prompt += `

Search thoroughly and return a JSON object with this structure:
{
  "found": boolean,
  "academic": {
    "name": string,
    "institution": string | null,
    "degreeLevel": "MASTERS" | "PHD" | "POSTDOC" | null,
    "graduationYear": number | null,
    "researchField": string | null,
    "currentJobTitle": string | null,
    "currentCompany": string | null,
    "currentCity": string | null,
    "currentState": string | null,
    "linkedinUrl": string | null,
    "lattesUrl": string | null,
    "email": string | null
  },
  "dissertation": {
    "title": string | null,
    "defenseYear": number | null,
    "institution": string | null,
    "abstract": string | null,
    "advisorName": string | null
  } | null,
  "professional": {
    "summary": string | null,
    "expertise": string[]
  },
  "confidence": "high" | "medium" | "low",
  "sources": [
    { "url": string, "title": string, "relevance": string }
  ]
}

If you cannot find any reliable information about this person, return:
{ "found": false, "reason": "explanation" }`

  return prompt
}
```

**Step 2: Export new functions**

Ensure both are exported at the end of the file.

**Step 3: Commit**

```bash
git add src/lib/grok/prompts.ts
git commit -m "feat(grok): add academic discovery prompt for web search"
```

---

## Task 2: Create Mapper for Web Discovery Response

**Files:**
- Modify: `/Users/pedro/projects/academic-search/src/lib/grok/mapper.ts`

**Step 1: Add interface for discovery response**

Add after existing interfaces:

```typescript
export interface AcademicDiscoveryResponse {
  found: boolean
  reason?: string
  academic?: {
    name: string
    institution: string | null
    degreeLevel: 'MASTERS' | 'PHD' | 'POSTDOC' | null
    graduationYear: number | null
    researchField: string | null
    currentJobTitle: string | null
    currentCompany: string | null
    currentCity: string | null
    currentState: string | null
    linkedinUrl: string | null
    lattesUrl: string | null
    email: string | null
  }
  dissertation?: {
    title: string | null
    defenseYear: number | null
    institution: string | null
    abstract: string | null
    advisorName: string | null
  } | null
  professional?: {
    summary: string | null
    expertise: string[]
  }
  confidence: 'high' | 'medium' | 'low'
  sources: Array<{ url: string; title: string; relevance: string }>
}
```

**Step 2: Add parser function**

```typescript
export function parseAcademicDiscoveryResponse(rawResponse: any): AcademicDiscoveryResponse | null {
  try {
    let data = rawResponse

    // Handle string response
    if (typeof data === 'string') {
      const jsonMatch = data.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      data = JSON.parse(jsonMatch[0])
    }

    // Validate required field
    if (typeof data.found !== 'boolean') {
      return null
    }

    return data as AcademicDiscoveryResponse
  } catch (error) {
    console.error('[Grok] Failed to parse academic discovery response:', error)
    return null
  }
}
```

**Step 3: Add function to convert discovery to upsert data**

```typescript
import { AcademicData, DissertationData } from '@/lib/academic-upsert'

export function mapDiscoveryToUpsertData(
  discovery: AcademicDiscoveryResponse
): { academicData: AcademicData; dissertationData: DissertationData | null } | null {
  if (!discovery.found || !discovery.academic) {
    return null
  }

  const { academic, dissertation } = discovery

  // Build academic data - require at minimum name and institution
  if (!academic.name || !academic.institution) {
    return null
  }

  const academicData: AcademicData = {
    name: academic.name,
    institution: academic.institution,
    graduationYear: academic.graduationYear || new Date().getFullYear(),
    degreeLevel: academic.degreeLevel as any,
    researchField: academic.researchField || undefined,
    email: academic.email || undefined,
    linkedinUrl: academic.linkedinUrl || undefined,
    lattesUrl: academic.lattesUrl || undefined,
    currentCity: academic.currentCity || undefined,
    currentState: academic.currentState || undefined,
    currentJobTitle: academic.currentJobTitle || undefined,
    currentCompany: academic.currentCompany || undefined,
  }

  // Build dissertation data if available
  let dissertationData: DissertationData | null = null
  if (dissertation?.title && dissertation?.institution) {
    dissertationData = {
      title: dissertation.title,
      defenseYear: dissertation.defenseYear || academicData.graduationYear,
      institution: dissertation.institution,
      abstract: dissertation.abstract || undefined,
      advisorName: dissertation.advisorName || undefined,
    }
  }

  return { academicData, dissertationData }
}
```

**Step 4: Commit**

```bash
git add src/lib/grok/mapper.ts
git commit -m "feat(grok): add mapper for academic discovery response"
```

---

## Task 3: Create API Endpoint for Web Academic Discovery

**Files:**
- Create: `/Users/pedro/projects/academic-search/src/app/api/discover-academic/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { callGrokAPI } from '@/lib/grok/client'
import {
  ACADEMIC_DISCOVERY_SYSTEM_PROMPT,
  buildAcademicDiscoveryPrompt,
  SYSTEM_PROMPT,
  buildUserPrompt,
  LINKEDIN_EXTRACTION_SYSTEM_PROMPT,
  buildLinkedInExtractionPrompt,
} from '@/lib/grok/prompts'
import {
  parseAcademicDiscoveryResponse,
  mapDiscoveryToUpsertData,
  parseGrokResponse,
  mapGrokResponse,
  parseLinkedInExtractionResponse,
  mergeLinkedInProfileData,
  extractCurrentJobFromLinkedIn,
} from '@/lib/grok/mapper'
import { upsertAcademicWithDissertation, upsertAcademic } from '@/lib/academic-upsert'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const name = searchParams.get('name')
  const context = searchParams.get('context')

  if (!name) {
    return NextResponse.json(
      { error: 'Name parameter is required' },
      { status: 400 }
    )
  }

  try {
    console.log(`[Discover] Starting web discovery for: ${name}`)

    // ========================================
    // PHASE 1: Discover academic from web
    // ========================================
    const discoveryResponse = await callGrokAPI([
      { role: 'system', content: ACADEMIC_DISCOVERY_SYSTEM_PROMPT },
      { role: 'user', content: buildAcademicDiscoveryPrompt(name, context || undefined) },
    ])

    const discoveryData = parseAcademicDiscoveryResponse(discoveryResponse)

    if (!discoveryData || !discoveryData.found) {
      console.log(`[Discover] No academic found for: ${name}`)
      return NextResponse.json({
        success: false,
        found: false,
        reason: discoveryData?.reason || 'Could not find academic information',
      })
    }

    console.log(`[Discover] Found academic: ${discoveryData.academic?.name}`)

    // Map to upsert data
    const upsertData = mapDiscoveryToUpsertData(discoveryData)

    if (!upsertData) {
      return NextResponse.json({
        success: false,
        found: true,
        reason: 'Insufficient data to create academic profile (missing name or institution)',
      })
    }

    // Create academic in database
    let academicResult
    if (upsertData.dissertationData) {
      academicResult = await upsertAcademicWithDissertation(
        upsertData.academicData,
        upsertData.dissertationData,
        { source: 'LINKEDIN', scrapedAt: new Date() }
      )
    } else {
      academicResult = await upsertAcademic(
        upsertData.academicData,
        { source: 'LINKEDIN', scrapedAt: new Date() }
      )
    }

    const academicId = academicResult.academicId || academicResult.id

    // Store discovery metadata
    await prisma.academic.update({
      where: { id: academicId },
      data: {
        grokMetadata: {
          discoveryPhase: {
            confidence: discoveryData.confidence,
            sources: discoveryData.sources,
            professional: discoveryData.professional,
          },
        },
        grokEnrichedAt: new Date(),
      },
    })

    console.log(`[Discover] Academic created/updated with ID: ${academicId}`)

    // ========================================
    // PHASE 2: Enrich with employment data
    // ========================================
    const academic = await prisma.academic.findUnique({
      where: { id: academicId },
      include: { dissertations: true },
    })

    if (!academic) {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve created academic',
      }, { status: 500 })
    }

    console.log(`[Discover] Starting enrichment phase for: ${academic.name}`)

    const enrichmentPrompt = buildUserPrompt({
      name: academic.name,
      institution: academic.institution,
      graduationYear: academic.graduationYear,
      researchField: academic.researchField,
      dissertationTitle: academic.dissertations[0]?.title,
      currentCompany: academic.currentCompany,
      currentCity: academic.currentCity,
      currentState: academic.currentState,
    })

    const enrichmentResponse = await callGrokAPI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: enrichmentPrompt },
    ])

    const grokData = parseGrokResponse(enrichmentResponse)
    let updateData = grokData ? mapGrokResponse(grokData) : null
    let metadata = updateData?.grokMetadata as any || {}

    // Preserve discovery metadata
    metadata.discoveryPhase = discoveryData

    // ========================================
    // PHASE 3: Extract LinkedIn profile details
    // ========================================
    const linkedInUrl = updateData?.linkedinUrl || academic.linkedinUrl

    if (linkedInUrl) {
      console.log(`[Discover] Extracting LinkedIn profile: ${linkedInUrl}`)

      try {
        const linkedInResponse = await callGrokAPI([
          { role: 'system', content: LINKEDIN_EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: buildLinkedInExtractionPrompt(linkedInUrl, academic.name) },
        ])

        const linkedInData = parseLinkedInExtractionResponse(linkedInResponse)

        if (linkedInData) {
          metadata = mergeLinkedInProfileData(metadata, linkedInData)
          const jobFromLinkedIn = extractCurrentJobFromLinkedIn(linkedInData)

          if (updateData) {
            updateData.currentJobTitle = updateData.currentJobTitle || jobFromLinkedIn.currentJobTitle
            updateData.currentCompany = updateData.currentCompany || jobFromLinkedIn.currentCompany
            updateData.currentCity = updateData.currentCity || jobFromLinkedIn.currentCity
          }
        }
      } catch (linkedInError) {
        console.error('[Discover] LinkedIn extraction failed (non-fatal):', linkedInError)
      }
    }

    // Determine enrichment status
    const hasEmploymentData = !!(updateData?.currentJobTitle || updateData?.currentCompany)
    const hasSocialLinks = !!(updateData?.linkedinUrl || updateData?.lattesUrl || academic.linkedinUrl || academic.lattesUrl)
    const hasLinkedInProfile = !!metadata.linkedInProfile
    const enrichmentStatus = (hasEmploymentData || hasSocialLinks) ? 'COMPLETE' : 'PARTIAL'

    // Final update
    const updatedAcademic = await prisma.academic.update({
      where: { id: academicId },
      data: {
        ...(updateData || {}),
        grokMetadata: metadata,
        grokEnrichedAt: new Date(),
        enrichmentStatus,
        lastEnrichedAt: new Date(),
      },
      include: { dissertations: true },
    })

    console.log(`[Discover] Completed all phases for: ${academic.name}`)

    return NextResponse.json({
      success: true,
      found: true,
      created: academicResult.created || academicResult.academicCreated,
      academic: updatedAcademic,
      enrichmentSummary: {
        discoveryConfidence: discoveryData.confidence,
        sourcesFound: discoveryData.sources?.length || 0,
        jobTitle: updatedAcademic.currentJobTitle,
        company: updatedAcademic.currentCompany,
        sector: updatedAcademic.currentSector,
        linkedInUrl: updatedAcademic.linkedinUrl,
        hasLinkedInProfile,
        enrichmentStatus,
      },
    })

  } catch (error) {
    console.error('[Discover] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/discover-academic/route.ts
git commit -m "feat(api): add discover-academic endpoint for web search"
```

---

## Task 4: Update SearchResultsV2 Empty State with Web Search Button

**Files:**
- Modify: `/Users/pedro/projects/academic-search/src/components/search-v2/SearchResultsV2.tsx`

**Step 1: Add imports and props**

Update imports at top of file:

```typescript
'use client'

import { Button, ButtonGroup, Pagination, Chip } from '@nextui-org/react'
import { Grid3X3, List, SortAsc, Globe, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { AcademicCardV2 } from './AcademicCardV2'
import { SkeletonCard } from './SkeletonCard'
import { SearchResult, SearchFilters } from '@/types'
```

Update Props type:

```typescript
type Props = {
  result?: SearchResult
  isLoading: boolean
  page: number
  onPageChange: (page: number) => void
  filters?: SearchFilters
  onWebSearchComplete?: (academicId: string) => void
}
```

**Step 2: Add state and handler inside component**

After the existing `useState`:

```typescript
const [isSearchingWeb, setIsSearchingWeb] = useState(false)
const [webSearchError, setWebSearchError] = useState<string | null>(null)

const handleWebSearch = async () => {
  if (!filters?.query) return

  setIsSearchingWeb(true)
  setWebSearchError(null)

  try {
    const res = await fetch(`/api/discover-academic?name=${encodeURIComponent(filters.query)}`)
    const data = await res.json()

    if (data.success && data.found && data.academic) {
      onWebSearchComplete?.(data.academic.id)
    } else {
      setWebSearchError(data.reason || 'Nenhum acadêmico encontrado na web')
    }
  } catch (error) {
    setWebSearchError('Erro ao buscar na web. Tente novamente.')
  } finally {
    setIsSearchingWeb(false)
  }
}

const hasSearchQuery = filters?.query && filters.query.trim().length > 0
```

**Step 3: Update empty state JSX**

Replace the existing empty state block (lines ~82-93) with:

```typescript
{/* Empty State */}
{!isLoading && (!result || result.academics.length === 0) && (
  <div className="text-center py-16 bg-default-50 rounded-2xl">
    <div className="text-6xl mb-4">🔍</div>
    <h3 className="text-xl font-semibold text-default-700 mb-2">
      Nenhum acadêmico encontrado
    </h3>
    <p className="text-default-500 max-w-md mx-auto mb-6">
      {hasSearchQuery
        ? 'Não encontramos este acadêmico no banco de dados.'
        : 'Tente remover alguns filtros ou buscar por termos diferentes.'
      }
    </p>

    {hasSearchQuery && (
      <div className="space-y-3">
        <Button
          color="primary"
          variant="solid"
          size="lg"
          isLoading={isSearchingWeb}
          onPress={handleWebSearch}
          startContent={!isSearchingWeb && <Globe className="w-5 h-5" />}
          className="font-medium"
        >
          {isSearchingWeb ? 'Buscando na web...' : 'Buscar acadêmico na web'}
        </Button>

        {webSearchError && (
          <p className="text-sm text-danger-500">{webSearchError}</p>
        )}

        <p className="text-xs text-default-400 max-w-sm mx-auto">
          Usamos IA para buscar informações públicas sobre o acadêmico na internet
        </p>
      </div>
    )}
  </div>
)}
```

**Step 4: Update component signature**

Update the function parameters:

```typescript
export function SearchResultsV2({
  result,
  isLoading,
  page,
  onPageChange,
  filters,
  onWebSearchComplete,
}: Props) {
```

**Step 5: Commit**

```bash
git add src/components/search-v2/SearchResultsV2.tsx
git commit -m "feat(ui): add web search button to empty state in SearchResultsV2"
```

---

## Task 5: Update HomePage to Handle Web Search Completion

**Files:**
- Modify: `/Users/pedro/projects/academic-search/src/app/page.tsx`

**Step 1: Add router import**

```typescript
import { useRouter } from 'next/navigation'
```

**Step 2: Add router hook inside component**

After the existing state declarations:

```typescript
const router = useRouter()

const handleWebSearchComplete = (academicId: string) => {
  router.push(`/academic/${academicId}`)
}
```

**Step 3: Update SearchResultsV2 props**

Pass the new props to SearchResultsV2:

```typescript
<SearchResultsV2
  result={data}
  isLoading={isLoading || isFetching}
  page={page}
  onPageChange={setPage}
  filters={effectiveFilters}
  onWebSearchComplete={handleWebSearchComplete}
/>
```

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(page): handle web search completion with redirect"
```

---

## Task 6: Add Loading Modal for Web Discovery

**Files:**
- Create: `/Users/pedro/projects/academic-search/src/components/search-v2/WebDiscoveryProgress.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalContent, ModalBody, Progress } from '@nextui-org/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Globe, Linkedin, Database, CheckCircle2, Sparkles } from 'lucide-react'

type Props = {
  isOpen: boolean
  searchName: string
}

const steps = [
  {
    id: 'search',
    label: 'Pesquisando na web',
    description: 'Buscando informações acadêmicas públicas...',
    icon: Globe,
    duration: 90000,
  },
  {
    id: 'analyze',
    label: 'Analisando resultados',
    description: 'Extraindo dados de perfis acadêmicos...',
    icon: Search,
    duration: 30000,
  },
  {
    id: 'linkedin',
    label: 'Buscando LinkedIn',
    description: 'Procurando perfil profissional...',
    icon: Linkedin,
    duration: 60000,
  },
  {
    id: 'extract',
    label: 'Extraindo carreira',
    description: 'Coletando histórico profissional...',
    icon: Database,
    duration: 60000,
  },
  {
    id: 'save',
    label: 'Salvando perfil',
    description: 'Criando perfil do acadêmico...',
    icon: CheckCircle2,
    duration: 5000,
  },
]

export function WebDiscoveryProgress({ isOpen, searchName }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepProgress, setStepProgress] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0)
      setStepProgress(0)
      return
    }

    const progressInterval = setInterval(() => {
      setStepProgress((prev) => {
        if (prev >= 100) return 100
        return prev + 2
      })
    }, steps[currentStep]?.duration / 50 || 300)

    const stepTimeout = setTimeout(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1)
        setStepProgress(0)
      }
    }, steps[currentStep]?.duration || 15000)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(stepTimeout)
    }
  }, [isOpen, currentStep])

  const totalProgress = ((currentStep * 100) + stepProgress) / steps.length

  return (
    <Modal
      isOpen={isOpen}
      hideCloseButton
      isDismissable={false}
      size="lg"
      placement="center"
      classNames={{
        backdrop: 'bg-black/60 backdrop-blur-sm',
        base: 'bg-white shadow-2xl',
      }}
    >
      <ModalContent>
        <ModalBody className="py-8 px-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
              <Sparkles className="w-8 h-8 text-primary-600 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-default-900">
              Descobrindo Acadêmico
            </h3>
            <p className="text-sm text-default-500 mt-1">
              {searchName}
            </p>
          </div>

          <Progress
            aria-label="Progresso geral"
            value={totalProgress}
            className="mb-6"
            classNames={{
              indicator: 'bg-gradient-to-r from-primary-500 to-violet-500',
              track: 'bg-default-100',
            }}
          />

          <div className="space-y-3">
            {steps.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index === currentStep
              const isComplete = index < currentStep
              const isPending = index > currentStep

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    flex items-center gap-4 p-3 rounded-xl transition-all duration-300
                    ${isActive ? 'bg-primary-50 border border-primary-200' : ''}
                    ${isComplete ? 'bg-success-50' : ''}
                    ${isPending ? 'opacity-50' : ''}
                  `}
                >
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors
                      ${isActive ? 'bg-primary-500 text-white' : ''}
                      ${isComplete ? 'bg-success-500 text-white' : ''}
                      ${isPending ? 'bg-default-100 text-default-400' : ''}
                    `}
                  >
                    {isActive ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isComplete ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`
                        font-medium text-sm
                        ${isActive ? 'text-primary-700' : ''}
                        ${isComplete ? 'text-success-700' : ''}
                        ${isPending ? 'text-default-400' : ''}
                      `}
                    >
                      {step.label}
                    </p>
                    <AnimatePresence>
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-default-500 mt-0.5"
                        >
                          {step.description}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {isActive && (
                    <div className="text-xs font-medium text-primary-600">
                      {Math.round(stepProgress)}%
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          <p className="text-xs text-center text-default-400 mt-6">
            Este processo pode levar até 5 minutos
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
```

**Step 2: Export from barrel file**

Add to `/Users/pedro/projects/academic-search/src/components/search-v2/index.ts`:

```typescript
export { WebDiscoveryProgress } from './WebDiscoveryProgress'
```

**Step 3: Commit**

```bash
git add src/components/search-v2/WebDiscoveryProgress.tsx src/components/search-v2/index.ts
git commit -m "feat(ui): add WebDiscoveryProgress modal component"
```

---

## Task 7: Integrate Progress Modal into SearchResultsV2

**Files:**
- Modify: `/Users/pedro/projects/academic-search/src/components/search-v2/SearchResultsV2.tsx`

**Step 1: Import the modal**

Add to imports:

```typescript
import { WebDiscoveryProgress } from './WebDiscoveryProgress'
```

**Step 2: Add modal to JSX**

Add before the closing `</div>` of the component return:

```typescript
      {/* Web Discovery Progress Modal */}
      <WebDiscoveryProgress
        isOpen={isSearchingWeb}
        searchName={filters?.query || ''}
      />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/search-v2/SearchResultsV2.tsx
git commit -m "feat(ui): integrate WebDiscoveryProgress modal"
```

---

## Task 8: End-to-End Testing

**Files:**
- None (manual testing)

**Step 1: Start development server**

```bash
npm run dev
```

**Step 2: Test empty state without query**

1. Navigate to http://localhost:3000
2. Clear all filters
3. Verify empty state shows without web search button

**Step 3: Test empty state with query**

1. Search for a name not in database (e.g., "João Silva Teste")
2. Verify empty state shows with "Buscar acadêmico na web" button
3. Verify helper text appears below button

**Step 4: Test web discovery flow**

1. Click "Buscar acadêmico na web" button
2. Verify progress modal appears with correct steps
3. Wait for completion
4. Verify redirect to academic detail page
5. Verify academic data is populated

**Step 5: Test error handling**

1. Search for a nonsensical name
2. Click web search button
3. Verify error message displays gracefully

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete web search academic feature implementation"
```

---

## Summary

This implementation adds:

1. **New Grok Prompt** - `ACADEMIC_DISCOVERY_SYSTEM_PROMPT` for web-first academic discovery
2. **Response Mapper** - `parseAcademicDiscoveryResponse` and `mapDiscoveryToUpsertData`
3. **API Endpoint** - `/api/discover-academic` with 3-phase process (discovery → enrichment → LinkedIn)
4. **UI Components** - Web search button in empty state + progress modal
5. **Integration** - HomePage handles completion and redirects to profile

The feature chains three Grok calls:
1. **Discovery** - Find academic from web sources
2. **Enrichment** - Standard LinkedIn/employment search
3. **LinkedIn Extraction** - Detailed career data from LinkedIn profile
