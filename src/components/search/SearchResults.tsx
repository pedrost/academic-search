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
