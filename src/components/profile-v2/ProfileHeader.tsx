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
      <NextLink href="/" className="inline-flex items-center gap-1 text-sm text-default-500 hover:text-default-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Voltar à busca
      </NextLink>

      {/* Main header card */}
      <div className="bg-gradient-to-r from-primary-500 to-violet-500 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Avatar */}
          <Avatar
            name={getInitials(academic.name)}
            className="w-24 h-24 text-2xl bg-white/20 text-white font-bold"
          />

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{academic.name}</h1>
                {academic.currentJobTitle && (
                  <p className="text-white/90 mt-1">
                    {academic.currentJobTitle}
                    {academic.currentCompany && ` @ ${academic.currentCompany}`}
                  </p>
                )}
                {location && (
                  <p className="text-white/70 text-sm mt-1">
                    {location}
                    {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
                      <> · {SECTOR_LABELS[academic.currentSector]}</>
                    )}
                  </p>
                )}
              </div>
              <Chip color={statusColors[academic.enrichmentStatus]} variant="solid" className="shrink-0">
                {statusLabels[academic.enrichmentStatus]}
              </Chip>
            </div>

            {/* Links and actions */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              {academic.linkedinUrl && (
                <Link
                  href={academic.linkedinUrl}
                  isExternal
                  className="text-white/90 hover:text-white"
                >
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-white/20 text-white"
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
                  className="text-white/90 hover:text-white"
                >
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-white/20 text-white"
                    startContent={<GraduationCap className="w-4 h-4" />}
                  >
                    Lattes
                  </Button>
                </Link>
              )}
              {academic.email && (
                <Link
                  href={`mailto:${academic.email}`}
                  className="text-white/90 hover:text-white"
                >
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-white/20 text-white"
                    startContent={<Mail className="w-4 h-4" />}
                  >
                    Email
                  </Button>
                </Link>
              )}
              <Button
                size="sm"
                variant="solid"
                color="secondary"
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
