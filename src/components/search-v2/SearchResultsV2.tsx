'use client'

import { Button, ButtonGroup, Pagination, Chip } from '@nextui-org/react'
import { Grid3X3, List, SortAsc, Globe, FileSpreadsheet } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { AcademicCardV2 } from './AcademicCardV2'
import { SkeletonCard } from './SkeletonCard'
import { WebDiscoveryProgress, DiscoveryStep, DiscoveryPhase } from './WebDiscoveryProgress'
import { ImportXlsModal } from '@/components/import/ImportXlsModal'
import { ImportXlsProgress, ImportStep, ImportPhase } from '@/components/import/ImportXlsProgress'
import { SearchResult, SearchFilters } from '@/types'

type ImportResult = {
  academicIds: string[]
  enhancedIds: string[]
  imported: number
  enhanced: number
  duplicates: number
}

type Props = {
  result?: SearchResult
  isLoading: boolean
  page: number
  onPageChange: (page: number) => void
  filters?: SearchFilters
  onWebSearchComplete?: (academicId: string) => void
  onImportComplete?: (result: ImportResult) => void
}

type ViewMode = 'grid' | 'list'

const INITIAL_STEPS: DiscoveryStep[] = [
  { phase: 'discovery', status: 'pending' },
  { phase: 'saving', status: 'pending' },
  { phase: 'enrichment', status: 'pending' },
  { phase: 'linkedin', status: 'pending' },
]

const INITIAL_IMPORT_STEPS: ImportStep[] = [
  { phase: 'parsing', status: 'pending' },
  { phase: 'extracting', status: 'pending' },
  { phase: 'inserting', status: 'pending' },
  { phase: 'enhancing', status: 'pending' },
]

export function SearchResultsV2({
  result,
  isLoading,
  page,
  onPageChange,
  filters,
  onWebSearchComplete,
  onImportComplete,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isSearchingWeb, setIsSearchingWeb] = useState(false)
  const [webSearchError, setWebSearchError] = useState<string | null>(null)
  const [discoverySteps, setDiscoverySteps] = useState<DiscoveryStep[]>(INITIAL_STEPS)
  const [streamError, setStreamError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Import XLS state
  const [showImportModal, setShowImportModal] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSteps, setImportSteps] = useState<ImportStep[]>(INITIAL_IMPORT_STEPS)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{
    imported: number; enhanced: number; skipped: number; duplicates: number
  } | null>(null)

  const updateStep = useCallback((phase: DiscoveryPhase, status: DiscoveryStep['status'], message?: string) => {
    setDiscoverySteps(prev =>
      prev.map(s => s.phase === phase ? { ...s, status, message } : s)
    )
  }, [])

  const handleWebSearch = async () => {
    if (!filters?.query) return

    setIsSearchingWeb(true)
    setWebSearchError(null)
    setStreamError(null)
    setDiscoverySteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending', message: undefined })))

    abortRef.current = new AbortController()

    try {
      const res = await fetch(
        `/api/discover-academic?name=${encodeURIComponent(filters.query)}`,
        { signal: abortRef.current.signal }
      )

      if (!res.ok || !res.body) {
        throw new Error('Failed to start discovery')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          try {
            const event = JSON.parse(line.slice(6))

            if (event.phase === 'done') {
              if (event.status === 'success' && event.academic) {
                onWebSearchComplete?.(event.academic.id)
              } else if (event.status === 'not_found') {
                setWebSearchError(event.reason || 'Nenhum acadêmico encontrado na web')
              }
              setIsSearchingWeb(false)
              return
            }

            if (event.phase === 'error') {
              setStreamError(event.message || 'Erro durante a descoberta')
              setWebSearchError(event.message || 'Erro ao buscar na web. Tente novamente.')
              setIsSearchingWeb(false)
              return
            }

            // Phase progress events
            const phase = event.phase as DiscoveryPhase
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

      // Stream ended without a done event
      setIsSearchingWeb(false)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setWebSearchError('Erro ao buscar na web. Tente novamente.')
      setIsSearchingWeb(false)
    }
  }

  const handleImport = async (file: File, enhancementCount: string) => {
    setShowImportModal(false)
    setIsImporting(true)
    setImportError(null)
    setImportResult(null)
    setImportSteps(INITIAL_IMPORT_STEPS.map(s => ({ ...s, status: 'pending', message: undefined })))

    const formData = new FormData()
    formData.append('file', file)
    formData.append('enhancementCount', enhancementCount)

    try {
      const res = await fetch('/api/import-xls', { method: 'POST', body: formData })

      if (!res.ok || !res.body) {
        throw new Error('Falha ao iniciar importação')
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
              setImportResult({
                imported: event.imported,
                enhanced: event.enhanced,
                skipped: event.skipped,
                duplicates: event.duplicates,
              })
              onImportComplete?.({
                academicIds: event.academicIds || [],
                enhancedIds: event.enhancedIds || [],
                imported: event.imported,
                enhanced: event.enhanced,
                duplicates: event.duplicates,
              })
              return
            }

            if (event.phase === 'error') {
              setImportError(event.message)
              return
            }

            const phase = event.phase as ImportPhase
            if (event.status === 'start' || event.status === 'progress') {
              setImportSteps(prev =>
                prev.map(s => s.phase === phase ? { ...s, status: 'active', message: event.message } : s)
              )
            } else if (event.status === 'complete') {
              setImportSteps(prev =>
                prev.map(s => s.phase === phase ? { ...s, status: 'complete', message: event.message } : s)
              )
            } else if (event.status === 'skipped') {
              setImportSteps(prev =>
                prev.map(s => s.phase === phase ? { ...s, status: 'skipped', message: event.message } : s)
              )
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Erro ao importar')
    }
  }

  const hasSearchQuery = filters?.query && filters.query.trim().length > 0

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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            startContent={<FileSpreadsheet className="w-4 h-4" />}
            onPress={() => setShowImportModal(true)}
          >
            Importar XLS
          </Button>
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

              {webSearchError && !isSearchingWeb && (
                <p className="text-sm text-danger-500">{webSearchError}</p>
              )}

              <p className="text-xs text-default-400 max-w-sm mx-auto">
                Usamos IA para buscar informações públicas sobre o acadêmico na internet
              </p>
            </div>
          )}
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

      {/* Web Discovery Progress Modal */}
      <WebDiscoveryProgress
        isOpen={isSearchingWeb}
        searchName={filters?.query || ''}
        steps={discoverySteps}
        error={streamError}
      />

      {/* Import XLS Modals */}
      <ImportXlsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
      <ImportXlsProgress
        isOpen={isImporting}
        steps={importSteps}
        error={importError}
        result={importResult}
        onClose={() => setIsImporting(false)}
      />
    </div>
  )
}
