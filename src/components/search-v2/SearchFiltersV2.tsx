'use client'

import { useState } from 'react'
import { Input, Button, Divider } from '@nextui-org/react'
import { Search, X, Filter, ChevronDown, Check } from 'lucide-react'
import {
  RESEARCH_FIELDS,
  MS_CITIES,
  DEGREE_LEVEL_LABELS,
  SECTOR_LABELS,
} from '@/lib/constants'
import { SearchFilters as SearchFiltersType } from '@/types'

type Props = {
  filters: SearchFiltersType
  onFilterChange: (filters: SearchFiltersType) => void
}

function CustomSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  options: string[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 hover:border-white/20 transition-colors text-left"
      >
        <span className={value ? 'text-gray-200' : 'text-gray-500'}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-[#1a1b26] border border-white/10 rounded-lg shadow-2xl">
            {value && (
              <button
                type="button"
                onClick={() => { onChange(undefined); setIsOpen(false) }}
                className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-white/5 border-b border-white/5"
              >
                Limpar seleção
              </button>
            )}
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => { onChange(option); setIsOpen(false) }}
                className={`w-full px-3 py-2 text-sm text-left hover:bg-white/5 flex items-center justify-between ${
                  value === option ? 'bg-violet-500/10 text-violet-400' : 'text-gray-300'
                }`}
              >
                <span>{option}</span>
                {value === option && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function CustomCheckboxGroup({
  label,
  options,
  values,
  onChange,
}: {
  label: string
  options: { key: string; label: string }[]
  values: string[]
  onChange: (values: string[]) => void
}) {
  const toggleValue = (key: string) => {
    if (values.includes(key)) {
      onChange(values.filter((v) => v !== key))
    } else {
      onChange([...values, key])
    }
  }

  const isChecked = (key: string) => values.includes(key)

  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="space-y-0.5">
        {options.map(({ key, label }) => (
          <label
            key={key}
            onClick={() => toggleValue(key)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
          >
            <div
              className={`w-4 h-4 rounded flex items-center justify-center transition-all duration-200 ${
                isChecked(key)
                  ? 'bg-violet-500 border-2 border-violet-500'
                  : 'border-2 border-gray-600 bg-transparent'
              }`}
            >
              {isChecked(key) && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${isChecked(key) ? 'text-violet-300 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function SearchFiltersV2({ filters, onFilterChange }: Props) {
  const hasActiveFilters =
    filters.query ||
    filters.researchField ||
    (filters.degreeLevel && filters.degreeLevel.length > 0) ||
    (filters.currentSector && filters.currentSector.length > 0) ||
    filters.currentCity ||
    filters.graduationYearMin ||
    filters.graduationYearMax

  const clearAllFilters = () => {
    onFilterChange({})
  }

  const activeFilterCount = [
    filters.query,
    filters.researchField,
    ...(filters.degreeLevel || []),
    ...(filters.currentSector || []),
    filters.currentCity,
    filters.graduationYearMin || filters.graduationYearMax ? 'year' : null,
  ].filter(Boolean).length

  return (
    <div className="lg:sticky lg:top-4">
      <div className="bg-[#1a1b26] rounded-xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-violet-400" />
            <span className="font-medium text-sm text-gray-200">Filtros</span>
          </div>
          {activeFilterCount > 0 && (
            <span className="bg-violet-500/20 text-violet-400 text-xs font-mono font-medium px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="p-4 space-y-5">
            {hasActiveFilters && (
              <div>
                <Button
                  variant="flat"
                  size="sm"
                  className="w-full bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  startContent={<X className="w-3 h-3" />}
                  onPress={clearAllFilters}
                >
                  Limpar filtros
                </Button>
                <Divider className="mt-4 bg-white/5" />
              </div>
            )}

            {/* Search Input */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Buscar</p>
              <Input
                placeholder="Nome ou palavra-chave..."
                value={filters.query || ''}
                onValueChange={(value) =>
                  onFilterChange({ ...filters, query: value })
                }
                startContent={
                  <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
                }
                size="sm"
                variant="bordered"
                classNames={{
                  inputWrapper: 'border border-white/10 bg-white/5 hover:bg-white/10 data-[focus=true]:border-violet-500/50',
                  input: 'text-gray-200 placeholder:text-gray-600',
                }}
              />
            </div>

            <CustomSelect
              label="Área de Pesquisa"
              placeholder="Todas as áreas"
              options={[...RESEARCH_FIELDS]}
              value={filters.researchField}
              onChange={(value) =>
                onFilterChange({ ...filters, researchField: value })
              }
            />

            <CustomCheckboxGroup
              label="Nível de Formação"
              options={Object.entries(DEGREE_LEVEL_LABELS).map(([key, label]) => ({
                key,
                label,
              }))}
              values={filters.degreeLevel || []}
              onChange={(values) =>
                onFilterChange({ ...filters, degreeLevel: values })
              }
            />

            <CustomSelect
              label="Cidade"
              placeholder="Todas as cidades"
              options={[...MS_CITIES]}
              value={filters.currentCity}
              onChange={(value) =>
                onFilterChange({ ...filters, currentCity: value })
              }
            />

            <CustomCheckboxGroup
              label="Setor Atual"
              options={Object.entries(SECTOR_LABELS)
                .filter(([key]) => key !== 'UNKNOWN')
                .map(([key, label]) => ({ key, label }))}
              values={filters.currentSector || []}
              onChange={(values) =>
                onFilterChange({ ...filters, currentSector: values })
              }
            />

            {/* Year Range */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Ano de Formação</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="De"
                  value={filters.graduationYearMin?.toString() || ''}
                  onValueChange={(value) =>
                    onFilterChange({
                      ...filters,
                      graduationYearMin: value ? parseInt(value) : undefined,
                    })
                  }
                  size="sm"
                  variant="bordered"
                  classNames={{
                    inputWrapper: 'border border-white/10 bg-white/5 hover:bg-white/10 data-[focus=true]:border-violet-500/50',
                    input: 'text-gray-200 placeholder:text-gray-600 font-mono',
                  }}
                />
                <Input
                  type="number"
                  placeholder="Até"
                  value={filters.graduationYearMax?.toString() || ''}
                  onValueChange={(value) =>
                    onFilterChange({
                      ...filters,
                      graduationYearMax: value ? parseInt(value) : undefined,
                    })
                  }
                  size="sm"
                  variant="bordered"
                  classNames={{
                    inputWrapper: 'border border-white/10 bg-white/5 hover:bg-white/10 data-[focus=true]:border-violet-500/50',
                    input: 'text-gray-200 placeholder:text-gray-600 font-mono',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
