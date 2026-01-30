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
