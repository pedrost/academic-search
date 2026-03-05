'use client'

import { Modal, ModalContent, ModalBody, Progress } from '@nextui-org/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Linkedin, Building2, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react'

export type EnrichmentPhase = 'search' | 'linkedin' | 'save'

export type EnrichmentStep = {
  phase: EnrichmentPhase
  status: 'pending' | 'active' | 'complete' | 'skipped'
  message?: string
}

type Props = {
  isOpen: boolean
  academicName: string
  steps: EnrichmentStep[]
  error?: string | null
}

const phaseConfig: Record<EnrichmentPhase, { label: string; description: string; icon: typeof Search }> = {
  search: {
    label: 'Buscando informações',
    description: 'Pesquisando dados profissionais públicos...',
    icon: Search,
  },
  linkedin: {
    label: 'Extraindo LinkedIn',
    description: 'Coletando histórico de carreira e educação...',
    icon: Linkedin,
  },
  save: {
    label: 'Salvando resultados',
    description: 'Atualizando perfil com dados encontrados...',
    icon: Building2,
  },
}

export function EnrichmentProgress({ isOpen, academicName, steps, error }: Props) {
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
        backdrop: 'bg-black/60 backdrop-blur-sm',
        base: 'bg-white shadow-2xl',
      }}
    >
      <ModalContent>
        <ModalBody className="py-8 px-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
              <Sparkles className="w-8 h-8 text-primary-600 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-default-900">
              Enriquecendo Perfil
            </h3>
            <p className="text-sm text-default-500 mt-1">
              {academicName}
            </p>
          </div>

          <Progress
            aria-label="Progresso geral"
            value={totalProgress}
            className="mb-6"
            classNames={{
              indicator: 'bg-gradient-to-r from-primary-500 to-violet-500',
              track: 'bg-default-100',
            }}
          />

          <div className="space-y-3">
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
                    flex items-center gap-4 p-3 rounded-xl transition-all duration-300
                    ${isActive ? 'bg-primary-50 border border-primary-200' : ''}
                    ${isComplete ? 'bg-success-50' : ''}
                    ${isSkipped ? 'bg-default-50' : ''}
                    ${isPending ? 'opacity-50' : ''}
                  `}
                >
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors
                      ${isActive ? 'bg-primary-500 text-white' : ''}
                      ${isComplete ? 'bg-success-500 text-white' : ''}
                      ${isSkipped ? 'bg-default-300 text-white' : ''}
                      ${isPending ? 'bg-default-100 text-default-400' : ''}
                    `}
                  >
                    {isActive ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isComplete ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`
                        font-medium text-sm
                        ${isActive ? 'text-primary-700' : ''}
                        ${isComplete ? 'text-success-700' : ''}
                        ${isSkipped ? 'text-default-400' : ''}
                        ${isPending ? 'text-default-400' : ''}
                      `}
                    >
                      {config.label}
                      {isSkipped && ' (pulado)'}
                    </p>
                    <AnimatePresence>
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-default-500 mt-0.5"
                        >
                          {step.message || config.description}
                        </motion.p>
                      )}
                      {isComplete && step.message && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-success-600 mt-0.5"
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
            <div className="flex items-center gap-2 mt-4 p-3 bg-danger-50 rounded-xl border border-danger-200">
              <AlertCircle className="w-5 h-5 text-danger-500 shrink-0" />
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          ) : (
            <p className="text-xs text-center text-default-400 mt-6">
              Este processo pode levar alguns minutos
            </p>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
