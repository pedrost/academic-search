'use client'

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

const eventAccent = {
  degree: { dot: 'bg-violet-400', icon: 'text-violet-400', bg: 'bg-violet-500/15', label: 'Formação' },
  dissertation: { dot: 'bg-cyan-400', icon: 'text-cyan-400', bg: 'bg-cyan-500/15', label: 'Dissertação' },
  employment: { dot: 'bg-green-400', icon: 'text-green-400', bg: 'bg-green-500/15', label: 'Emprego' },
  award: { dot: 'bg-yellow-400', icon: 'text-yellow-400', bg: 'bg-yellow-500/15', label: 'Prêmio' },
}

function buildTimeline(academic: AcademicWithDissertations): TimelineEvent[] {
  const events: TimelineEvent[] = []

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

  const grokData = academic.grokMetadata as Record<string, unknown> | null
  if (grokData?.employmentHistory && Array.isArray(grokData.employmentHistory)) {
    const employmentHistory = grokData.employmentHistory as Array<{
      year?: number; jobTitle?: string; company?: string; location?: string
    }>
    employmentHistory.forEach((job, i) => {
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

  if (academic.currentJobTitle && !grokData?.employmentHistory) {
    events.push({
      id: 'current-job',
      type: 'employment',
      year: null,
      title: academic.currentJobTitle,
      subtitle: academic.currentCompany || 'Empresa não informada',
      details: [academic.currentCity, academic.currentState].filter(Boolean).join(', '),
    })
  }

  return events.sort((a, b) => {
    if (a.year === null && b.year === null) return 0
    if (a.year === null) return -1
    if (b.year === null) return 1
    return b.year - a.year
  })
}

export function TimelineTab({ academic }: Props) {
  const [visibleTypes, setVisibleTypes] = useState<string[]>([
    'degree', 'dissertation', 'employment', 'award',
  ])

  const allEvents = buildTimeline(academic)
  const events = allEvents.filter((e) => visibleTypes.includes(e.type))

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

  const toggleType = (type: string) => {
    setVisibleTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-[#1a1b26] border border-white/8 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Mostrar eventos</p>
        <div className="flex flex-wrap gap-2">
          {(['degree', 'dissertation', 'employment', 'award'] as const).map((type) => {
            const accent = eventAccent[type]
            const Icon = eventIcons[type]
            const active = visibleTypes.includes(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active ? `${accent.bg} ${accent.icon}` : 'bg-white/5 text-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {accent.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          Nenhum evento para exibir.
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-white/8" />

          {years.map((year, yearIndex) => (
            <div key={year} className="mb-8">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg bg-[#1a1b26] border border-white/10 flex items-center justify-center z-10">
                  <span className="text-sm font-bold text-gray-400 font-mono">{year}</span>
                </div>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              <div className="space-y-3 ml-14">
                {groupedEvents[year].map((event, eventIndex) => {
                  const Icon = eventIcons[event.type]
                  const accent = eventAccent[event.type]

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: yearIndex * 0.1 + eventIndex * 0.05 }}
                    >
                      <div className="bg-[#1a1b26] border border-white/8 rounded-xl p-4 flex gap-4 items-start">
                        <div className={`p-2 rounded-lg ${accent.bg}`}>
                          <Icon className={`w-4 h-4 ${accent.icon}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium line-clamp-2 text-sm text-gray-200">{event.title}</h4>
                          <p className="text-sm text-gray-500 mt-1">{event.subtitle}</p>
                          {event.details && (
                            <p className="text-sm text-gray-600 mt-1">{event.details}</p>
                          )}
                        </div>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-mono ${accent.bg} ${accent.icon}`}>
                          {accent.label}
                        </span>
                      </div>
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
