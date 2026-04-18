'use client'

import { Button, Link } from '@nextui-org/react'
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
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (academic.dissertations.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-700 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-400">Nenhuma publicação encontrada</h3>
        <p className="text-gray-600 mt-1">
          Este acadêmico ainda não possui dissertações ou teses cadastradas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {academic.dissertations.map((diss) => {
        const isExpanded = expandedIds.has(diss.id)

        return (
          <div key={diss.id} className="bg-[#1a1b26] border border-white/8 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-gray-200">{diss.title}</h3>
                <p className="text-sm text-gray-500 mt-1 font-mono">
                  {diss.institution} · {diss.defenseYear}
                  {diss.program && ` · ${diss.program}`}
                </p>
              </div>
              <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-violet-500/15 text-violet-400 font-mono">
                {diss.defenseYear}
              </span>
            </div>

            {diss.advisorName && (
              <p className="text-sm text-gray-400">
                <span className="text-gray-500">Orientador:</span> {diss.advisorName}
              </p>
            )}

            {(diss.keywords as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(diss.keywords as string[]).map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 rounded border border-white/10 text-gray-400 text-xs">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {diss.abstract && (
              <>
                <p className={`text-sm text-gray-500 leading-relaxed ${!isExpanded && 'line-clamp-3'}`}>
                  {diss.abstract}
                </p>
                {diss.abstract.length > 200 && (
                  <Button
                    size="sm"
                    variant="light"
                    className="text-gray-400 hover:text-gray-200 p-0 h-auto min-w-0"
                    onPress={() => toggleExpanded(diss.id)}
                    endContent={isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                className="inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300"
              >
                Ver no Sucupira <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
