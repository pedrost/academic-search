'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── LinkedIn session ──────────────────────────────────────────────

async function getLinkedInStatus(): Promise<{ isLoggedIn: boolean; hasCookies: boolean }> {
  const res = await fetch('/api/admin/linkedin/session')
  return res.json()
}

async function linkedInAction(action: string) {
  const res = await fetch('/api/admin/linkedin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  return res.json()
}

// ── CNPq session ──────────────────────────────────────────────────

async function getCnpqStatus(): Promise<{ hasCookies: boolean; isOpen: boolean }> {
  const res = await fetch('/api/admin/cnpq/session')
  return res.json()
}

async function cnpqAction(action: string) {
  const res = await fetch('/api/admin/cnpq/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  return res.json()
}

// ── Status badge component ────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
      ok ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-gray-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-gray-600'}`} />
      {label}
    </span>
  )
}

export default function BrowserPage() {
  const queryClient = useQueryClient()

  const { data: linkedIn } = useQuery({
    queryKey: ['linkedin-session'],
    queryFn: getLinkedInStatus,
    refetchInterval: 5000,
  })

  const { data: cnpq } = useQuery({
    queryKey: ['cnpq-session'],
    queryFn: getCnpqStatus,
    refetchInterval: 5000,
  })

  const liStart = useMutation({
    mutationFn: () => linkedInAction('start'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['linkedin-session'] }),
  })

  const liStop = useMutation({
    mutationFn: () => linkedInAction('stop'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['linkedin-session'] }),
  })

  const cnpqStart = useMutation({
    mutationFn: () => cnpqAction('start'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cnpq-session'] }),
  })

  const cnpqSave = useMutation({
    mutationFn: () => cnpqAction('save'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cnpq-session'] }),
  })

  const cnpqStop = useMutation({
    mutationFn: () => cnpqAction('stop'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cnpq-session'] }),
  })

  const cnpqClear = useMutation({
    mutationFn: () => cnpqAction('clear'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cnpq-session'] }),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-200">Sessões de Browser</h1>

      {/* ── LinkedIn ─────────────────────────────────────── */}
      <div className="bg-[#1a1b26] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">LinkedIn Voyager</h2>
          <StatusBadge ok={!!linkedIn?.isLoggedIn} label={linkedIn?.isLoggedIn ? 'Logado' : 'Não logado'} />
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {linkedIn?.hasCookies
            ? 'Cookies salvos. O enriquecimento usa essa sessão automaticamente.'
            : 'Sem cookies. Abra o browser, faça login e os cookies serão salvos.'}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => liStart.mutate()}
            disabled={liStart.isPending}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-500 disabled:opacity-50"
          >
            {liStart.isPending ? 'Abrindo...' : 'Abrir Browser'}
          </button>
          <button
            type="button"
            onClick={() => liStop.mutate()}
            disabled={liStop.isPending}
            className="px-4 py-2 bg-white/5 text-gray-400 text-sm rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-50"
          >
            {liStop.isPending ? 'Fechando...' : 'Fechar'}
          </button>
        </div>

        <div className="mt-4 p-3 bg-white/3 rounded-lg border border-white/5">
          <p className="text-xs text-gray-500">
            <strong className="text-gray-400">Fluxo:</strong> Abrir browser → fazer login no LinkedIn → cookies são salvos automaticamente → fechar browser.
            A sessão é reutilizada para buscar perfis via Voyager API.
          </p>
        </div>
      </div>

      {/* ── CNPq Lattes ──────────────────────────────────── */}
      <div className="bg-[#1a1b26] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">CNPq Lattes (CAPTCHA)</h2>
          <StatusBadge ok={!!cnpq?.hasCookies} label={cnpq?.hasCookies ? 'Sessão ativa' : 'Sem sessão'} />
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {cnpq?.hasCookies
            ? 'Sessão CNPq salva. O Lattes CV fetch usará esses cookies para pular o CAPTCHA.'
            : 'Sem sessão CNPq. O Lattes busca apenas o ID (sem dados do CV). Resolva o CAPTCHA abaixo para habilitar CV completo.'}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => cnpqStart.mutate()}
            disabled={cnpqStart.isPending}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-500 disabled:opacity-50"
          >
            {cnpqStart.isPending ? 'Abrindo...' : 'Abrir CAPTCHA'}
          </button>
          {cnpq?.isOpen && (
            <button
              type="button"
              onClick={() => cnpqSave.mutate()}
              disabled={cnpqSave.isPending}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-50"
            >
              {cnpqSave.isPending ? 'Salvando...' : 'Salvar Cookies'}
            </button>
          )}
          <button
            type="button"
            onClick={() => cnpqStop.mutate()}
            disabled={cnpqStop.isPending}
            className="px-4 py-2 bg-white/5 text-gray-400 text-sm rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-50"
          >
            {cnpqStop.isPending ? 'Fechando...' : 'Fechar'}
          </button>
          {cnpq?.hasCookies && (
            <button
              type="button"
              onClick={() => cnpqClear.mutate()}
              disabled={cnpqClear.isPending}
              className="px-4 py-2 bg-red-500/10 text-red-400 text-sm rounded-lg border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
            >
              Limpar sessão
            </button>
          )}
        </div>

        <div className="mt-4 p-3 bg-white/3 rounded-lg border border-white/5">
          <p className="text-xs text-gray-500">
            <strong className="text-gray-400">Fluxo:</strong> Abrir CAPTCHA → resolver reCAPTCHA na janela → clicar "Submeter" → salvar cookies → fechar.
            Os cookies permitem buscar dados completos do CV Lattes (grau, áreas de pesquisa, emprego) sem CAPTCHA.
          </p>
        </div>

        <div className="mt-3 p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/10">
          <p className="text-xs text-yellow-400/80">
            <strong>Nota:</strong> Sem sessão CNPq, o Lattes ainda encontra o ID do pesquisador (via Brave/Bing).
            O CAPTCHA só é necessário para extrair dados detalhados do currículo.
          </p>
        </div>
      </div>
    </div>
  )
}
