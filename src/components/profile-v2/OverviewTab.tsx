'use client'

import { Chip, Tooltip } from '@nextui-org/react'
import {
  GraduationCap,
  Building2,
  BookOpen,
  Linkedin,
  Award,
  Users,
  FileText,
  Globe,
  CheckCircle2,
} from 'lucide-react'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
}

type LinkedInJob = {
  jobTitle: string
  company: string
  startDate: string
  endDate: string | null
  location: string | null
  isCurrent: boolean
}

type LinkedInEducation = {
  degree: string
  fieldOfStudy: string | null
  institution: string
  startYear: number | null
  endYear: number | null
}

type GrokMetadata = {
  sources?: Array<{ url: string; title: string; context: string }>
  employment?: { confidence: 'high' | 'medium' | 'low'; context: string | null }
  social?: { twitterHandle?: string | null; personalWebsite?: string | null }
  professional?: {
    recentPublications?: string[]
    researchProjects?: string[]
    conferences?: string[]
    awards?: string[]
    summary?: string | null
    expertise?: string[]
  }
  findings?: { summary: string; confidence: 'high' | 'medium' | 'low' }
  linkedInProfile?: {
    currentPosition?: {
      jobTitle: string | null
      company: string | null
      location: string | null
      startDate: string | null
    }
    jobHistory?: LinkedInJob[]
    education?: LinkedInEducation[]
    skills?: string[]
    headline?: string | null
    about?: string | null
  }
}

const confidenceColors = {
  high: 'text-green-400 bg-green-500/15',
  medium: 'text-yellow-400 bg-yellow-500/15',
  low: 'text-gray-400 bg-white/5',
} as const

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1a1b26] border border-white/8 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, label, color, right }: { icon: React.ElementType; label: string; color: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <h3 className="font-semibold text-base text-gray-200">{label}</h3>
      </div>
      {right}
    </div>
  )
}

export function OverviewTab({ academic }: Props) {
  const firstDissertation = academic.dissertations[0]
  const grokData = academic.grokMetadata as GrokMetadata | null
  const hasLinkedIn = !!academic.linkedinUrl
  const hasEnrichment = !!academic.grokEnrichedAt
  const linkedInProfile = grokData?.linkedInProfile
  const jobHistory = linkedInProfile?.jobHistory || []
  const education = linkedInProfile?.education || []

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Education Card */}
      <SectionCard>
        <SectionHeader icon={GraduationCap} label="Formação" color="text-violet-400" />
        <dl className="space-y-4 text-sm">
          {academic.degreeLevel && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider mb-1">Nível</dt>
              <dd className="font-medium text-gray-200">{DEGREE_LEVEL_LABELS[academic.degreeLevel]}</dd>
            </div>
          )}
          {academic.institution && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider mb-1">Instituição</dt>
              <dd className="font-medium text-gray-200">{academic.institution}</dd>
            </div>
          )}
          {academic.graduationYear && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider mb-1">Ano de Conclusão</dt>
              <dd className="font-medium text-gray-200 font-mono">{academic.graduationYear}</dd>
            </div>
          )}
          {academic.researchField && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider mb-1">Área de Pesquisa</dt>
              <dd>
                <span className="inline-flex px-2.5 py-1 rounded-md bg-violet-500/15 text-violet-300 text-sm">
                  {academic.researchField}
                </span>
              </dd>
            </div>
          )}
        </dl>
      </SectionCard>

      {/* Employment Card */}
      <SectionCard>
        <SectionHeader
          icon={Building2}
          label="Situação Atual"
          color="text-green-400"
          right={hasLinkedIn ? (
            <Tooltip content="Dados do LinkedIn">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
                <Linkedin className="w-3 h-3" /> LinkedIn
              </span>
            </Tooltip>
          ) : undefined}
        />
        <dl className="space-y-4 text-sm">
          {academic.currentJobTitle && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider mb-1">Cargo</dt>
              <dd className="font-medium text-gray-200">{academic.currentJobTitle}</dd>
            </div>
          )}
          {academic.currentCompany && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider mb-1">Empresa/Instituição</dt>
              <dd className="font-medium text-gray-200">{academic.currentCompany}</dd>
            </div>
          )}
          {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider mb-1">Setor</dt>
              <dd>
                <span className="inline-flex px-2.5 py-1 rounded-md bg-green-500/15 text-green-400 text-sm">
                  {SECTOR_LABELS[academic.currentSector]}
                </span>
              </dd>
            </div>
          )}
          {(academic.currentCity || academic.currentState) && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider mb-1">Localização</dt>
              <dd className="font-medium text-gray-200">
                {[academic.currentCity, academic.currentState].filter(Boolean).join(', ')}
              </dd>
            </div>
          )}
          {grokData?.employment?.confidence && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider mb-1">Confiança</dt>
              <dd>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm ${confidenceColors[grokData.employment.confidence]}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {grokData.employment.confidence === 'high' ? 'Alta' : grokData.employment.confidence === 'medium' ? 'Média' : 'Baixa'}
                </span>
              </dd>
            </div>
          )}
        </dl>
        {!academic.currentJobTitle && !academic.currentCompany && !linkedInProfile?.currentPosition?.jobTitle && (
          <p className="text-gray-600 text-sm italic mt-2">Dados de emprego não disponíveis</p>
        )}
      </SectionCard>

      {/* Career Timeline Card */}
      {jobHistory.length > 0 && (
        <SectionCard className="md:col-span-2">
          <SectionHeader
            icon={Building2}
            label="Histórico Profissional"
            color="text-violet-400"
            right={
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
                <Linkedin className="w-3 h-3" /> LinkedIn
              </span>
            }
          />
          <div className="space-y-4">
            {jobHistory.slice(0, 5).map((job, index) => (
              <div
                key={index}
                className={`relative pl-6 pb-4 ${index < jobHistory.length - 1 && index < 4 ? 'border-l border-white/10' : ''}`}
              >
                <div className={`absolute left-0 top-1 w-2.5 h-2.5 rounded-full -translate-x-[5px] ${job.isCurrent ? 'bg-green-400' : 'bg-gray-600'}`} />
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-gray-200">{job.jobTitle}</span>
                  {job.isCurrent && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/15 text-green-400 font-mono">ATUAL</span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{job.company}</p>
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  {job.startDate} - {job.endDate || 'Presente'}
                  {job.location && ` · ${job.location}`}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Education Timeline Card */}
      {education.length > 0 && (
        <SectionCard className="md:col-span-2">
          <SectionHeader
            icon={GraduationCap}
            label="Formação Acadêmica"
            color="text-cyan-400"
            right={
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
                <Linkedin className="w-3 h-3" /> LinkedIn
              </span>
            }
          />
          <div className="space-y-4">
            {education.map((edu, index) => (
              <div
                key={index}
                className={`relative pl-6 pb-4 ${index < education.length - 1 ? 'border-l border-white/10' : ''}`}
              >
                <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full -translate-x-[5px] bg-cyan-400" />
                <p className="font-medium text-sm text-gray-200">{edu.degree}{edu.fieldOfStudy ? ` em ${edu.fieldOfStudy}` : ''}</p>
                <p className="text-sm text-gray-400">{edu.institution}</p>
                {(edu.startYear || edu.endYear) && (
                  <p className="text-xs text-gray-600 mt-1 font-mono">
                    {edu.startYear || '?'} - {edu.endYear || '?'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Skills Card */}
      {linkedInProfile?.skills && linkedInProfile.skills.length > 0 && (
        <SectionCard className="md:col-span-2">
          <SectionHeader icon={Award} label="Competências" color="text-yellow-400" />
          <div className="flex flex-wrap gap-2">
            {linkedInProfile.skills.slice(0, 15).map((skill, index) => (
              <span key={index} className="px-2.5 py-1 rounded-md bg-white/5 text-gray-300 text-sm border border-white/5">
                {skill}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Professional Highlights Card */}
      {grokData?.professional && (
        <SectionCard className="md:col-span-2">
          <SectionHeader
            icon={Award}
            label="Destaques Profissionais"
            color="text-yellow-400"
            right={hasEnrichment ? (
              <span className="text-xs px-2 py-0.5 rounded bg-violet-500/15 text-violet-400">Enriquecido</span>
            ) : undefined}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(grokData.professional.recentPublications?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-3">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">Publicações Recentes</span>
                </div>
                <ul className="space-y-2">
                  {grokData.professional.recentPublications?.slice(0, 3).map((pub, i) => (
                    <li key={i} className="text-sm text-gray-500 line-clamp-2">· {pub}</li>
                  ))}
                </ul>
              </div>
            )}
            {(grokData.professional.awards?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-3">
                  <Award className="w-4 h-4" />
                  <span className="text-sm font-medium">Prêmios</span>
                </div>
                <ul className="space-y-2">
                  {grokData.professional.awards?.slice(0, 3).map((award, i) => (
                    <li key={i} className="text-sm text-gray-500 line-clamp-2">· {award}</li>
                  ))}
                </ul>
              </div>
            )}
            {(grokData.professional.researchProjects?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-3">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Projetos de Pesquisa</span>
                </div>
                <ul className="space-y-2">
                  {grokData.professional.researchProjects?.slice(0, 3).map((proj, i) => (
                    <li key={i} className="text-sm text-gray-500 line-clamp-2">· {proj}</li>
                  ))}
                </ul>
              </div>
            )}
            {(grokData.professional.conferences?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-3">
                  <Globe className="w-4 h-4" />
                  <span className="text-sm font-medium">Conferências</span>
                </div>
                <ul className="space-y-2">
                  {grokData.professional.conferences?.slice(0, 3).map((conf, i) => (
                    <li key={i} className="text-sm text-gray-500 line-clamp-2">· {conf}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Enrichment Summary */}
      {grokData?.findings?.summary && (
        <SectionCard className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base text-gray-200">Resumo do Perfil</h3>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${confidenceColors[grokData.findings.confidence]}`}>
              Confiança {grokData.findings.confidence === 'high' ? 'Alta' : grokData.findings.confidence === 'medium' ? 'Média' : 'Baixa'}
            </span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">{grokData.findings.summary}</p>
        </SectionCard>
      )}

      {/* Latest Dissertation Card */}
      {firstDissertation && (
        <SectionCard className="md:col-span-2">
          <SectionHeader icon={BookOpen} label="Última Dissertação/Tese" color="text-violet-400" />
          <div>
            <h4 className="font-medium text-lg leading-snug text-gray-200">{firstDissertation.title}</h4>
            <p className="text-sm text-gray-500 mt-2 font-mono">
              {firstDissertation.institution} · {firstDissertation.defenseYear}
              {firstDissertation.program && ` · ${firstDissertation.program}`}
            </p>
            {firstDissertation.advisorName && (
              <p className="text-sm mt-3 text-gray-400">
                <span className="text-gray-500">Orientador:</span> {firstDissertation.advisorName}
              </p>
            )}
            {firstDissertation.abstract && (
              <p className="text-sm text-gray-500 mt-4 line-clamp-4 leading-relaxed">
                {firstDissertation.abstract}
              </p>
            )}
            {(firstDissertation.keywords as string[]).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {(firstDissertation.keywords as string[]).map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 rounded border border-white/10 text-gray-400 text-sm">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
