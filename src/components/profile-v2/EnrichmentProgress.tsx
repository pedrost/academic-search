'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { Modal, ModalContent, ModalBody, Button } from '@nextui-org/react'
import { X, CheckCircle2, XCircle, Terminal } from 'lucide-react'

// Keep phase type exported for page.tsx event handling
export type EnrichmentPhase = 'init' | 'lattes' | 'linkedin' | 'serpapi' | 'proxycurl' | 'discovery' | 'enrichment' | 'search' | 'save'

// Unused now but kept for backwards compat with page.tsx state
export type EnrichmentStep = {
  phase: EnrichmentPhase
  status: 'pending' | 'active' | 'complete' | 'skipped'
  message?: string
}

export type TerminalLine = {
  text: string
  type: 'command' | 'info' | 'success' | 'error' | 'dim' | 'warn'
}

type Props = {
  isOpen: boolean
  academicName: string
  lines: TerminalLine[]
  isDone: boolean
  error?: string | null
  onClose?: () => void
  onCancel?: () => void
}

function useElapsedTime(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (!running) return
    startRef.current = Date.now()
    setElapsed(0)
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000)
    return () => clearInterval(id)
  }, [running])

  const secs = Math.floor(elapsed / 1000)
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, '0')}s`
}

const LINE_COLORS: Record<TerminalLine['type'], string> = {
  command: 'text-violet-400',
  info:    'text-gray-300',
  success: 'text-green-400',
  error:   'text-red-400',
  warn:    'text-yellow-400',
  dim:     'text-gray-500',
}

export function EnrichmentProgress({ isOpen, academicName, lines, isDone, error, onClose, onCancel }: Props) {
  const isRunning = isOpen && !isDone && !error
  const elapsed = useElapsedTime(isRunning)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines.length])

  const statusColor = error ? 'text-red-400' : isDone ? 'text-green-400' : 'text-gray-400'
  const statusIcon = error ? '●' : isDone ? '●' : '◍'

  return (
    <Modal
      isOpen={isOpen}
      hideCloseButton={isRunning}
      isDismissable={!isRunning}
      onClose={onClose}
      size="2xl"
      placement="center"
      classNames={{
        backdrop: 'bg-black/70 backdrop-blur-sm',
        base: 'bg-[#1a1b26] shadow-2xl border border-gray-800 rounded-xl overflow-hidden',
      }}
    >
      <ModalContent>
        <ModalBody className="p-0">

          {/* Title bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#13141c] border-b border-gray-800">
            <Terminal className="w-4 h-4 text-gray-500" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-300 font-medium">enrich</span>
              <span className="text-sm text-gray-600 ml-2">— {academicName}</span>
            </div>
            <span className={`text-xs font-mono ${statusColor}`}>{statusIcon}</span>
            <span className="text-xs text-gray-600 font-mono tabular-nums">{elapsed}</span>
            {!isRunning && onClose && (
              <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Terminal body */}
          <div
            ref={scrollRef}
            className="font-mono text-[13px] leading-relaxed p-4 min-h-[200px] max-h-[420px] overflow-y-auto scrollbar-thin"
          >
            {lines.map((line, i) => (
              <div key={i} className={`${LINE_COLORS[line.type]} py-[1px] whitespace-pre-wrap break-words`}>
                {line.text}
              </div>
            ))}

            {/* Blinking cursor while running */}
            {isRunning && (
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5 mt-1" />
            )}
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#13141c] border-t border-gray-800">
            <div className="flex items-center gap-2 text-xs">
              {error ? (
                <span className="flex items-center gap-1.5 text-red-400">
                  <XCircle className="w-3.5 h-3.5" /> Erro
                </span>
              ) : isDone ? (
                <span className="flex items-center gap-1.5 text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                </span>
              ) : (
                <span className="text-gray-500">{lines.length} linhas</span>
              )}
            </div>
            <div className="flex gap-2">
              {isRunning && onCancel && (
                <Button
                  size="sm"
                  variant="flat"
                  className="bg-red-500/10 text-red-400 hover:bg-red-500/20 h-7 text-xs min-w-0 px-3"
                  onPress={onCancel}
                >
                  Ctrl+C
                </Button>
              )}
              {(isDone || error) && onClose && (
                <Button
                  size="sm"
                  variant="flat"
                  className="bg-gray-700/50 text-gray-300 hover:bg-gray-700 h-7 text-xs min-w-0 px-3"
                  onPress={onClose}
                >
                  Fechar
                </Button>
              )}
            </div>
          </div>

        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
