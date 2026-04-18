'use client'

import { Modal, ModalContent, ModalBody, Progress } from '@nextui-org/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Globe, Linkedin, Database, CheckCircle2, Terminal, AlertCircle } from 'lucide-react'

export type DiscoveryPhase = 'discovery' | 'saving' | 'enrichment' | 'linkedin'

export type DiscoveryStep = {
  phase: DiscoveryPhase
  status: 'pending' | 'active' | 'complete' | 'skipped'
  message?: string
}

type Props = {
  isOpen: boolean
  searchName: string
  steps: DiscoveryStep[]
  error?: string | null
}

const phaseConfig: Record<DiscoveryPhase, { label: string; description: string; icon: typeof Globe }> = {
  discovery: {
    label: 'Pesquisando na web',
    description: 'Buscando informações acadêmicas públicas...',
    icon: Globe,
  },
  saving: {
    label: 'Salvando perfil',
    description: 'Criando perfil do acadêmico...',
    icon: Database,
  },
  enrichment: {
    label: 'Enriquecendo dados',
    description: 'Buscando dados profissionais...',
    icon: Search,
  },
  linkedin: {
    label: 'Extraindo LinkedIn',
    description: 'Coletando histórico profissional...',
    icon: Linkedin,
  },
}

export function WebDiscoveryProgress({ isOpen, searchName, steps, error }: Props) {
  const completedCount = steps.filter(s => s.status === 'complete' || s.status === 'skipped').length
  const totalProgress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0

  return (
    <Modal
      isOpen={isOpen}
      hideCloseButton
      isDismissable={false}
      size="lg"
      placement="center"
      classNames={{
        backdrop: 'bg-black/70 backdrop-blur-sm',
        base: 'bg-[#1a1b26] border border-white/10 shadow-2xl',
      }}
    >
      <ModalContent>
        <ModalBody className="py-8 px-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-violet-500/15 mb-4">
              <Terminal className="w-7 h-7 text-violet-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-gray-100">
              Descobrindo Acadêmico
            </h3>
            <p className="text-sm text-gray-500 font-mono mt-1">
              {searchName}
            </p>
          </div>

          <Progress
            aria-label="Progresso geral"
            value={totalProgress}
            className="mb-6"
            classNames={{
              indicator: 'bg-gradient-to-r from-violet-500 to-cyan-500',
              track: 'bg-white/5',
            }}
          />

          <div className="space-y-2">
            {steps.map((step, index) => {
              const config = phaseConfig[step.phase]
              const StepIcon = config.icon
              const isActive = step.status === 'active'
              const isComplete = step.status === 'complete'
              const isSkipped = step.status === 'skipped'
              const isPending = step.status === 'pending'

              return (
                <motion.div
                  key={step.phase}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    flex items-center gap-4 p-3 rounded-lg transition-all duration-300
                    ${isActive ? 'bg-violet-500/10 border border-violet-500/20' : ''}
                    ${isComplete ? 'bg-green-500/5' : ''}
                    ${isSkipped ? 'bg-white/3' : ''}
                    ${isPending ? 'opacity-40' : ''}
                  `}
                >
                  <div
                    className={`
                      w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors
                      ${isActive ? 'bg-violet-500 text-white' : ''}
                      ${isComplete ? 'bg-green-500/20 text-green-400' : ''}
                      ${isSkipped ? 'bg-white/5 text-gray-600' : ''}
                      ${isPending ? 'bg-white/5 text-gray-600' : ''}
                    `}
                  >
                    {isActive ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isComplete ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${
                      isActive ? 'text-violet-300' :
                      isComplete ? 'text-green-400' :
                      'text-gray-500'
                    }`}>
                      {config.label}
                      {isSkipped && ' (pulado)'}
                    </p>
                    <AnimatePresence>
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-gray-500 mt-0.5"
                        >
                          {step.message || config.description}
                        </motion.p>
                      )}
                      {isComplete && step.message && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-green-500 mt-0.5"
                        >
                          {step.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {error ? (
            <div className="flex items-center gap-2 mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : (
            <p className="text-xs text-center text-gray-600 mt-6 font-mono">
              Este processo pode levar alguns minutos
            </p>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
