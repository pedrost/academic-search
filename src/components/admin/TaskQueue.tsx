'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TaskWithAcademic } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TaskResolver } from './TaskResolver'

const TASK_TYPE_LABELS: Record<string, string> = {
  CAPTCHA: 'CAPTCHA',
  LINKEDIN_MATCH: 'LinkedIn Match',
  LOGIN_EXPIRED: 'Login Expirado',
  MANUAL_REVIEW: 'Revisão Manual',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  IN_PROGRESS: 'secondary',
  COMPLETED: 'default',
  SKIPPED: 'destructive',
}

type TasksResponse = {
  tasks: TaskWithAcademic[]
  stats: { pending: number; inProgress: number; completed: number; total: number }
}

async function fetchTasks(): Promise<TasksResponse> {
  const res = await fetch('/api/admin/tasks')
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

async function updateTask(id: string, status: string) {
  const res = await fetch('/api/admin/tasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

export function TaskQueue() {
  const queryClient = useQueryClient()
  const [selectedTask, setSelectedTask] = useState<TaskWithAcademic | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tasks'],
    queryFn: fetchTasks,
    refetchInterval: 5000,
  })

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateTask(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tasks'] })
    },
  })

  if (isLoading) {
    return <div>Carregando...</div>
  }

  const { tasks, stats } = data || { tasks: [], stats: { pending: 0, inProgress: 0, completed: 0, total: 0 } }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-sm text-muted-foreground">Em progresso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-sm text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fila de Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma tarefa na fila
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Acadêmico</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.academic?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[task.status]}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(task.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      {task.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            mutation.mutate({ id: task.id, status: 'IN_PROGRESS' })
                            setSelectedTask(task)
                          }}
                        >
                          Resolver
                        </Button>
                      )}
                      {task.status === 'IN_PROGRESS' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              mutation.mutate({ id: task.id, status: 'COMPLETED' })
                            }
                          >
                            Concluir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              mutation.mutate({ id: task.id, status: 'SKIPPED' })
                            }
                          >
                            Pular
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedTask && (
        <TaskResolver
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
