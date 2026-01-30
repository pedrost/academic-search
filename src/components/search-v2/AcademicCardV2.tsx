'use client'

import { Card, CardBody, CardFooter, Chip, Button, Avatar } from '@nextui-org/react'
import { Building2, GraduationCap, MapPin, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
  onEnrich?: (id: string) => void
  isEnriching?: boolean
}

const degreeColors: Record<string, 'primary' | 'secondary' | 'success'> = {
  MASTERS: 'primary',
  PHD: 'secondary',
  POSTDOC: 'success',
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

const sectorIcons: Record<string, string> = {
  ACADEMIA: '🎓',
  GOVERNMENT: '🏛️',
  PRIVATE: '🏢',
  NGO: '🤝',
  UNKNOWN: '❓',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function AcademicCardV2({ academic, onEnrich, isEnriching }: Props) {
  const firstDissertation = academic.dissertations[0]
  const location = [academic.currentCity, academic.currentState].filter(Boolean).join(', ')

  return (
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardBody className="gap-3">
        {/* Header: Avatar, Name, Status */}
        <div className="flex gap-3 items-start">
          <Avatar
            name={getInitials(academic.name)}
            className="bg-gradient-to-br from-primary-500 to-violet-500 text-white font-semibold"
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{academic.name}</h3>
            {academic.currentJobTitle && (
              <p className="text-sm text-default-500 truncate">
                {academic.currentJobTitle}
                {academic.currentCompany && ` @ ${academic.currentCompany}`}
              </p>
            )}
            {location && (
              <p className="text-xs text-default-400 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {location}
              </p>
            )}
          </div>
          <Chip
            size="sm"
            color={statusColors[academic.enrichmentStatus]}
            variant="flat"
          >
            {statusLabels[academic.enrichmentStatus]}
          </Chip>
        </div>

        {/* Badges: Degree, Field, Publications, Sector */}
        <div className="flex flex-wrap gap-2">
          {academic.degreeLevel && (
            <Chip
              size="sm"
              color={degreeColors[academic.degreeLevel]}
              variant="flat"
              startContent={<GraduationCap className="w-3 h-3" />}
            >
              {DEGREE_LEVEL_LABELS[academic.degreeLevel]}
            </Chip>
          )}
          {academic.researchField && (
            <Chip size="sm" variant="bordered" className="text-xs">
              {academic.researchField}
            </Chip>
          )}
          {academic.dissertations.length > 0 && (
            <Chip
              size="sm"
              variant="flat"
              startContent={<FileText className="w-3 h-3" />}
            >
              {academic.dissertations.length} pub{academic.dissertations.length > 1 ? 's' : ''}
            </Chip>
          )}
          {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
            <Chip size="sm" variant="flat" startContent={<Building2 className="w-3 h-3" />}>
              {sectorIcons[academic.currentSector]} {SECTOR_LABELS[academic.currentSector]}
            </Chip>
          )}
        </div>

        {/* Dissertation preview */}
        {firstDissertation && (
          <p className="text-sm text-default-600 line-clamp-2 bg-default-50 p-2 rounded-lg">
            &ldquo;{firstDissertation.title}&rdquo;
          </p>
        )}
      </CardBody>

      <CardFooter className="justify-between gap-2 pt-0">
        <Link href={`/academic/${academic.id}`}>
          <Button color="primary" variant="flat" size="sm">
            Ver Perfil
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {academic.graduationYear && (
            <span className="text-xs text-default-400">{academic.graduationYear}</span>
          )}
          {academic.enrichmentStatus !== 'COMPLETE' && onEnrich && (
            <Button
              size="sm"
              variant="ghost"
              isLoading={isEnriching}
              onPress={() => onEnrich(academic.id)}
              startContent={!isEnriching && <Sparkles className="w-3 h-3" />}
            >
              Enriquecer
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
