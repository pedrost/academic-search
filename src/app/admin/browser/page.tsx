'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

async function getSessionStatus() {
  const res = await fetch('/api/admin/linkedin/session')
  return res.json()
}

async function sessionAction(action: string) {
  const res = await fetch('/api/admin/linkedin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  return res.json()
}

export default function BrowserPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: status } = useQuery({
    queryKey: ['linkedin-session'],
    queryFn: getSessionStatus,
    refetchInterval: 5000,
  })

  const startMutation = useMutation({
    mutationFn: () => sessionAction('start'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-session'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => sessionAction('stop'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-session'] })
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Controle do Browser LinkedIn</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Status da Sessão
            <Badge variant={status?.isLoggedIn ? 'default' : 'outline'}>
              {status?.isLoggedIn ? 'Logado' : 'Não logado'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A sessão do LinkedIn roda em background. Após iniciar, você precisará
            fazer login manualmente na janela do Playwright que abrirá.
          </p>

          <div className="flex gap-4">
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? 'Iniciando...' : 'Iniciar Sessão'}
            </Button>
            <Button
              variant="outline"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              {stopMutation.isPending ? 'Fechando...' : 'Fechar Sessão'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instruções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Clique em "Iniciar Sessão" para abrir o browser</li>
            <li>Uma janela do Chromium abrirá em segundo plano</li>
            <li>
              Faça login na sua conta do LinkedIn manualmente na janela do browser
            </li>
            <li>Após logado, o status acima mudará para "Logado"</li>
            <li>
              O sistema agora pode buscar e enriquecer perfis automaticamente
            </li>
          </ol>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-sm text-yellow-800">
              <strong>Importante:</strong> Navegue devagar e naturalmente para
              evitar detecção. O sistema adiciona delays automáticos, mas evite
              ações muito rápidas.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Busca Manual (Debug)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Nome do acadêmico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="outline" disabled={!status?.isLoggedIn}>
              Buscar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use isso para testar buscas manualmente. Em produção, o sistema busca
            automaticamente os acadêmicos pendentes de enriquecimento.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
