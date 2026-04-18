'use client'

import { Modal, ModalContent, ModalBody, Button } from '@nextui-org/react'
import { Globe, GraduationCap, Linkedin, Search, Building2, Sparkles, AlertCircle } from 'lucide-react'
import { useState } from 'react'

export type DiscoverySource = 'lattes' | 'linkedin' | 'serpapi' | 'proxycurl' | 'grok'

type SourceMeta = {
  label: string
  description: string
  cost: string
  icon: React.ElementType
  warning?: string
}

const SOURCE_META: Record<DiscoverySource, SourceMeta> = {
  lattes:    { label: 'Lattes CNPq',      description: 'Currículo acadêmico via Scrapling',             cost: 'Grátis',  icon: GraduationCap },
  linkedin:  { label: 'LinkedIn Voyager', description: 'Cargo e empresa via API interna',               cost: 'Grátis*', icon: Linkedin,      warning: 'Requer sessão em /admin/browser' },
  serpapi:   { label: 'SerpAPI',          description: 'Busca Google para encontrar perfil LinkedIn',   cost: '~$0,01',  icon: Search,        warning: 'Requer SERPAPI_KEY' },
  proxycurl: { label: 'Proxycurl',        description: 'Extração completa do perfil LinkedIn',          cost: '~$0,10',  icon: Building2,     warning: 'Requer PROXYCURL_KEY' },
  grok:      { label: 'Grok AI',          description: 'Pesquisa web com IA para descoberta',           cost: '~$0,20',  icon: Sparkles,      warning: 'Requer XAI_API_KEY' },
}

const PRESETS: Array<{ label: string; sources: DiscoverySource[] }> = [
  { label: 'FREE',  sources: ['lattes', 'linkedin'] },
  { label: 'API',   sources: ['serpapi', 'proxycurl'] },
  { label: 'AI',    sources: ['grok', 'linkedin'] },
  { label: 'Tudo',  sources: ['lattes', 'linkedin', 'serpapi', 'proxycurl', 'grok'] },
]

const ALL_SOURCES: DiscoverySource[] = ['lattes', 'linkedin', 'serpapi', 'proxycurl', 'grok']

type Props = {
  isOpen: boolean
  searchName: string
  onClose: () => void
  onStart: (sources: DiscoverySource[]) => void
}

export function WebDiscoveryModal({ isOpen, searchName, onClose, onStart }: Props) {
  const [sources, setSources] = useState<DiscoverySource[]>(['lattes', 'linkedin'])
  const [showCustom, setShowCustom] = useState(false)

  function toggleSource(source: DiscoverySource) {
    setSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    )
  }

  const totalCost = sources.reduce((acc, s) => {
    if (s === 'serpapi')   return acc + 0.01
    if (s === 'proxycurl') return acc + 0.10
    if (s === 'grok')      return acc + 0.20
    return acc
  }, 0)
  const costLabel = totalCost === 0 ? 'Grátis' : `~$${totalCost.toFixed(2)}`

  const activePreset = PRESETS.find(p =>
    p.sources.length === sources.length &&
    p.sources.every(s => sources.includes(s))
  )?.label ?? null

  const handleStart = () => {
    if (sources.length === 0) return
    onStart(sources)
  }

  const handleClose = () => {
    setSources(['lattes', 'linkedin'])
    setShowCustom(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      placement="center"
      classNames={{
        backdrop: 'bg-black/70 backdrop-blur-sm',
        base: 'bg-[#1a1b26] border border-white/10 shadow-2xl',
      }}
    >
      <ModalContent>
        <ModalBody className="p-6 gap-0">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-gray-100">Buscar na Web</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Descobrir <span className="text-gray-300 font-medium">{searchName}</span> usando múltiplas fontes
            </p>
          </div>

          {/* Tier presets */}
          <div className="mb-4">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              Fontes de dados
            </span>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSources([...p.sources])}
                  className={`flex-1 px-3 py-2 text-xs font-semibold font-mono transition-colors ${
                    activePreset === p.label
                      ? 'bg-violet-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Customize toggle */}
          <button
            type="button"
            onClick={() => setShowCustom(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-3 text-left"
          >
            {showCustom ? '▾' : '▸'} Personalizar ({sources.length} fonte{sources.length !== 1 ? 's' : ''})
          </button>

          {/* Custom source toggles */}
          {showCustom && (
            <div className="bg-black/20 rounded-xl border border-white/10 p-3 mb-4">
              <div className="grid grid-cols-1 gap-2">
                {ALL_SOURCES.map(source => {
                  const meta = SOURCE_META[source]
                  const Icon = meta.icon
                  const enabled = sources.includes(source)

                  return (
                    <div
                      key={source}
                      role="checkbox"
                      aria-checked={enabled}
                      tabIndex={0}
                      onClick={() => toggleSource(source)}
                      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSource(source) } }}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors select-none ${
                        enabled ? 'bg-white/10' : 'bg-white/3'
                      } hover:bg-white/15`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        enabled ? 'bg-white/20' : 'bg-white/5'
                      }`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${enabled ? 'text-white' : 'text-white/40'}`}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-white/50 bg-white/10 px-1.5 py-0.5 rounded font-mono">
                            {meta.cost}
                          </span>
                        </div>
                        <p className={`text-xs ${enabled ? 'text-white/60' : 'text-white/25'}`}>
                          {meta.description}
                        </p>
                      </div>

                      {meta.warning && (
                        <AlertCircle className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      )}

                      <div
                        aria-hidden="true"
                        className={`w-8 h-4.5 rounded-full relative transition-colors shrink-0 ${
                          enabled ? 'bg-violet-500' : 'bg-white/15'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cost summary */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
            <span>Custo estimado</span>
            <span className="font-mono font-medium text-gray-300">{costLabel}</span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="flat" className="bg-white/5 text-gray-400 hover:bg-white/10" onPress={handleClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              isDisabled={sources.length === 0}
              onPress={handleStart}
              startContent={<Globe className="w-3.5 h-3.5" />}
              className="bg-violet-600 text-white hover:bg-violet-500"
            >
              Buscar na Web · {costLabel}
            </Button>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
