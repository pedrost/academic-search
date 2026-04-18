'use client'

import { Card, CardBody, Chip } from '@nextui-org/react'
import { MapPin, Briefcase, GraduationCap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
}

export function AcademicCardV2({ academic }: Props) {
  const router = useRouter()
  const firstDissertation = academic.dissertations[0]
  const location = [academic.currentCity, academic.currentState].filter(Boolean).join(', ')
  const hasJobInfo = academic.currentJobTitle || academic.currentCompany

  const handleCardClick = () => {
    router.push(`/academic/${academic.id}`)
  }

  return (
    <Card
      isPressable
      onPress={handleCardClick}
      className="w-full bg-[#1a1b26] border border-white/8 hover:border-violet-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.08)] transition-all duration-300 cursor-pointer group"
    >
      <CardBody className="p-4">
        {/* Name + Year row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-base text-gray-100 group-hover:text-violet-300 transition-colors line-clamp-1">
            {academic.name}
          </h3>
          {academic.graduationYear && (
            <span className="text-sm text-gray-600 font-mono shrink-0">
              {academic.graduationYear}
            </span>
          )}
        </div>

        {/* Job info */}
        {hasJobInfo && (
          <p className="text-sm text-gray-400 flex items-center gap-1.5 mb-1">
            <Briefcase className="w-3.5 h-3.5 text-gray-600 shrink-0" />
            <span className="truncate">
              {academic.currentJobTitle}
              {academic.currentCompany && (
                <span className="text-gray-600"> · {academic.currentCompany}</span>
              )}
            </span>
          </p>
        )}

        {/* Location */}
        {location && (
          <p className="text-sm text-gray-500 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        )}

        {/* Tags row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {academic.degreeLevel && (
            <Chip
              size="sm"
              variant="flat"
              startContent={<GraduationCap className="w-3 h-3" />}
              classNames={{ base: 'h-6 bg-violet-500/15 border-0', content: 'text-xs font-medium text-violet-300' }}
            >
              {DEGREE_LEVEL_LABELS[academic.degreeLevel]}
            </Chip>
          )}
          {academic.researchField && (
            <Chip
              size="sm"
              variant="flat"
              classNames={{ base: 'h-6 bg-white/5 border-0', content: 'text-xs text-gray-400' }}
            >
              {academic.researchField}
            </Chip>
          )}
          {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
            <Chip
              size="sm"
              variant="flat"
              classNames={{ base: 'h-6 bg-green-500/15 border-0', content: 'text-xs text-green-400' }}
            >
              {SECTOR_LABELS[academic.currentSector]}
            </Chip>
          )}
        </div>

        {/* Dissertation title */}
        {firstDissertation && (
          <p className="text-sm text-gray-500 mt-3 line-clamp-2 leading-relaxed">
            {firstDissertation.title}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
