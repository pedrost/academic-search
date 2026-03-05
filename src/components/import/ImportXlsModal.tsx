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
        backdrop: 'bg-black/60 backdrop-blur-sm',
        base: 'bg-white shadow-2xl rounded-2xl',
      }}
    >
      <ModalContent>
        <ModalBody className="p-6 gap-0">
          {/* Header */}
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-default-900">Importar Planilha</h3>
            <p className="text-sm text-default-400 mt-0.5">
              Extraia acadêmicos de um arquivo .xls ou .xlsx usando IA
            </p>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl py-6 px-4 text-center cursor-pointer transition-all
              ${isDragging
                ? 'border-primary-400 bg-primary-50'
                : selectedFile
                  ? 'border-success-300 bg-success-50/50'
                  : 'border-default-200 hover:border-primary-300 hover:bg-default-50'
              }
            `}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-success-500 shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-default-800 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-default-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className="shrink-0"
                  onPress={(e) => { setSelectedFile(null) }}
                >
                  <X className="w-3.5 h-3.5 text-default-400" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-default-300 mx-auto mb-2" />
                <p className="text-sm text-default-500">
                  Arraste ou <span className="text-primary-500 font-medium">selecione um arquivo</span>
                </p>
                <p className="text-xs text-default-300 mt-1">.xls, .xlsx</p>
              </>
            )}
          </div>

          {/* Enhancement Options */}
          <div className="mt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-default-400" />
              <span className="text-xs font-medium text-default-500 uppercase tracking-wide">
                Auto-enriquecimento
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {ENHANCEMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEnhancementCount(opt.value)}
                  className={`
                    px-3 py-2 rounded-lg text-xs font-medium transition-all
                    ${enhancementCount === opt.value
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'bg-default-100 text-default-600 hover:bg-default-200'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-default-300 mt-1.5">
              Busca dados profissionais na web após importar
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button size="sm" variant="flat" onPress={handleClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              color="primary"
              isDisabled={!selectedFile}
              onPress={handleSubmit}
              startContent={<Upload className="w-3.5 h-3.5" />}
            >
              Importar
            </Button>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
