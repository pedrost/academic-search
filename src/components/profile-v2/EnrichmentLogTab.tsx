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
