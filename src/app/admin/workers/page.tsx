'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type WorkerName = 'sucupira' | 'bdtd' | 'ufms'
type RunState = 'idle' | 'running' | 'done' | 'error'

interface WorkerResult {
  totalCreated: number
  totalSkipped: number
  totalErrors: number
  duration: number
}

const WORKERS: { name: WorkerName; label: string; description: string; totalRecords: string }[] = [
  {
    name: 'sucupira',
    label: 'CAPES / Sucupira',
    description: 'API nacional CAPES — universidades do MS (2022–2024)',
    totalRecords: '~690 registros',
  },
  {
    name: 'bdtd',
    label: 'BDTD / IBICT',
    description: 'Biblioteca Digital de Teses — UFMS via DSpace',
    totalRecords: '~5.334 registros',
  },
  {
    name: 'ufms',
    label: 'Repositório UFMS',
    description: 'Repositório institucional UFMS',
    totalRecords: '',
  },
]

const LIMIT_OPTIONS = [
  { label: 'Tudo', value: 0 },
  { label: '10', value: 10 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '500', value: 500 },
]

function WorkerCard({
  name, label, description, totalRecords,
}: {
  name: WorkerName
  label: string
  description: string
  totalRecords: string
}) {
  const [state, setState] = useState<RunState>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<WorkerResult | null>(null)
  const [limit, setLimit] = useState(10)
  const [dryRun, setDryRun] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function run() {
    if (state === 'running') {
      abortRef.current?.abort()
      setState('idle')
      return
    }

    setState('running')
    setLogs([])
    setResult(null)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const response = await fetch('/api/admin/workers/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker: name,
          ...(limit > 0 ? { limit } : {}),
          ...(dryRun ? { dryRun: true } : {}),
        }),
        signal: abort.signal,
      })

      if (!response.ok || !response.body) {
        setState('error')
        setLogs(['Erro ao iniciar o worker.'])
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim()
          if (!line) continue
          try {
            const event = JSON.parse(line)
            if (event.type === 'log') {
              setLogs(prev => [...prev, event.msg])
            } else if (event.type === 'done') {
              setResult(event.result)
              setState('done')
            } else if (event.type === 'error') {
              setLogs(prev => [...prev, `ERRO: ${event.msg}`])
              setState('error')
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setState('error')
      setLogs(prev => [...prev, `Erro de conexão: ${err instanceof Error ? err.message : String(err)}`])
    }
  }

  const isRunning = state === 'running'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{label}</span>
          <div className="flex items-center gap-2">
            {totalRecords && (
              <span className="text-xs font-normal text-muted-foreground">{totalRecords}</span>
            )}
            {state === 'running' && <Badge className="bg-blue-500">Executando...</Badge>}
            {state === 'done' && <Badge className="bg-green-500">Concluído</Badge>}
            {state === 'error' && <Badge className="bg-red-500">Erro</Badge>}
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="flex rounded-md border overflow-hidden text-sm font-medium">
          <button
            onClick={() => setDryRun(true)}
            disabled={isRunning}
            className={`flex-1 py-1.5 transition-colors ${
              dryRun ? 'bg-amber-100 text-amber-800' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            Testar (sem salvar)
          </button>
          <button
            onClick={() => setDryRun(false)}
            disabled={isRunning}
            className={`flex-1 py-1.5 transition-colors border-l ${
              !dryRun ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            Executar (salva no banco)
          </button>
        </div>

        {/* Limit selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Registros:</span>
          <div className="flex gap-1">
            {LIMIT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setLimit(opt.value)}
                disabled={isRunning}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  limit === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Result summary */}
        {result && !dryRun && (
          <div className="grid grid-cols-3 gap-2 p-3 bg-muted rounded text-center text-sm">
            <div>
              <div className="font-semibold text-green-600">{result.totalCreated}</div>
              <div className="text-muted-foreground text-xs">novos</div>
            </div>
            <div>
              <div className="font-semibold text-gray-500">{result.totalSkipped}</div>
              <div className="text-muted-foreground text-xs">já existiam</div>
            </div>
            <div>
              <div className="font-semibold text-red-500">{result.totalErrors}</div>
              <div className="text-muted-foreground text-xs">erros</div>
            </div>
          </div>
        )}

        <Button
          className="w-full"
          variant={isRunning ? 'destructive' : 'default'}
          onClick={run}
        >
          {isRunning
            ? 'Cancelar'
            : dryRun
            ? `Testar${limit > 0 ? ` (${limit} registros)` : ''}`
            : `Executar${limit > 0 ? ` (${limit} registros)` : ' tudo'}`}
        </Button>

        {/* Live log */}
        {logs.length > 0 && (
          <div className="bg-black text-green-400 font-mono text-xs rounded p-3 max-h-72 overflow-y-auto">
            {logs.map((line, i) => (
              <div key={i} className="leading-relaxed">{line || '\u00A0'}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function WorkersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Workers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Use <strong>Testar</strong> para validar conectividade e parsing sem gravar no banco.
          Use <strong>Executar</strong> para importar dados reais.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {WORKERS.map(w => (
          <WorkerCard key={w.name} {...w} />
        ))}
      </div>
    </div>
  )
}
