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
        <h3 className="text-lg font-medium text-default-600">Nenhuma publicacao encontrada</h3>
        <p className="text-default-400 mt-1">
          Este academico ainda nao possui dissertacoes ou teses cadastradas.
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
