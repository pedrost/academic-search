'use client'

import { useState } from 'react'
import { Button } from '@nextui-org/react'
import { ChevronDown, ChevronUp, GraduationCap, Linkedin, Search, Building2, Sparkles, AlertCircle } from 'lucide-react'
import type { EnrichmentPhase } from './EnrichmentProgress'

export type EnrichmentSource = 'lattes' | 'linkedin' | 'serpapi' | 'proxycurl' | 'grok'

export type EnrichmentConfig = {
  sources: EnrichmentSource[]
}

type SourceMeta = {
  label: string
  description: string
  cost: string
  icon: React.ElementType
  phase: EnrichmentPhase
  warning?: string
}

const SOURCE_META: Record<EnrichmentSource, SourceMeta> = {
  lattes:    { label: 'Lattes CNPq',      description: 'Currículo acadêmico, grau, áreas de pesquisa', cost: 'Grátis',  icon: GraduationCap, phase: 'lattes' },
  linkedin:  { label: 'LinkedIn Voyager', description: 'Cargo e empresa atual via API interna',         cost: 'Grátis*', icon: Linkedin,      phase: 'linkedin',  warning: 'Requer sessão em /admin/browser' },
  serpapi:   { label: 'SerpAPI',          description: 'Busca Google para encontrar perfil LinkedIn',   cost: '~$0,01',  icon: Search,        phase: 'serpapi',   warning: 'Requer SERPAPI_KEY' },
  proxycurl: { label: 'Proxycurl',        description: 'Extração completa do perfil LinkedIn',          cost: '~$0,10',  icon: Building2,     phase: 'proxycurl', warning: 'Requer PROXYCURL_KEY' },
  grok:      { label: 'Grok AI',          description: 'Pesquisa web com IA para descoberta',           cost: '~$0,20',  icon: Sparkles,      phase: 'discovery', warning: 'Requer XAI_API_KEY' },
}

const PRESETS: Array<{ label: string; sources: EnrichmentSource[] }> = [
  { label: 'FREE', sources: ['lattes', 'linkedin'] },
  { label: 'API',  sources: ['serpapi', 'proxycurl'] },
  { label: 'AI',   sources: ['grok', 'linkedin'] },
  { label: 'Tudo', sources: ['lattes', 'linkedin', 'serpapi', 'proxycurl', 'grok'] },
]

const ALL_SOURCES: EnrichmentSource[] = ['lattes', 'linkedin', 'serpapi', 'proxycurl', 'grok']

type Props = {
  config: EnrichmentConfig
  onChange: (config: EnrichmentConfig) => void
  isEnriching: boolean
  onEnrich: () => void
  isComplete: boolean
}

export function EnrichmentConfigurator({ config, onChange, isEnriching, onEnrich, isComplete }: Props) {
  const [expanded, setExpanded] = useState(false)

  function toggleSource(source: EnrichmentSource) {
    const has = config.sources.includes(source)
    onChange({ sources: has ? config.sources.filter(s => s !== source) : [...config.sources, source] })
  }

  const totalCost = config.sources.reduce((acc, s) => {
    if (s === 'serpapi')   return acc + 0.01
    if (s === 'proxycurl') return acc + 0.10
    if (s === 'grok')      return acc + 0.20
    return acc
  }, 0)
  const costLabel = totalCost === 0 ? 'Grátis' : `~$${totalCost.toFixed(2)}`

  const activePreset = PRESETS.find(p =>
    p.sources.length === config.sources.length &&
    p.sources.every(s => config.sources.includes(s))
  )?.label ?? null

  if (isComplete) {
    return (
      <Button isDisabled startContent={<Sparkles className="w-4 h-4" />}
        className="bg-white/5 text-gray-500 cursor-not-allowed font-medium border border-white/5">
        Já enriquecido
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Presets + expand + enrich */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange({ sources: [...p.sources] })}
              disabled={isEnriching}
              className={`px-3 py-1.5 text-xs font-semibold font-mono transition-colors ${
                activePreset === p.label
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(v => !v)}
          disabled={isEnriching}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors py-1.5 px-1"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>Personalizar ({config.sources.length})</span>
        </button>

        <Button
          variant="solid"
          className="bg-violet-600 text-white hover:bg-violet-500 font-medium ml-auto"
          isLoading={isEnriching}
          isDisabled={config.sources.length === 0}
          onPress={onEnrich}
          startContent={!isEnriching && <Sparkles className="w-4 h-4" />}
        >
          {isEnriching ? 'Enriquecendo...' : `Enriquecer · ${costLabel}`}
        </Button>
      </div>

      {/* Source toggles panel */}
      {expanded && !isEnriching && (
        <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-white/15 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_SOURCES.map(source => {
              const meta = SOURCE_META[source]
              const Icon = meta.icon
              const enabled = config.sources.includes(source)

              return (
                <div
                  key={source}
                  role="checkbox"
                  aria-checked={enabled}
                  aria-label={meta.label}
                  tabIndex={0}
                  onClick={() => toggleSource(source)}
                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSource(source) } }}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors select-none ${
                    enabled ? 'bg-white/15' : 'bg-white/5'
                  } hover:bg-white/20`}
                >
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    enabled ? 'bg-white/25' : 'bg-white/10'
                  }`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium transition-colors ${enabled ? 'text-white' : 'text-white/50'}`}>
                        {meta.label}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-white/70 bg-white/10 px-1.5 py-0.5 rounded">
                          {meta.cost}
                        </span>
                        {/* Purely visual switch — the card's onClick is the single source of truth */}
                        <div
                          aria-hidden="true"
                          className={`w-9 h-5 rounded-full relative transition-colors ${
                            enabled ? 'bg-success-500' : 'bg-white/20'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            enabled ? 'translate-x-4' : 'translate-x-0.5'
                          }`} />
                        </div>
                      </div>
                    </div>
                    <p className={`text-xs mt-0.5 transition-colors ${enabled ? 'text-white/70' : 'text-white/35'}`}>
                      {meta.description}
                    </p>
                    {meta.warning && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3 text-white/40 shrink-0" />
                        <span className="text-xs text-white/40">{meta.warning}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function configToPhases(config: EnrichmentConfig): EnrichmentPhase[] {
  return config.sources
    .map(s => SOURCE_META[s].phase)
    .filter((p, i, arr) => arr.indexOf(p) === i)
}
