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

function buildTimeline(academic: AcademicWithDissertations): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Degree completion
  if (academic.graduationYear && academic.degreeLevel) {
    events.push({
      id: 'degree-' + academic.id,
      type: 'degree',
      year: academic.graduationYear,
      title: DEGREE_LEVEL_LABELS[academic.degreeLevel],
      subtitle: academic.institution || 'Instituicao nao informada',
      details: academic.researchField,
    })
  }

  // Dissertations
  academic.dissertations.forEach((diss) => {
    events.push({
      id: 'diss-' + diss.id,
      type: 'dissertation',
      year: diss.defenseYear,
      title: diss.title,
      subtitle: `${diss.institution} · ${diss.program || 'Programa nao informado'}`,
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
        title: job.jobTitle || 'Cargo nao informado',
        subtitle: job.company || 'Empresa nao informada',
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
      subtitle: academic.currentCompany || 'Empresa nao informada',
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
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardBody>
          <CheckboxGroup
            label="Mostrar eventos"
            orientation="horizontal"
            value={visibleTypes}
            onValueChange={setVisibleTypes}
          >
            <Checkbox value="degree" size="sm">
              <span className="flex items-center gap-1">
                <GraduationCap className="w-4 h-4 text-secondary-500" /> Formacao
              </span>
            </Checkbox>
            <Checkbox value="dissertation" size="sm">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4 text-primary-500" /> Dissertacoes
              </span>
            </Checkbox>
            <Checkbox value="employment" size="sm">
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4 text-success-500" /> Emprego
              </span>
            </Checkbox>
          </CheckboxGroup>
        </CardBody>
      </Card>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="text-center py-12 text-default-500">
          Nenhum evento para exibir. Tente selecionar mais tipos de evento.
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-default-200" />

          {years.map((year, yearIndex) => (
            <div key={year} className="mb-6">
              {/* Year marker */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center z-10">
                  <span className="text-xs font-bold text-default-600">{year}</span>
                </div>
                <div className="h-px flex-1 bg-default-200" />
              </div>

              {/* Events for this year */}
              <div className="space-y-3 ml-12">
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
                      <Card>
                        <CardBody className="flex-row gap-3 items-start">
                          <div className={`p-2 rounded-lg bg-${color}-100`}>
                            <Icon className={`w-5 h-5 text-${color}-600`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium line-clamp-2">{event.title}</h4>
                            <p className="text-sm text-default-500">{event.subtitle}</p>
                            {event.details && (
                              <p className="text-xs text-default-400 mt-1">{event.details}</p>
                            )}
                          </div>
                          <Chip size="sm" variant="flat" color={color}>
                            {event.type === 'degree' && 'Formacao'}
                            {event.type === 'dissertation' && 'Dissertacao'}
                            {event.type === 'employment' && 'Emprego'}
                            {event.type === 'award' && 'Premio'}
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
