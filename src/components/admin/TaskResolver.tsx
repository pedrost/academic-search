'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { TaskWithAcademic, CaptchaPayload, LinkedInMatchPayload, LinkedInCandidate } from '@/types'

type Props = {
  task: TaskWithAcademic
  open: boolean
  onClose: () => void
}

async function resolveTask(taskId: string, data: any) {
  const res = await fetch(`/api/admin/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to resolve task')
  return res.json()
}

export function TaskResolver({ task, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [captchaSolution, setCaptchaSolution] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<LinkedInCandidate | null>(null)

  const mutation = useMutation({
    mutationFn: (data: any) => resolveTask(task.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tasks'] })
      onClose()
    },
  })

  const handleCaptchaSubmit = () => {
    mutation.mutate({ solution: captchaSolution, status: 'COMPLETED' })
  }

  const handleProfileSelect = (profile: LinkedInCandidate) => {
    mutation.mutate({ selectedProfile: profile, status: 'COMPLETED' })
  }

  const handleSkip = () => {
    mutation.mutate({ status: 'SKIPPED' })
  }

  const renderCaptchaTask = () => {
    const payload = task.payload as CaptchaPayload | null

    return (
      <div className="space-y-4">
        {payload?.imageUrl && (
          <div className="flex justify-center">
            <img
              src={payload.imageUrl}
              alt="CAPTCHA"
              className="border rounded max-w-full"
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">
            Digite o texto do CAPTCHA
          </label>
          <Input
            value={captchaSolution}
            onChange={(e) => setCaptchaSolution(e.target.value)}
            placeholder="Digite aqui..."
            onKeyDown={(e) => e.key === 'Enter' && handleCaptchaSubmit()}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleSkip}>
            Pular
          </Button>
          <Button onClick={handleCaptchaSubmit} disabled={!captchaSolution}>
            Enviar
          </Button>
        </div>
      </div>
    )
  }

  const renderLinkedInMatchTask = () => {
    const payload = task.payload as LinkedInMatchPayload | null
    const candidates = payload?.candidates || []

    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Acadêmico: <strong>{task.academic?.name}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Selecione o perfil correto do LinkedIn:
          </p>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum candidato encontrado
            </p>
          ) : (
            candidates.map((profile, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-colors ${
                  selectedProfile === profile
                    ? 'ring-2 ring-primary'
                    : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedProfile(profile)}
              >
                <CardContent className="p-4">
                  <p className="font-medium">{profile.name}</p>
                  {profile.headline && (
                    <p className="text-sm text-muted-foreground">
                      {profile.headline}
                    </p>
                  )}
                  {profile.location && (
                    <p className="text-xs text-muted-foreground">
                      {profile.location}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleSkip}>
            Nenhum corresponde
          </Button>
          <Button
            onClick={() => selectedProfile && handleProfileSelect(selectedProfile)}
            disabled={!selectedProfile}
          >
            Confirmar
          </Button>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (task.taskType) {
      case 'CAPTCHA':
        return renderCaptchaTask()
      case 'LINKEDIN_MATCH':
        return renderLinkedInMatchTask()
      default:
        return (
          <div className="space-y-4">
            <p>Tipo de tarefa: {task.taskType}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleSkip}>
                Pular
              </Button>
              <Button onClick={() => mutation.mutate({ status: 'COMPLETED' })}>
                Marcar como concluída
              </Button>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {task.taskType === 'CAPTCHA' && 'Resolver CAPTCHA'}
            {task.taskType === 'LINKEDIN_MATCH' && 'Confirmar Perfil LinkedIn'}
            {task.taskType === 'LOGIN_EXPIRED' && 'Login Expirado'}
            {task.taskType === 'MANUAL_REVIEW' && 'Revisão Manual'}
          </DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
