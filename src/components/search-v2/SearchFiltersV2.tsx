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

// Custom Select component to avoid NextUI Select issues
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
      <p className="text-sm font-medium text-default-700 mb-2">{label}</p>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border-2 border-default-200 rounded-lg bg-white hover:border-default-400 transition-colors text-left"
      >
        <span className={value ? 'text-default-900' : 'text-default-400'}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-default-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-white border border-default-200 rounded-lg shadow-lg">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined)
                  setIsOpen(false)
                }}
                className="w-full px-3 py-2 text-sm text-left text-danger-500 hover:bg-danger-50 border-b border-default-100"
              >
                Limpar seleção
              </button>
            )}
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option)
                  setIsOpen(false)
                }}
                className={`w-full px-3 py-2 text-sm text-left hover:bg-primary-50 flex items-center justify-between ${
                  value === option ? 'bg-primary-50 text-primary-600' : 'text-default-700'
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

// Custom Checkbox Group
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
      <p className="text-sm font-medium text-default-700 mb-2">{label}</p>
      <div className="space-y-1">
        {options.map(({ key, label }) => (
          <label
            key={key}
            onClick={() => toggleValue(key)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-default-100 cursor-pointer transition-colors"
          >
            <div
              className={`w-4 h-4 rounded flex items-center justify-center transition-all duration-200 ${
                isChecked(key)
                  ? 'bg-violet-600 border-2 border-violet-600'
                  : 'border-2 border-gray-300 bg-white'
              }`}
            >
              {isChecked(key) && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${isChecked(key) ? 'text-violet-700 font-medium' : 'text-default-700'}`}>
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
      <div className="bg-white rounded-xl shadow-md border border-default-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-violet-500 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-white" />
              <span className="font-semibold text-white">Filtros</span>
            </div>
            {activeFilterCount > 0 && (
              <span className="bg-white/20 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <div>
                <Button
                  variant="flat"
                  color="danger"
                  size="sm"
                  className="w-full"
                  startContent={<X className="w-3 h-3" />}
                  onPress={clearAllFilters}
                >
                  Limpar todos os filtros
                </Button>
                <Divider className="mt-4" />
              </div>
            )}

            {/* Search Input */}
            <div>
              <p className="text-sm font-medium text-default-700 mb-2">
                Buscar
              </p>
              <Input
                placeholder="Nome ou palavra-chave..."
                value={filters.query || ''}
                onValueChange={(value) =>
                  onFilterChange({ ...filters, query: value })
                }
                startContent={
                  <Search className="w-4 h-4 text-default-400 flex-shrink-0" />
                }
                size="sm"
                variant="bordered"
                classNames={{
                  inputWrapper: 'border-2',
                }}
              />
            </div>

            {/* Research Field */}
            <CustomSelect
              label="Área de Pesquisa"
              placeholder="Todas as áreas"
              options={[...RESEARCH_FIELDS]}
              value={filters.researchField}
              onChange={(value) =>
                onFilterChange({ ...filters, researchField: value })
              }
            />

            {/* Degree Level */}
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

            {/* City */}
            <CustomSelect
              label="Cidade"
              placeholder="Todas as cidades"
              options={[...MS_CITIES]}
              value={filters.currentCity}
              onChange={(value) =>
                onFilterChange({ ...filters, currentCity: value })
              }
            />

            {/* Sector */}
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
              <p className="text-sm font-medium text-default-700 mb-2">
                Ano de Formação
              </p>
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
                    inputWrapper: 'border-2',
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
                    inputWrapper: 'border-2',
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
