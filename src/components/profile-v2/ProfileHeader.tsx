'use client'

import { Chip, Button } from '@nextui-org/react'
import { ArrowLeft, Linkedin, GraduationCap, Mail } from 'lucide-react'
import NextLink from 'next/link'
import { AcademicWithDissertations } from '@/types'
import { SECTOR_LABELS } from '@/lib/constants'
import { EnrichmentConfigurator, type EnrichmentConfig } from './EnrichmentConfigurator'

export type { EnrichmentConfig }

const statusLabels: Record<string, string> = {
  COMPLETE: 'Completo',
  PARTIAL: 'Parcial',
  PENDING: 'Pendente',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

type Props = {
  academic: AcademicWithDissertations
  onEnrich: () => void
  isEnriching: boolean
  config: EnrichmentConfig
  onConfigChange: (config: EnrichmentConfig) => void
}

export function ProfileHeader({ academic, onEnrich, isEnriching, config, onConfigChange }: Props) {
  const location = [academic.currentCity, academic.currentState].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      <NextLink href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" />
        Voltar à busca
      </NextLink>

      <div className="bg-[#1a1b26] border border-white/10 rounded-xl p-6 md:p-8 glow-violet">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-white/10 flex items-center justify-center text-xl font-bold text-violet-300 font-mono shrink-0">
            {getInitials(academic.name)}
          </div>

          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-100">{academic.name}</h1>
                {academic.currentJobTitle && (
                  <p className="text-gray-400 text-lg mt-2">
                    {academic.currentJobTitle}
                    {academic.currentCompany && <span className="text-gray-600"> @ {academic.currentCompany}</span>}
                  </p>
                )}
                {location && (
                  <p className="text-gray-500 text-sm mt-2">
                    {location}
                    {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
                      <> · {SECTOR_LABELS[academic.currentSector]}</>
                    )}
                  </p>
                )}
              </div>
              <Chip
                variant="flat"
                classNames={{
                  base: `px-3 py-1.5 shrink-0 border-0 ${
                    academic.enrichmentStatus === 'COMPLETE' ? 'bg-green-500/15' :
                    academic.enrichmentStatus === 'PARTIAL' ? 'bg-yellow-500/15' :
                    'bg-white/5'
                  }`,
                  content: `text-sm font-medium font-mono ${
                    academic.enrichmentStatus === 'COMPLETE' ? 'text-green-400' :
                    academic.enrichmentStatus === 'PARTIAL' ? 'text-yellow-400' :
                    'text-gray-500'
                  }`
                }}
              >
                {statusLabels[academic.enrichmentStatus]}
              </Chip>
            </div>

            {/* Profile links row */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {academic.linkedinUrl && (
                <Button
                  as="a"
                  href={academic.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="flat"
                  size="sm"
                  className="bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 px-3 gap-2"
                  startContent={<Linkedin className="w-3.5 h-3.5 text-blue-400" />}
                >
                  LinkedIn
                </Button>
              )}
              {academic.lattesUrl && (
                <Button
                  as="a"
                  href={academic.lattesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="flat"
                  size="sm"
                  className="bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 px-3 gap-2"
                  startContent={<GraduationCap className="w-3.5 h-3.5 text-violet-400" />}
                >
                  Lattes
                </Button>
              )}
              {academic.email && (
                <Button
                  as="a"
                  href={`mailto:${academic.email}`}
                  variant="flat"
                  size="sm"
                  className="bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 px-3 gap-2"
                  startContent={<Mail className="w-3.5 h-3.5 text-cyan-400" />}
                >
                  Email
                </Button>
              )}
            </div>

            {/* Enrichment configurator */}
            <div className="mt-5 pt-5 border-t border-white/5">
              <EnrichmentConfigurator
                config={config}
                onChange={onConfigChange}
                isEnriching={isEnriching}
                onEnrich={onEnrich}
                isComplete={academic.enrichmentStatus === 'COMPLETE'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
