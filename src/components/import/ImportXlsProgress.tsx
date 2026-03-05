'use client'

import { Modal, ModalContent, ModalBody, ModalFooter, Progress, Button } from '@nextui-org/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSpreadsheet,
  Sparkles,
  Database,
  Globe,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export type ImportPhase = 'parsing' | 'extracting' | 'inserting' | 'enhancing'

export type ImportStep = {
  phase: ImportPhase
  status: 'pending' | 'active' | 'complete' | 'skipped'
  message?: string
}

type Props = {
  isOpen: boolean
  steps: ImportStep[]
  error?: string | null
  result?: {
    imported: number
    enhanced: number
    skipped: number
    duplicates: number
  } | null
  onClose?: () => void
}

const phaseConfig: Record<ImportPhase, { label: string; description: string; icon: typeof Globe }> = {
  parsing: {
    label: 'Lendo arquivo',
    description: 'Convertendo planilha para texto...',
    icon: FileSpreadsheet,
  },
  extracting: {
    label: 'Extraindo com IA',
    description: 'Identificando acadêmicos nos dados...',
    icon: Sparkles,
  },
  inserting: {
    label: 'Salvando no banco',
    description: 'Inserindo acadêmicos...',
    icon: Database,
  },
  enhancing: {
    label: 'Enriquecendo perfis',
    description: 'Buscando dados na web...',
    icon: Globe,
  },
}

export function ImportXlsProgress({ isOpen, steps, error, result, onClose }: Props) {
  const completedCount = steps.filter(s => s.status === 'complete' || s.status === 'skipped').length
  const totalProgress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0
  const isDone = !!result
  const hasError = !!error

  return (
    <Modal
      isOpen={isOpen}
      hideCloseButton={!isDone && !hasError}
      isDismissable={isDone || hasError}
      onClose={onClose}
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
              {isDone ? (
                <CheckCircle2 className="w-8 h-8 text-success-600" />
              ) : hasError ? (
                <AlertCircle className="w-8 h-8 text-danger-600" />
              ) : (
                <FileSpreadsheet className="w-8 h-8 text-primary-600 animate-pulse" />
              )}
            </div>
            <h3 className="text-xl font-bold text-default-900">
              {isDone ? 'Importação Concluída' : hasError ? 'Erro na Importação' : 'Importando Planilha'}
            </h3>
          </div>

          <Progress
            aria-label="Progresso geral"
            value={isDone ? 100 : totalProgress}
            className="mb-6"
            classNames={{
              indicator: isDone
                ? 'bg-gradient-to-r from-success-500 to-success-400'
                : 'bg-gradient-to-r from-primary-500 to-violet-500',
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
                      {(isActive || isComplete) && step.message && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className={`text-xs mt-0.5 ${isActive ? 'text-default-500' : 'text-success-600'}`}
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

          {/* Result Summary */}
          {isDone && result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-success-50 rounded-xl border border-success-200"
            >
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-default-500">Importados:</span>
                  <span className="ml-2 font-semibold text-success-700">{result.imported}</span>
                </div>
                <div>
                  <span className="text-default-500">Enriquecidos:</span>
                  <span className="ml-2 font-semibold text-success-700">{result.enhanced}</span>
                </div>
                <div>
                  <span className="text-default-500">Já existentes:</span>
                  <span className="ml-2 font-semibold text-default-600">{result.duplicates}</span>
                </div>
                <div>
                  <span className="text-default-500">Erros:</span>
                  <span className="ml-2 font-semibold text-default-600">{result.skipped}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {hasError && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-danger-50 rounded-xl border border-danger-200">
              <AlertCircle className="w-5 h-5 text-danger-500 shrink-0" />
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          )}

          {/* In progress hint */}
          {!isDone && !hasError && (
            <p className="text-xs text-center text-default-400 mt-6">
              Este processo pode levar alguns minutos
            </p>
          )}
        </ModalBody>

        {(isDone || hasError) && (
          <ModalFooter>
            <Button color="primary" onPress={onClose}>
              Fechar
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  )
}
