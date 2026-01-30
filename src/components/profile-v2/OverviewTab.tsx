'use client'

import { Card, CardBody, Chip, Tooltip } from '@nextui-org/react'
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
  high: 'success',
  medium: 'warning',
  low: 'default',
} as const

export function OverviewTab({ academic }: Props) {
  const firstDissertation = academic.dissertations[0]
  const grokData = academic.grokMetadata as GrokMetadata | null
  const hasLinkedIn = !!academic.linkedinUrl
  const hasEnrichment = !!academic.grokEnrichedAt
  const linkedInProfile = grokData?.linkedInProfile
  const jobHistory = linkedInProfile?.jobHistory || []
  const education = linkedInProfile?.education || []

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Education Card */}
      <Card className="shadow-sm border border-default-100">
        <CardBody className="gap-5 p-5">
          <div className="flex items-center gap-3 text-primary-600">
            <GraduationCap className="w-5 h-5" />
            <h3 className="font-semibold text-base">Formação</h3>
          </div>
          <dl className="space-y-4 text-sm">
            {academic.degreeLevel && (
              <div>
                <dt className="text-default-500 mb-1">Nível</dt>
                <dd className="font-medium">{DEGREE_LEVEL_LABELS[academic.degreeLevel]}</dd>
              </div>
            )}
            {academic.institution && (
              <div>
                <dt className="text-default-500 mb-1">Instituição</dt>
                <dd className="font-medium">{academic.institution}</dd>
              </div>
            )}
            {academic.graduationYear && (
              <div>
                <dt className="text-default-500 mb-1">Ano de Conclusão</dt>
                <dd className="font-medium">{academic.graduationYear}</dd>
              </div>
            )}
            {academic.researchField && (
              <div>
                <dt className="text-default-500 mb-1">Área de Pesquisa</dt>
                <dd>
                  <Chip variant="flat" color="primary" classNames={{ base: 'px-3 py-1', content: 'text-sm' }}>
                    {academic.researchField}
                  </Chip>
                </dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Employment Card */}
      <Card className="shadow-sm border border-default-100">
        <CardBody className="gap-5 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-success-600">
              <Building2 className="w-5 h-5" />
              <h3 className="font-semibold text-base">Situação Atual</h3>
            </div>
            {hasLinkedIn && (
              <Tooltip content="Dados do LinkedIn">
                <Chip
                  variant="flat"
                  color="primary"
                  startContent={<Linkedin className="w-3.5 h-3.5" />}
                  classNames={{ base: 'px-3 py-1 gap-1.5', content: 'text-sm' }}
                >
                  LinkedIn
                </Chip>
              </Tooltip>
            )}
          </div>
          <dl className="space-y-4 text-sm">
            {academic.currentJobTitle && (
              <div>
                <dt className="text-default-500 mb-1">Cargo</dt>
                <dd className="font-medium">{academic.currentJobTitle}</dd>
              </div>
            )}
            {academic.currentCompany && (
              <div>
                <dt className="text-default-500 mb-1">Empresa/Instituição</dt>
                <dd className="font-medium">{academic.currentCompany}</dd>
              </div>
            )}
            {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
              <div>
                <dt className="text-default-500 mb-1">Setor</dt>
                <dd>
                  <Chip variant="flat" color="success" classNames={{ base: 'px-3 py-1', content: 'text-sm' }}>
                    {SECTOR_LABELS[academic.currentSector]}
                  </Chip>
                </dd>
              </div>
            )}
            {(academic.currentCity || academic.currentState) && (
              <div>
                <dt className="text-default-500 mb-1">Localização</dt>
                <dd className="font-medium">
                  {[academic.currentCity, academic.currentState].filter(Boolean).join(', ')}
                </dd>
              </div>
            )}
            {grokData?.employment?.confidence && (
              <div>
                <dt className="text-default-500 mb-1">Confiança</dt>
                <dd>
                  <Chip
                    variant="flat"
                    color={confidenceColors[grokData.employment.confidence]}
                    startContent={<CheckCircle2 className="w-3.5 h-3.5" />}
                    classNames={{ base: 'px-3 py-1 gap-1.5', content: 'text-sm' }}
                  >
                    {grokData.employment.confidence === 'high' && 'Alta'}
                    {grokData.employment.confidence === 'medium' && 'Média'}
                    {grokData.employment.confidence === 'low' && 'Baixa'}
                  </Chip>
                </dd>
              </div>
            )}
          </dl>
          {!academic.currentJobTitle && !academic.currentCompany && !linkedInProfile?.currentPosition?.jobTitle && (
            <p className="text-default-400 text-sm italic">
              Dados de emprego não disponíveis
            </p>
          )}
        </CardBody>
      </Card>

      {/* Career Timeline Card (from LinkedIn) */}
      {jobHistory.length > 0 && (
        <Card className="md:col-span-2 shadow-sm border border-default-100">
          <CardBody className="gap-5 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-primary-600">
                <Building2 className="w-5 h-5" />
                <h3 className="font-semibold text-base">Histórico Profissional</h3>
              </div>
              <Chip
                variant="flat"
                color="primary"
                startContent={<Linkedin className="w-3.5 h-3.5" />}
                classNames={{ base: 'px-3 py-1 gap-1.5', content: 'text-sm' }}
              >
                LinkedIn
              </Chip>
            </div>
            <div className="space-y-4">
              {jobHistory.slice(0, 5).map((job, index) => (
                <div
                  key={index}
                  className={`relative pl-6 pb-4 ${index < jobHistory.length - 1 && index < 4 ? 'border-l-2 border-default-200' : ''}`}
                >
                  <div className={`absolute left-0 top-0 w-3 h-3 rounded-full -translate-x-[5px] ${job.isCurrent ? 'bg-success-500' : 'bg-default-300'}`} />
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{job.jobTitle}</span>
                    {job.isCurrent && (
                      <Chip size="sm" variant="flat" color="success" classNames={{ base: 'h-5', content: 'text-xs' }}>
                        Atual
                      </Chip>
                    )}
                  </div>
                  <p className="text-sm text-default-600">{job.company}</p>
                  <p className="text-xs text-default-400 mt-1">
                    {job.startDate} - {job.endDate || 'Presente'}
                    {job.location && ` · ${job.location}`}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Education Timeline Card (from LinkedIn) */}
      {education.length > 0 && (
        <Card className="md:col-span-2 shadow-sm border border-default-100">
          <CardBody className="gap-5 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-violet-600">
                <GraduationCap className="w-5 h-5" />
                <h3 className="font-semibold text-base">Formação Acadêmica</h3>
              </div>
              <Chip
                variant="flat"
                color="primary"
                startContent={<Linkedin className="w-3.5 h-3.5" />}
                classNames={{ base: 'px-3 py-1 gap-1.5', content: 'text-sm' }}
              >
                LinkedIn
              </Chip>
            </div>
            <div className="space-y-4">
              {education.map((edu, index) => (
                <div
                  key={index}
                  className={`relative pl-6 pb-4 ${index < education.length - 1 ? 'border-l-2 border-default-200' : ''}`}
                >
                  <div className="absolute left-0 top-0 w-3 h-3 rounded-full -translate-x-[5px] bg-violet-400" />
                  <p className="font-medium text-sm">{edu.degree}{edu.fieldOfStudy ? ` em ${edu.fieldOfStudy}` : ''}</p>
                  <p className="text-sm text-default-600">{edu.institution}</p>
                  {(edu.startYear || edu.endYear) && (
                    <p className="text-xs text-default-400 mt-1">
                      {edu.startYear || '?'} - {edu.endYear || '?'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Skills Card (from LinkedIn) */}
      {linkedInProfile?.skills && linkedInProfile.skills.length > 0 && (
        <Card className="md:col-span-2 shadow-sm border border-default-100">
          <CardBody className="gap-4 p-5">
            <div className="flex items-center gap-3 text-warning-600">
              <Award className="w-5 h-5" />
              <h3 className="font-semibold text-base">Competências</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {linkedInProfile.skills.slice(0, 15).map((skill, index) => (
                <Chip key={index} variant="flat" classNames={{ base: 'px-3 py-1', content: 'text-sm' }}>
                  {skill}
                </Chip>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Professional Highlights Card (from enrichment) */}
      {grokData?.professional && (
        <Card className="md:col-span-2 shadow-sm border border-default-100">
          <CardBody className="gap-5 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-warning-600">
                <Award className="w-5 h-5" />
                <h3 className="font-semibold text-base">Destaques Profissionais</h3>
              </div>
              {hasEnrichment && (
                <Chip variant="flat" color="secondary" classNames={{ base: 'px-3 py-1', content: 'text-sm' }}>
                  Enriquecido
                </Chip>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(grokData.professional.recentPublications?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-default-600 mb-3">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">Publicações Recentes</span>
                  </div>
                  <ul className="space-y-2">
                    {grokData.professional.recentPublications?.slice(0, 3).map((pub, i) => (
                      <li key={i} className="text-sm text-default-500 line-clamp-2">
                        • {pub}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(grokData.professional.awards?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-default-600 mb-3">
                    <Award className="w-4 h-4" />
                    <span className="text-sm font-medium">Prêmios</span>
                  </div>
                  <ul className="space-y-2">
                    {grokData.professional.awards?.slice(0, 3).map((award, i) => (
                      <li key={i} className="text-sm text-default-500 line-clamp-2">
                        • {award}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(grokData.professional.researchProjects?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-default-600 mb-3">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Projetos de Pesquisa</span>
                  </div>
                  <ul className="space-y-2">
                    {grokData.professional.researchProjects?.slice(0, 3).map((proj, i) => (
                      <li key={i} className="text-sm text-default-500 line-clamp-2">
                        • {proj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(grokData.professional.conferences?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-default-600 mb-3">
                    <Globe className="w-4 h-4" />
                    <span className="text-sm font-medium">Conferências</span>
                  </div>
                  <ul className="space-y-2">
                    {grokData.professional.conferences?.slice(0, 3).map((conf, i) => (
                      <li key={i} className="text-sm text-default-500 line-clamp-2">
                        • {conf}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Enrichment Summary Card */}
      {grokData?.findings?.summary && (
        <Card className="md:col-span-2 shadow-sm border border-default-100">
          <CardBody className="gap-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-default-700">Resumo do Perfil</h3>
              <Chip
                variant="flat"
                color={confidenceColors[grokData.findings.confidence]}
                classNames={{ base: 'px-3 py-1', content: 'text-sm' }}
              >
                Confiança {grokData.findings.confidence === 'high' ? 'Alta' : grokData.findings.confidence === 'medium' ? 'Média' : 'Baixa'}
              </Chip>
            </div>
            <p className="text-sm text-default-600 leading-relaxed">{grokData.findings.summary}</p>
          </CardBody>
        </Card>
      )}

      {/* Latest Dissertation Card */}
      {firstDissertation && (
        <Card className="md:col-span-2 shadow-sm border border-default-100">
          <CardBody className="gap-5 p-5">
            <div className="flex items-center gap-3 text-violet-600">
              <BookOpen className="w-5 h-5" />
              <h3 className="font-semibold text-base">Última Dissertação/Tese</h3>
            </div>
            <div>
              <h4 className="font-medium text-lg leading-snug">{firstDissertation.title}</h4>
              <p className="text-sm text-default-500 mt-2">
                {firstDissertation.institution} · {firstDissertation.defenseYear}
                {firstDissertation.program && ` · ${firstDissertation.program}`}
              </p>
              {firstDissertation.advisorName && (
                <p className="text-sm mt-3">
                  <span className="text-default-500">Orientador:</span> {firstDissertation.advisorName}
                </p>
              )}
              {firstDissertation.abstract && (
                <p className="text-sm text-default-600 mt-4 line-clamp-4 leading-relaxed">
                  {firstDissertation.abstract}
                </p>
              )}
              {firstDissertation.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {firstDissertation.keywords.map((kw, i) => (
                    <Chip key={i} variant="bordered" classNames={{ base: 'px-2.5 py-1', content: 'text-sm' }}>
                      {kw}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
