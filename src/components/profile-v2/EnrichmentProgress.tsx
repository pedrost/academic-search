'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalContent, ModalBody, Progress } from '@nextui-org/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Linkedin, Building2, CheckCircle2, Sparkles } from 'lucide-react'

type Props = {
  isOpen: boolean
  academicName: string
}

const steps = [
  {
    id: 'search',
    label: 'Buscando informações',
    description: 'Pesquisando dados públicos sobre o acadêmico...',
    icon: Search,
    duration: 60000, // 60s - Phase 1: Finding LinkedIn
  },
  {
    id: 'linkedin',
    label: 'Procurando LinkedIn',
    description: 'Buscando perfil profissional no LinkedIn...',
    icon: Linkedin,
    duration: 60000, // 60s - Phase 1 continues
  },
  {
    id: 'extract',
    label: 'Extraindo dados do perfil',
    description: 'Coletando histórico de carreira e educação...',
    icon: Building2,
    duration: 120000, // 120s - Phase 2: LinkedIn profile extraction
  },
  {
    id: 'save',
    label: 'Salvando resultados',
    description: 'Atualizando perfil com dados encontrados...',
    icon: CheckCircle2,
    duration: 5000, // 5s
  },
]

export function EnrichmentProgress({ isOpen, academicName }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepProgress, setStepProgress] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0)
      setStepProgress(0)
      return
    }

    // Progress within current step
    const progressInterval = setInterval(() => {
      setStepProgress((prev) => {
        if (prev >= 100) return 100
        return prev + 2
      })
    }, steps[currentStep]?.duration / 50 || 300)

    // Move to next step
    const stepTimeout = setTimeout(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1)
        setStepProgress(0)
      }
    }, steps[currentStep]?.duration || 15000)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(stepTimeout)
    }
  }, [isOpen, currentStep])

  const totalProgress = ((currentStep * 100) + stepProgress) / steps.length

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
          {/* Header */}
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

          {/* Overall progress */}
          <Progress
            aria-label="Progresso geral"
            value={totalProgress}
            className="mb-6"
            classNames={{
              indicator: 'bg-gradient-to-r from-primary-500 to-violet-500',
              track: 'bg-default-100',
            }}
          />

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index === currentStep
              const isComplete = index < currentStep
              const isPending = index > currentStep

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    flex items-center gap-4 p-3 rounded-xl transition-all duration-300
                    ${isActive ? 'bg-primary-50 border border-primary-200' : ''}
                    ${isComplete ? 'bg-success-50' : ''}
                    ${isPending ? 'opacity-50' : ''}
                  `}
                >
                  {/* Icon */}
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors
                      ${isActive ? 'bg-primary-500 text-white' : ''}
                      ${isComplete ? 'bg-success-500 text-white' : ''}
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

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`
                        font-medium text-sm
                        ${isActive ? 'text-primary-700' : ''}
                        ${isComplete ? 'text-success-700' : ''}
                        ${isPending ? 'text-default-400' : ''}
                      `}
                    >
                      {step.label}
                    </p>
                    <AnimatePresence>
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-default-500 mt-0.5"
                        >
                          {step.description}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Step progress */}
                  {isActive && (
                    <div className="text-xs font-medium text-primary-600">
                      {Math.round(stepProgress)}%
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Footer note */}
          <p className="text-xs text-center text-default-400 mt-6">
            Este processo pode levar até 5 minutos
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
