'use client'

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, RadioGroup, Radio } from '@nextui-org/react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import { useRef, useState } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onImport: (file: File, enhancementCount: string) => void
}

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
      size="lg"
      placement="center"
      classNames={{
        backdrop: 'bg-black/60 backdrop-blur-sm',
        base: 'bg-white shadow-2xl',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h3 className="text-lg font-bold">Importar Planilha</h3>
          <p className="text-sm text-default-500 font-normal">
            Envie um arquivo .xls ou .xlsx para extrair acadêmicos com IA
          </p>
        </ModalHeader>

        <ModalBody>
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragging
                ? 'border-primary-500 bg-primary-50'
                : selectedFile
                  ? 'border-success-500 bg-success-50'
                  : 'border-default-300 hover:border-primary-400 hover:bg-default-50'
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
                <FileSpreadsheet className="w-8 h-8 text-success-500" />
                <div className="text-left">
                  <p className="font-medium text-success-700">{selectedFile.name}</p>
                  <p className="text-xs text-default-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => setSelectedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-default-400 mx-auto mb-3" />
                <p className="text-default-600 font-medium">
                  Arraste um arquivo ou clique para selecionar
                </p>
                <p className="text-xs text-default-400 mt-1">
                  Formatos aceitos: .xls, .xlsx
                </p>
              </>
            )}
          </div>

          {/* Enhancement Options */}
          <div className="mt-2">
            <RadioGroup
              label="Auto-enriquecimento (busca web)"
              value={enhancementCount}
              onValueChange={setEnhancementCount}
              size="sm"
              classNames={{
                label: 'text-sm font-medium text-default-700',
              }}
            >
              <Radio value="0" description="Apenas extrair e salvar no banco">
                Sem enriquecimento
              </Radio>
              <Radio value="5" description="Buscar dados web dos 5 primeiros">
                5 acadêmicos
              </Radio>
              <Radio value="10" description="Buscar dados web dos 10 primeiros">
                10 acadêmicos
              </Radio>
              <Radio value="all" description="Buscar dados web de todos (pode demorar)">
                Todos
              </Radio>
            </RadioGroup>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={handleClose}>
            Cancelar
          </Button>
          <Button
            color="primary"
            isDisabled={!selectedFile}
            onPress={handleSubmit}
            startContent={<Upload className="w-4 h-4" />}
          >
            Importar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
