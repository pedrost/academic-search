'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'
import { Sparkles } from 'lucide-react'

async function fetchAcademic(id: string): Promise<AcademicWithDissertations> {
  const res = await fetch(`/api/academics/${id}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

async function enrichWithGrok(academicId: string) {
  const res = await fetch(`/api/search-academic?academicId=${academicId}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to enrich')
  }
  return res.json()
}

export default function AcademicDetailPage() {
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const { data: academic, isLoading, error } = useQuery({
    queryKey: ['academic', id],
    queryFn: () => fetchAcademic(id),
  })

  const enrichMutation = useMutation({
    mutationFn: () => enrichWithGrok(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic', id] })
    }
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !academic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Acadêmico não encontrado</p>
        <Link href="/">
          <Button variant="outline">Voltar à busca</Button>
        </Link>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 max-w-4xl">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Voltar à busca
        </Link>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{academic.name}</CardTitle>
                {academic.researchField && (
                  <p className="text-muted-foreground mt-1">
                    {academic.researchField}
                  </p>
                )}
              </div>
              <div className="flex gap-2 items-start">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {academic.degreeLevel && (
                      <Badge variant="secondary">
                        {DEGREE_LEVEL_LABELS[academic.degreeLevel]}
                      </Badge>
                    )}
                    {academic.enrichmentStatus && (
                      <Badge
                        variant={
                          academic.enrichmentStatus === 'COMPLETE'
                            ? 'default'
                            : 'outline'
                        }
                      >
                        {academic.enrichmentStatus === 'COMPLETE'
                          ? 'Dados completos'
                          : 'Dados parciais'}
                      </Badge>
                    )}
                  </div>
                  <Button
                    onClick={() => enrichMutation.mutate()}
                    disabled={enrichMutation.isPending}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {enrichMutation.isPending ? 'Enriquecendo...' : 'Enriquecer com Grok'}
                  </Button>
                  {enrichMutation.isError && (
                    <p className="text-xs text-red-600">
                      Erro ao enriquecer dados
                    </p>
                  )}
                  {enrichMutation.isSuccess && (
                    <p className="text-xs text-green-600">
                      Dados atualizados!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <section className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Formação</h3>
                <dl className="space-y-1 text-sm">
                  {academic.institution && (
                    <>
                      <dt className="text-muted-foreground">Instituição</dt>
                      <dd>{academic.institution}</dd>
                    </>
                  )}
                  {academic.graduationYear && (
                    <>
                      <dt className="text-muted-foreground">Ano de conclusão</dt>
                      <dd>{academic.graduationYear}</dd>
                    </>
                  )}
                </dl>
              </div>

              <div>
                <h3 className="font-medium mb-2">Situação Atual</h3>
                <dl className="space-y-1 text-sm">
                  {academic.currentJobTitle && (
                    <>
                      <dt className="text-muted-foreground">Cargo</dt>
                      <dd>
                        {academic.currentJobTitle}
                        {academic.currentCompany &&
                          ` @ ${academic.currentCompany}`}
                      </dd>
                    </>
                  )}
                  {academic.currentSector &&
                    academic.currentSector !== 'UNKNOWN' && (
                      <>
                        <dt className="text-muted-foreground">Setor</dt>
                        <dd>{SECTOR_LABELS[academic.currentSector]}</dd>
                      </>
                    )}
                  {(academic.currentCity || academic.currentState) && (
                    <>
                      <dt className="text-muted-foreground">Localização</dt>
                      <dd>
                        {[academic.currentCity, academic.currentState]
                          .filter(Boolean)
                          .join(', ')}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            </section>

            <section>
              <h3 className="font-medium mb-2">Links</h3>
              <div className="flex gap-4">
                {academic.linkedinUrl && (
                  <a
                    href={academic.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    LinkedIn →
                  </a>
                )}
                {academic.lattesUrl && (
                  <a
                    href={academic.lattesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Lattes →
                  </a>
                )}
              </div>
            </section>

            {academic.dissertations.length > 0 && (
              <section>
                <h3 className="font-medium mb-4">Dissertações / Teses</h3>
                <div className="space-y-4">
                  {academic.dissertations.map((diss) => (
                    <Card key={diss.id}>
                      <CardContent className="pt-4">
                        <h4 className="font-medium">{diss.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {diss.institution} • {diss.defenseYear}
                          {diss.program && ` • ${diss.program}`}
                        </p>
                        {diss.advisorName && (
                          <p className="text-sm mt-1">
                            Orientador: {diss.advisorName}
                          </p>
                        )}
                        {diss.abstract && (
                          <p className="text-sm mt-2 text-muted-foreground">
                            {diss.abstract.substring(0, 300)}
                            {diss.abstract.length > 300 && '...'}
                          </p>
                        )}
                        {diss.keywords.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {diss.keywords.map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {diss.sourceUrl && (
                          <a
                            href={diss.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                          >
                            Ver no Sucupira →
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
