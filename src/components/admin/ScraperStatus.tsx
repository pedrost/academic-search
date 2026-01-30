'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScraperSession } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'
import { MS_INSTITUTIONS } from '@/lib/constants'

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  RUNNING: 'default',
  PAUSED: 'secondary',
  WAITING_INTERVENTION: 'outline',
  COMPLETED: 'secondary',
  FAILED: 'destructive',
}

const SOURCE_LABELS: Record<string, string> = {
  SUCUPIRA: 'Sucupira',
  LATTES: 'Lattes',
  LINKEDIN: 'LinkedIn',
}

type ScrapersResponse = {
  active: ScraperSession[]
  recent: ScraperSession[]
}

async function fetchScrapers(): Promise<ScrapersResponse> {
  const res = await fetch('/api/admin/scrapers')
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export function ScraperStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-scrapers'],
    queryFn: fetchScrapers,
    refetchInterval: 5000,
  })

  const [selectedInstitution, setSelectedInstitution] = useState<string>(MS_INSTITUTIONS[0])
  const [isStarting, setIsStarting] = useState(false)

  const startScraper = async () => {
    setIsStarting(true)
    try {
      await fetch('/api/admin/scrapers/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'SUCUPIRA',
          institution: selectedInstitution,
        }),
      })
    } catch (err) {
      console.error('Failed to start scraper:', err)
    } finally {
      setIsStarting(false)
    }
  }

  if (isLoading) {
    return <div>Carregando...</div>
  }

  const { active, recent } = data || { active: [], recent: [] }

  return (
    <div className="space-y-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Iniciar Scraper</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Instituição
              </label>
              <Select
                value={selectedInstitution}
                onValueChange={setSelectedInstitution}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MS_INSTITUTIONS.map((inst) => (
                    <SelectItem key={inst} value={inst}>
                      {inst}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={startScraper} disabled={isStarting}>
              {isStarting ? 'Iniciando...' : 'Iniciar Sucupira'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scrapers Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum scraper ativo no momento
            </p>
          ) : (
            <div className="space-y-4">
              {active.map((scraper) => (
                <div
                  key={scraper.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {SOURCE_LABELS[scraper.source]}
                      </span>
                      <Badge variant={STATUS_VARIANTS[scraper.status]}>
                        {scraper.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {scraper.profilesScraped} perfis • {scraper.tasksCreated}{' '}
                      tarefas • {scraper.errors} erros
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Última atividade:{' '}
                    {formatDistanceToNow(new Date(scraper.lastActivityAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessões Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma sessão registrada
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((scraper) => (
                <div
                  key={scraper.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {SOURCE_LABELS[scraper.source]}
                    </span>
                    <Badge variant={STATUS_VARIANTS[scraper.status]} className="text-xs">
                      {scraper.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {scraper.profilesScraped} perfis
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
