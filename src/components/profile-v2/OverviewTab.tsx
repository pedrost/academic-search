'use client'

import { Card, CardBody, Chip } from '@nextui-org/react'
import { GraduationCap, Building2, Calendar, BookOpen } from 'lucide-react'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'

type Props = {
  academic: AcademicWithDissertations
}

export function OverviewTab({ academic }: Props) {
  const firstDissertation = academic.dissertations[0]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Education Card */}
      <Card>
        <CardBody className="gap-4">
          <div className="flex items-center gap-2 text-primary-600">
            <GraduationCap className="w-5 h-5" />
            <h3 className="font-semibold">Formacao</h3>
          </div>
          <dl className="space-y-3 text-sm">
            {academic.degreeLevel && (
              <div>
                <dt className="text-default-500">Nivel</dt>
                <dd className="font-medium">{DEGREE_LEVEL_LABELS[academic.degreeLevel]}</dd>
              </div>
            )}
            {academic.institution && (
              <div>
                <dt className="text-default-500">Instituicao</dt>
                <dd className="font-medium">{academic.institution}</dd>
              </div>
            )}
            {academic.graduationYear && (
              <div>
                <dt className="text-default-500">Ano de Conclusao</dt>
                <dd className="font-medium">{academic.graduationYear}</dd>
              </div>
            )}
            {academic.researchField && (
              <div>
                <dt className="text-default-500">Area de Pesquisa</dt>
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
          <div className="flex items-center gap-2 text-success-600">
            <Building2 className="w-5 h-5" />
            <h3 className="font-semibold">Situacao Atual</h3>
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
                <dt className="text-default-500">Empresa/Instituicao</dt>
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
                <dt className="text-default-500">Localizacao</dt>
                <dd className="font-medium">
                  {[academic.currentCity, academic.currentState].filter(Boolean).join(', ')}
                </dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Latest Dissertation Card */}
      {firstDissertation && (
        <Card className="md:col-span-2">
          <CardBody className="gap-4">
            <div className="flex items-center gap-2 text-violet-600">
              <BookOpen className="w-5 h-5" />
              <h3 className="font-semibold">Ultima Dissertacao/Tese</h3>
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
