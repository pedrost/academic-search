'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, StopCircle, RefreshCw, Trash2 } from 'lucide-react'

type WorkerLog = {
  id: string
  timestamp: number
  worker: 'sucupira' | 'bdtd' | 'ufms' | 'linkedin'
  level: 'info' | 'error' | 'success'
  message: string
}

type WorkerStatus = 'running' | 'paused' | 'stopped'

async function getLogs() {
  const res = await fetch('/api/admin/workers/logs?limit=200')
  return res.json()
}

async function getWorkerStatuses() {
  const res = await fetch('/api/admin/workers/control')
  return res.json()
}

async function controlWorker(worker: string, action: string) {
  const res = await fetch('/api/admin/workers/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worker, action }),
  })
  return res.json()
}

async function triggerWorker(worker: string) {
  const res = await fetch('/api/admin/workers/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worker }),
  })
  return res.json()
}

async function clearLogs() {
  const res = await fetch('/api/admin/workers/logs', {
    method: 'DELETE',
  })
  return res.json()
}

export default function WorkersPage() {
  const queryClient = useQueryClient()
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: logsData } = useQuery({
    queryKey: ['worker-logs'],
    queryFn: getLogs,
    refetchInterval: autoRefresh ? 2000 : false,
  })

  const { data: statuses } = useQuery({
    queryKey: ['worker-statuses'],
    queryFn: getWorkerStatuses,
    refetchInterval: autoRefresh ? 5000 : false,
  })

  const controlMutation = useMutation({
    mutationFn: ({ worker, action }: { worker: string; action: string }) =>
      controlWorker(worker, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-statuses'] })
    },
  })

  const triggerMutation = useMutation({
    mutationFn: (worker: string) => triggerWorker(worker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-logs'] })
    },
  })

  const clearLogsMutation = useMutation({
    mutationFn: clearLogs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-logs'] })
    },
  })

  const logs: WorkerLog[] = logsData?.logs || []

  const getStatusBadge = (status?: WorkerStatus) => {
    if (status === 'running') {
      return <Badge className="bg-green-500">Running</Badge>
    }
    if (status === 'paused') {
      return <Badge className="bg-yellow-500">Paused</Badge>
    }
    return <Badge variant="outline">Stopped</Badge>
  }

  const getLevelColor = (level: string) => {
    if (level === 'error') return 'text-red-600'
    if (level === 'success') return 'text-green-600'
    return 'text-gray-600'
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('pt-BR')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Controle de Workers</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearLogsMutation.mutate()}
            disabled={clearLogsMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {/* Sucupira Worker Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🇧🇷 CAPES (Sucupira)</span>
              {getStatusBadge(statuses?.sucupira)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              API nacional CAPES - Todas universidades do MS
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => controlMutation.mutate({ worker: 'sucupira', action: 'start' })}
                disabled={controlMutation.isPending || statuses?.sucupira === 'running'}
              >
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => controlMutation.mutate({ worker: 'sucupira', action: 'pause' })}
                disabled={controlMutation.isPending || statuses?.sucupira !== 'running'}
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => controlMutation.mutate({ worker: 'sucupira', action: 'stop' })}
                disabled={controlMutation.isPending || statuses?.sucupira === 'stopped'}
              >
                <StopCircle className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </div>
            <div className="pt-2 border-t">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => triggerMutation.mutate('sucupira')}
                disabled={triggerMutation.isPending}
              >
                Executar Agora (Manual)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BDTD Worker Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>📚 BDTD (IBICT)</span>
              {getStatusBadge(statuses?.bdtd)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Biblioteca Digital Brasileira - Busca web
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => controlMutation.mutate({ worker: 'bdtd', action: 'start' })}
                disabled={controlMutation.isPending || statuses?.bdtd === 'running'}
              >
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => controlMutation.mutate({ worker: 'bdtd', action: 'pause' })}
                disabled={controlMutation.isPending || statuses?.bdtd !== 'running'}
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => controlMutation.mutate({ worker: 'bdtd', action: 'stop' })}
                disabled={controlMutation.isPending || statuses?.bdtd === 'stopped'}
              >
                <StopCircle className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </div>
            <div className="pt-2 border-t">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => triggerMutation.mutate('bdtd')}
                disabled={triggerMutation.isPending}
              >
                Executar Agora (Manual)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* UFMS Worker Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🏛️ UFMS Repository</span>
              {getStatusBadge(statuses?.ufms)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Repositório institucional UFMS (DSpace)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => controlMutation.mutate({ worker: 'ufms', action: 'start' })}
                disabled={controlMutation.isPending || statuses?.ufms === 'running'}
              >
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => controlMutation.mutate({ worker: 'ufms', action: 'pause' })}
                disabled={controlMutation.isPending || statuses?.ufms !== 'running'}
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => controlMutation.mutate({ worker: 'ufms', action: 'stop' })}
                disabled={controlMutation.isPending || statuses?.ufms === 'stopped'}
              >
                <StopCircle className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </div>
            <div className="pt-2 border-t">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => triggerMutation.mutate('ufms')}
                disabled={triggerMutation.isPending}
              >
                Executar Agora (Manual)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* LinkedIn Worker Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Worker LinkedIn</span>
              {getStatusBadge(statuses?.linkedin)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enriquece perfis acadêmicos com dados de emprego atual
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => controlMutation.mutate({ worker: 'linkedin', action: 'start' })}
                disabled={controlMutation.isPending || statuses?.linkedin === 'running'}
              >
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => controlMutation.mutate({ worker: 'linkedin', action: 'pause' })}
                disabled={controlMutation.isPending || statuses?.linkedin !== 'running'}
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => controlMutation.mutate({ worker: 'linkedin', action: 'stop' })}
                disabled={controlMutation.isPending || statuses?.linkedin === 'stopped'}
              >
                <StopCircle className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </div>
            <div className="pt-2 border-t">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => triggerMutation.mutate('linkedin')}
                disabled={triggerMutation.isPending}
              >
                Executar Agora (Manual)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <CardTitle>Logs em Tempo Real</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto font-mono text-sm">
            {logs.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                Nenhum log ainda. Os workers começarão a gerar logs quando executarem.
              </p>
            )}
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex gap-3 p-2 rounded hover:bg-gray-50 border-b"
              >
                <span className="text-gray-400 text-xs whitespace-nowrap">
                  {formatTime(log.timestamp)}
                </span>
                <Badge
                  variant={log.worker === 'sucupira' || log.worker === 'bdtd' || log.worker === 'ufms' ? 'default' : 'outline'}
                  className={`text-xs ${
                    log.worker === 'sucupira' ? 'bg-blue-500' :
                    log.worker === 'bdtd' ? 'bg-purple-500' :
                    log.worker === 'ufms' ? 'bg-green-500' :
                    ''
                  }`}
                >
                  {log.worker.toUpperCase()}
                </Badge>
                <span className={`flex-1 ${getLevelColor(log.level)}`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
