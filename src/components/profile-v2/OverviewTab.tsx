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

type GrokMetadata = {
  sources?: Array<{ url: string; title: string; context: string }>
  employment?: { confidence: 'high' | 'medium' | 'low'; context: string | null }
  social?: { twitterHandle?: string | null; personalWebsite?: string | null }
  professional?: {
    recentPublications: string[]
    researchProjects: string[]
    conferences: string[]
    awards: string[]
  }
  findings?: { summary: string; confidence: 'high' | 'medium' | 'low' }
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Education Card */}
      <Card>
        <CardBody className="gap-4">
          <div className="flex items-center gap-2 text-primary-600">
            <GraduationCap className="w-5 h-5" />
            <h3 className="font-semibold">Formação</h3>
          </div>
          <dl className="space-y-3 text-sm">
            {academic.degreeLevel && (
              <div>
                <dt className="text-default-500">Nível</dt>
                <dd className="font-medium">{DEGREE_LEVEL_LABELS[academic.degreeLevel]}</dd>
              </div>
            )}
            {academic.institution && (
              <div>
                <dt className="text-default-500">Instituição</dt>
                <dd className="font-medium">{academic.institution}</dd>
              </div>
            )}
            {academic.graduationYear && (
              <div>
                <dt className="text-default-500">Ano de Conclusão</dt>
                <dd className="font-medium">{academic.graduationYear}</dd>
              </div>
            )}
            {academic.researchField && (
              <div>
                <dt className="text-default-500">Área de Pesquisa</dt>
                <dd>
                  <Chip size="sm" variant="flat" color="primary">
                    {academic.researchField}
                  </Chip>
                </dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Employment Card */}
      <Card>
        <CardBody className="gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-success-600">
              <Building2 className="w-5 h-5" />
              <h3 className="font-semibold">Situação Atual</h3>
            </div>
            {hasLinkedIn && (
              <Tooltip content="Dados do LinkedIn">
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  startContent={<Linkedin className="w-3 h-3" />}
                >
                  LinkedIn
                </Chip>
              </Tooltip>
            )}
          </div>
          <dl className="space-y-3 text-sm">
            {academic.currentJobTitle && (
              <div>
                <dt className="text-default-500">Cargo</dt>
                <dd className="font-medium">{academic.currentJobTitle}</dd>
              </div>
            )}
            {academic.currentCompany && (
              <div>
                <dt className="text-default-500">Empresa/Instituição</dt>
                <dd className="font-medium">{academic.currentCompany}</dd>
              </div>
            )}
            {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
              <div>
                <dt className="text-default-500">Setor</dt>
                <dd>
                  <Chip size="sm" variant="flat" color="success">
                    {SECTOR_LABELS[academic.currentSector]}
                  </Chip>
                </dd>
              </div>
            )}
            {(academic.currentCity || academic.currentState) && (
              <div>
                <dt className="text-default-500">Localização</dt>
                <dd className="font-medium">
                  {[academic.currentCity, academic.currentState].filter(Boolean).join(', ')}
                </dd>
              </div>
            )}
            {grokData?.employment?.confidence && (
              <div>
                <dt className="text-default-500">Confiança</dt>
                <dd>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={confidenceColors[grokData.employment.confidence]}
                    startContent={<CheckCircle2 className="w-3 h-3" />}
                  >
                    {grokData.employment.confidence === 'high' && 'Alta'}
                    {grokData.employment.confidence === 'medium' && 'Média'}
                    {grokData.employment.confidence === 'low' && 'Baixa'}
                  </Chip>
                </dd>
              </div>
            )}
          </dl>
          {!academic.currentJobTitle && !academic.currentCompany && (
            <p className="text-default-400 text-sm italic">
              Dados de emprego não disponíveis
            </p>
          )}
        </CardBody>
      </Card>

      {/* Professional Highlights Card (from enrichment) */}
      {grokData?.professional && (
        <Card className="md:col-span-2">
          <CardBody className="gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-warning-600">
                <Award className="w-5 h-5" />
                <h3 className="font-semibold">Destaques Profissionais</h3>
              </div>
              {hasEnrichment && (
                <Chip size="sm" variant="flat" color="secondary">
                  Enriquecido
                </Chip>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grokData.professional.recentPublications.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-default-600 mb-2">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">Publicações Recentes</span>
                  </div>
                  <ul className="space-y-1">
                    {grokData.professional.recentPublications.slice(0, 3).map((pub, i) => (
                      <li key={i} className="text-sm text-default-500 line-clamp-2">
                        • {pub}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {grokData.professional.awards.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-default-600 mb-2">
                    <Award className="w-4 h-4" />
                    <span className="text-sm font-medium">Prêmios</span>
                  </div>
                  <ul className="space-y-1">
                    {grokData.professional.awards.slice(0, 3).map((award, i) => (
                      <li key={i} className="text-sm text-default-500 line-clamp-2">
                        • {award}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {grokData.professional.researchProjects.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-default-600 mb-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Projetos de Pesquisa</span>
                  </div>
                  <ul className="space-y-1">
                    {grokData.professional.researchProjects.slice(0, 3).map((proj, i) => (
                      <li key={i} className="text-sm text-default-500 line-clamp-2">
                        • {proj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {grokData.professional.conferences.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-default-600 mb-2">
                    <Globe className="w-4 h-4" />
                    <span className="text-sm font-medium">Conferências</span>
                  </div>
                  <ul className="space-y-1">
                    {grokData.professional.conferences.slice(0, 3).map((conf, i) => (
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
        <Card className="md:col-span-2">
          <CardBody className="gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-default-700">Resumo do Perfil</h3>
              <Chip
                size="sm"
                variant="flat"
                color={confidenceColors[grokData.findings.confidence]}
              >
                Confiança {grokData.findings.confidence === 'high' ? 'Alta' : grokData.findings.confidence === 'medium' ? 'Média' : 'Baixa'}
              </Chip>
            </div>
            <p className="text-sm text-default-600">{grokData.findings.summary}</p>
          </CardBody>
        </Card>
      )}

      {/* Latest Dissertation Card */}
      {firstDissertation && (
        <Card className="md:col-span-2">
          <CardBody className="gap-4">
            <div className="flex items-center gap-2 text-violet-600">
              <BookOpen className="w-5 h-5" />
              <h3 className="font-semibold">Última Dissertação/Tese</h3>
            </div>
            <div>
              <h4 className="font-medium text-lg">{firstDissertation.title}</h4>
              <p className="text-sm text-default-500 mt-1">
                {firstDissertation.institution} · {firstDissertation.defenseYear}
                {firstDissertation.program && ` · ${firstDissertation.program}`}
              </p>
              {firstDissertation.advisorName && (
                <p className="text-sm mt-2">
                  <span className="text-default-500">Orientador:</span> {firstDissertation.advisorName}
                </p>
              )}
              {firstDissertation.abstract && (
                <p className="text-sm text-default-600 mt-3 line-clamp-4">
                  {firstDissertation.abstract}
                </p>
              )}
              {firstDissertation.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {firstDissertation.keywords.map((kw, i) => (
                    <Chip key={i} size="sm" variant="bordered">
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
