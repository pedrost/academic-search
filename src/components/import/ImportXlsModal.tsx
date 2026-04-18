'use client'

import { Modal, ModalContent, ModalBody, Button } from '@nextui-org/react'
import { Upload, FileSpreadsheet, X, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onImport: (file: File, enhancementCount: string) => void
}

const ENHANCEMENT_OPTIONS = [
  { value: '0', label: 'Sem enriquecimento' },
  { value: '5', label: '5 perfis' },
  { value: '10', label: '10 perfis' },
  { value: 'all', label: 'Todos' },
] as const

export function ImportXlsModal({ isOpen, onClose, onImport }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [enhancementCount, setEnhancementCount] = useState('0')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xls') || file.name.endsWith('.xlsx'))) {
      setSelectedFile(file)
    }
  }

  const handleSubmit = () => {
    if (!selectedFile) return
    onImport(selectedFile, enhancementCount)
    setSelectedFile(null)
    setEnhancementCount('0')
  }

  const handleClose = () => {
    setSelectedFile(null)
    setEnhancementCount('0')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      placement="center"
      classNames={{
        backdrop: 'bg-black/70 backdrop-blur-sm',
        base: 'bg-[#1a1b26] border border-white/10 shadow-2xl',
      }}
    >
      <ModalContent>
        <ModalBody className="p-6 gap-0">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-gray-100">Importar Planilha</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Extraia acadêmicos de um arquivo .xls ou .xlsx usando IA
            </p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl py-6 px-4 text-center cursor-pointer transition-all
              ${isDragging
                ? 'border-violet-400 bg-violet-500/10'
                : selectedFile
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-white/10 hover:border-violet-500/30 hover:bg-white/5'
              }
            `}
          >
            <input ref={inputRef} type="file" accept=".xls,.xlsx" onChange={handleFileChange} className="hidden" />

            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-green-400 shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button isIconOnly size="sm" variant="light" className="shrink-0" onPress={() => { setSelectedFile(null) }}>
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Arraste ou <span className="text-violet-400 font-medium">selecione um arquivo</span>
                </p>
                <p className="text-xs text-gray-600 mt-1">.xls, .xlsx</p>
              </>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Auto-enriquecimento</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {ENHANCEMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEnhancementCount(opt.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium font-mono transition-all ${
                    enhancementCount === opt.value
                      ? 'bg-violet-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-1.5">Busca dados profissionais na web após importar</p>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button size="sm" variant="flat" className="bg-white/5 text-gray-400 hover:bg-white/10" onPress={handleClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              isDisabled={!selectedFile}
              onPress={handleSubmit}
              startContent={<Upload className="w-3.5 h-3.5" />}
              className="bg-violet-600 text-white hover:bg-violet-500"
            >
              Importar
            </Button>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
