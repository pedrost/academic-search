'use client'

import { Card, CardBody, Chip, CheckboxGroup, Checkbox } from '@nextui-org/react'
import { GraduationCap, FileText, Building2, Award } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
}

type TimelineEvent = {
  id: string
  type: 'degree' | 'dissertation' | 'employment' | 'award'
  year: number | null
  title: string
  subtitle: string
  details?: string
}

const eventIcons = {
  degree: GraduationCap,
  dissertation: FileText,
  employment: Building2,
  award: Award,
}

const eventColors = {
  degree: 'secondary',
  dissertation: 'primary',
  employment: 'success',
  award: 'warning',
} as const

// Fixed Tailwind classes for each event type (dynamic classes don't work)
const eventBgClasses = {
  degree: 'bg-secondary-100',
  dissertation: 'bg-primary-100',
  employment: 'bg-success-100',
  award: 'bg-warning-100',
}

const eventIconClasses = {
  degree: 'text-secondary-600',
  dissertation: 'text-primary-600',
  employment: 'text-success-600',
  award: 'text-warning-600',
}

function buildTimeline(academic: AcademicWithDissertations): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Degree completion
  if (academic.graduationYear && academic.degreeLevel) {
    events.push({
      id: 'degree-' + academic.id,
      type: 'degree',
      year: academic.graduationYear,
      title: DEGREE_LEVEL_LABELS[academic.degreeLevel],
      subtitle: academic.institution || 'Instituição não informada',
      details: academic.researchField || undefined,
    })
  }

  // Dissertations
  academic.dissertations.forEach((diss) => {
    events.push({
      id: 'diss-' + diss.id,
      type: 'dissertation',
      year: diss.defenseYear,
      title: diss.title,
      subtitle: `${diss.institution} · ${diss.program || 'Programa não informado'}`,
      details: diss.advisorName ? `Orientador: ${diss.advisorName}` : undefined,
    })
  })

  // Employment (from grokMetadata if available)
  const grokData = academic.grokMetadata as Record<string, unknown> | null
  if (grokData?.employment) {
    const employment = grokData.employment as Array<{
      year?: number
      jobTitle?: string
      company?: string
      location?: string
    }>
    employment.forEach((job, i) => {
      events.push({
        id: 'job-' + i,
        type: 'employment',
        year: job.year || null,
        title: job.jobTitle || 'Cargo não informado',
        subtitle: job.company || 'Empresa não informada',
        details: job.location,
      })
    })
  }

  // Current employment (if not already added from grokMetadata)
  if (academic.currentJobTitle && !grokData?.employment) {
    events.push({
      id: 'current-job',
      type: 'employment',
      year: null,
      title: academic.currentJobTitle,
      subtitle: academic.currentCompany || 'Empresa não informada',
      details: [academic.currentCity, academic.currentState].filter(Boolean).join(', '),
    })
  }

  // Sort by year descending, null years at top
  return events.sort((a, b) => {
    if (a.year === null && b.year === null) return 0
    if (a.year === null) return -1
    if (b.year === null) return 1
    return b.year - a.year
  })
}

export function TimelineTab({ academic }: Props) {
  const [visibleTypes, setVisibleTypes] = useState<string[]>([
    'degree',
    'dissertation',
    'employment',
    'award',
  ])

  const allEvents = buildTimeline(academic)
  const events = allEvents.filter((e) => visibleTypes.includes(e.type))

  // Group events by year
  const groupedEvents: Record<string, TimelineEvent[]> = {}
  events.forEach((event) => {
    const key = event.year?.toString() || 'Atual'
    if (!groupedEvents[key]) groupedEvents[key] = []
    groupedEvents[key].push(event)
  })

  const years = Object.keys(groupedEvents).sort((a, b) => {
    if (a === 'Atual') return -1
    if (b === 'Atual') return 1
    return parseInt(b) - parseInt(a)
  })

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="shadow-sm border border-default-100">
        <CardBody className="p-5">
          <CheckboxGroup
            label="Mostrar eventos"
            orientation="horizontal"
            value={visibleTypes}
            onValueChange={setVisibleTypes}
            classNames={{ label: 'text-sm font-medium text-default-700 mb-3' }}
          >
            <Checkbox value="degree" classNames={{ label: 'text-sm' }}>
              <span className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-secondary-500" /> Formação
              </span>
            </Checkbox>
            <Checkbox value="dissertation" classNames={{ label: 'text-sm' }}>
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-500" /> Dissertações
              </span>
            </Checkbox>
            <Checkbox value="employment" classNames={{ label: 'text-sm' }}>
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-success-500" /> Emprego
              </span>
            </Checkbox>
          </CheckboxGroup>
        </CardBody>
      </Card>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="text-center py-16 text-default-500">
          Nenhum evento para exibir. Tente selecionar mais tipos de evento.
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-default-200" />

          {years.map((year, yearIndex) => (
            <div key={year} className="mb-8">
              {/* Year marker */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-9 h-9 rounded-full bg-default-100 flex items-center justify-center z-10 shadow-sm">
                  <span className="text-sm font-bold text-default-600">{year}</span>
                </div>
                <div className="h-px flex-1 bg-default-200" />
              </div>

              {/* Events for this year */}
              <div className="space-y-4 ml-14">
                {groupedEvents[year].map((event, eventIndex) => {
                  const Icon = eventIcons[event.type]
                  const color = eventColors[event.type]

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: yearIndex * 0.1 + eventIndex * 0.05 }}
                    >
                      <Card className="shadow-sm border border-default-100">
                        <CardBody className="flex-row gap-4 items-start p-4">
                          <div className={`p-2.5 rounded-lg ${eventBgClasses[event.type]}`}>
                            <Icon className={`w-5 h-5 ${eventIconClasses[event.type]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium line-clamp-2 text-base">{event.title}</h4>
                            <p className="text-sm text-default-500 mt-1">{event.subtitle}</p>
                            {event.details && (
                              <p className="text-sm text-default-400 mt-2">{event.details}</p>
                            )}
                          </div>
                          <Chip variant="flat" color={color} classNames={{ base: 'px-3 py-1', content: 'text-sm' }}>
                            {event.type === 'degree' && 'Formação'}
                            {event.type === 'dissertation' && 'Dissertação'}
                            {event.type === 'employment' && 'Emprego'}
                            {event.type === 'award' && 'Prêmio'}
                          </Chip>
                        </CardBody>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
