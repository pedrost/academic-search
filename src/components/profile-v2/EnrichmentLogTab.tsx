'use client'

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
      <div className="bg-[#1a1b26] border border-white/8 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-violet-400" />
          <h3 className="font-semibold text-gray-200">Status do Enriquecimento</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            {academic.enrichmentStatus === 'COMPLETE' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : academic.enrichmentStatus === 'PARTIAL' ? (
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            ) : (
              <Clock className="w-5 h-5 text-gray-600" />
            )}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
              <span className={`text-sm font-medium font-mono ${
                academic.enrichmentStatus === 'COMPLETE' ? 'text-green-400' :
                academic.enrichmentStatus === 'PARTIAL' ? 'text-yellow-400' :
                'text-gray-500'
              }`}>
                {academic.enrichmentStatus === 'COMPLETE' ? 'Completo' :
                 academic.enrichmentStatus === 'PARTIAL' ? 'Parcial' : 'Pendente'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Último enriquecimento</p>
            <p className="font-medium text-sm text-gray-300 font-mono">
              {academic.lastEnrichedAt
                ? format(new Date(academic.lastEnrichedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : 'Nunca'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Enriquecimento via IA</p>
            <p className="font-medium text-sm text-gray-300 font-mono">
              {academic.grokEnrichedAt
                ? format(new Date(academic.grokEnrichedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : 'Nunca'}
            </p>
          </div>
        </div>
      </div>

      {/* Grok Data Card */}
      {grokData && (
        <div className="bg-[#1a1b26] border border-white/8 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-200">Dados do Enriquecimento</h3>

          {Array.isArray(grokData.sources) && grokData.sources.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Fontes utilizadas</p>
              <div className="flex flex-wrap gap-2">
                {(grokData.sources as Array<{ url?: string; title?: string; context?: string }>).map((source, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-md bg-white/5 text-gray-400 text-sm">
                    {typeof source === 'string' ? source : source.title || source.url || 'Fonte'}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Dados brutos (JSON)</p>
            <pre className="w-full overflow-auto max-h-64 p-4 text-xs font-mono bg-[#13141c] border border-white/5 rounded-lg text-gray-400">
              {JSON.stringify(grokData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* No data state */}
      {!grokData && academic.enrichmentStatus === 'PENDING' && (
        <div className="text-center py-12 bg-[#1a1b26] border border-white/5 rounded-xl">
          <Database className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400">Nenhum enriquecimento realizado</h3>
          <p className="text-gray-600 mt-1">
            Clique em &ldquo;Enriquecer&rdquo; para buscar informações atualizadas.
          </p>
        </div>
      )}
    </div>
  )
}
