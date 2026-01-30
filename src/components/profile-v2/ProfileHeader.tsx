'use client'

import { Avatar, Button, Chip, Link } from '@nextui-org/react'
import { ArrowLeft, Linkedin, GraduationCap, Mail, Sparkles, ExternalLink } from 'lucide-react'
import NextLink from 'next/link'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
  onEnrich: () => void
  isEnriching: boolean
}

const statusColors: Record<string, 'success' | 'warning' | 'default'> = {
  COMPLETE: 'success',
  PARTIAL: 'warning',
  PENDING: 'default',
}

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

export function ProfileHeader({ academic, onEnrich, isEnriching }: Props) {
  const location = [academic.currentCity, academic.currentState].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      {/* Back button */}
      <NextLink href="/" className="inline-flex items-center gap-2 text-sm text-default-600 hover:text-default-800 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" />
        Voltar à busca
      </NextLink>

      {/* Main header card */}
      <div className="bg-gradient-to-r from-primary-500 to-violet-500 rounded-2xl p-6 md:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Avatar */}
          <Avatar
            name={getInitials(academic.name)}
            className="w-24 h-24 text-2xl bg-white/25 text-white font-bold shrink-0"
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">{academic.name}</h1>
                {academic.currentJobTitle && (
                  <p className="text-white/90 text-lg mt-2">
                    {academic.currentJobTitle}
                    {academic.currentCompany && ` @ ${academic.currentCompany}`}
                  </p>
                )}
                {location && (
                  <p className="text-white/80 text-sm mt-2">
                    {location}
                    {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
                      <> · {SECTOR_LABELS[academic.currentSector]}</>
                    )}
                  </p>
                )}
              </div>
              <Chip
                color={statusColors[academic.enrichmentStatus]}
                variant="solid"
                classNames={{ base: 'px-4 py-2 shrink-0', content: 'text-sm font-semibold' }}
              >
                {statusLabels[academic.enrichmentStatus]}
              </Chip>
            </div>

            {/* Links and actions */}
            <div className="flex flex-wrap items-center gap-3 mt-6">
              {academic.linkedinUrl && (
                <Link
                  href={academic.linkedinUrl}
                  isExternal
                >
                  <Button
                    variant="flat"
                    className="bg-white/20 text-white hover:bg-white/30 px-4 gap-2"
                    startContent={<Linkedin className="w-4 h-4" />}
                  >
                    LinkedIn
                  </Button>
                </Link>
              )}
              {academic.lattesUrl && (
                <Link
                  href={academic.lattesUrl}
                  isExternal
                >
                  <Button
                    variant="flat"
                    className="bg-white/20 text-white hover:bg-white/30 px-4 gap-2"
                    startContent={<GraduationCap className="w-4 h-4" />}
                  >
                    Lattes
                  </Button>
                </Link>
              )}
              {academic.email && (
                <Link
                  href={`mailto:${academic.email}`}
                >
                  <Button
                    variant="flat"
                    className="bg-white/20 text-white hover:bg-white/30 px-4 gap-2"
                    startContent={<Mail className="w-4 h-4" />}
                  >
                    Email
                  </Button>
                </Link>
              )}
              <Button
                variant="solid"
                className="bg-white text-primary-600 hover:bg-white/90 px-4 gap-2 font-medium"
                isLoading={isEnriching}
                onPress={onEnrich}
                startContent={!isEnriching && <Sparkles className="w-4 h-4" />}
              >
                {isEnriching ? 'Enriquecendo...' : 'Enriquecer'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
