'use client'

import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  CheckboxGroup,
  Checkbox,
  Chip,
  Button,
  Divider,
} from '@nextui-org/react'
import { Search, X, Filter } from 'lucide-react'
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

  const removeFilter = (key: keyof SearchFiltersType, value?: string) => {
    if (key === 'degreeLevel' && value) {
      onFilterChange({
        ...filters,
        degreeLevel: filters.degreeLevel?.filter((d) => d !== value),
      })
    } else if (key === 'currentSector' && value) {
      onFilterChange({
        ...filters,
        currentSector: filters.currentSector?.filter((s) => s !== value),
      })
    } else {
      onFilterChange({ ...filters, [key]: undefined })
    }
  }

  return (
    <div className="lg:sticky lg:top-4 space-y-4">
      <Card className="shadow-md border border-default-200">
        <CardHeader className="bg-gradient-to-r from-primary-500 to-violet-500 rounded-t-large px-4 py-3">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-white" />
            <span className="font-semibold text-white">Filtros de Busca</span>
          </div>
        </CardHeader>
        <CardBody className="gap-6 p-5">
          {/* Active Filters */}
          {hasActiveFilters && (
            <>
              <div className="flex flex-wrap gap-2">
                {filters.query && (
                  <Chip
                    onClose={() => removeFilter('query')}
                    variant="flat"
                    color="primary"
                    classNames={{ base: 'px-3 py-1', content: 'text-sm' }}
                  >
                    &ldquo;{filters.query}&rdquo;
                  </Chip>
                )}
                {filters.researchField && (
                  <Chip
                    onClose={() => removeFilter('researchField')}
                    variant="flat"
                    color="secondary"
                    classNames={{ base: 'px-3 py-1', content: 'text-sm' }}
                  >
                    {filters.researchField}
                  </Chip>
                )}
                {filters.degreeLevel?.map((level) => (
                  <Chip
                    key={level}
                    onClose={() => removeFilter('degreeLevel', level)}
                    variant="flat"
                    color="success"
                    classNames={{ base: 'px-3 py-1', content: 'text-sm' }}
                  >
                    {DEGREE_LEVEL_LABELS[level as keyof typeof DEGREE_LEVEL_LABELS]}
                  </Chip>
                ))}
                {filters.currentSector?.map((sector) => (
                  <Chip
                    key={sector}
                    onClose={() => removeFilter('currentSector', sector)}
                    variant="flat"
                    color="warning"
                    classNames={{ base: 'px-3 py-1', content: 'text-sm' }}
                  >
                    {SECTOR_LABELS[sector as keyof typeof SECTOR_LABELS]}
                  </Chip>
                ))}
                {filters.currentCity && (
                  <Chip
                    onClose={() => removeFilter('currentCity')}
                    variant="flat"
                    classNames={{ base: 'px-3 py-1', content: 'text-sm' }}
                  >
                    {filters.currentCity}
                  </Chip>
                )}
                {(filters.graduationYearMin || filters.graduationYearMax) && (
                  <Chip
                    onClose={() => {
                      onFilterChange({
                        ...filters,
                        graduationYearMin: undefined,
                        graduationYearMax: undefined,
                      })
                    }}
                    variant="flat"
                    classNames={{ base: 'px-3 py-1', content: 'text-sm' }}
                  >
                    {filters.graduationYearMin || '...'} - {filters.graduationYearMax || '...'}
                  </Chip>
                )}
              </div>
              <Button
                variant="light"
                color="danger"
                startContent={<X className="w-4 h-4" />}
                onPress={clearAllFilters}
                className="px-4"
              >
                Limpar todos os filtros
              </Button>
              <Divider />
            </>
          )}

          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-default-700 mb-2">
              Buscar por nome ou palavra-chave
            </label>
            <Input
              placeholder="Ex: agricultura familiar, Maria Silva..."
              value={filters.query || ''}
              onValueChange={(value) => onFilterChange({ ...filters, query: value })}
              startContent={<Search className="w-4 h-4 text-default-400" />}
              isClearable
              onClear={() => onFilterChange({ ...filters, query: '' })}
            />
          </div>

          {/* Research Field */}
          <div>
            <label className="block text-sm font-medium text-default-700 mb-2">
              Área de Pesquisa
            </label>
            <Select
              placeholder="Todas as áreas"
              selectedKeys={filters.researchField ? [filters.researchField] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string
                onFilterChange({ ...filters, researchField: value || undefined })
              }}
            >
              {RESEARCH_FIELDS.map((field) => (
                <SelectItem key={field}>{field}</SelectItem>
              ))}
            </Select>
          </div>

          {/* Degree Level */}
          <div>
            <label className="block text-sm font-medium text-default-700 mb-2">
              Nível de Formação
            </label>
            <CheckboxGroup
              value={filters.degreeLevel || []}
              onValueChange={(value) =>
                onFilterChange({ ...filters, degreeLevel: value as string[] })
              }
            >
              {Object.entries(DEGREE_LEVEL_LABELS).map(([key, label]) => (
                <Checkbox key={key} value={key} classNames={{ label: 'text-sm' }}>
                  {label}
                </Checkbox>
              ))}
            </CheckboxGroup>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-default-700 mb-2">
              Cidade Atual
            </label>
            <Select
              placeholder="Todas as cidades"
              selectedKeys={filters.currentCity ? [filters.currentCity] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string
                onFilterChange({ ...filters, currentCity: value || undefined })
              }}
            >
              {MS_CITIES.map((city) => (
                <SelectItem key={city}>{city}</SelectItem>
              ))}
            </Select>
          </div>

          {/* Sector */}
          <div>
            <label className="block text-sm font-medium text-default-700 mb-2">
              Setor Atual
            </label>
            <CheckboxGroup
              value={filters.currentSector || []}
              onValueChange={(value) =>
                onFilterChange({ ...filters, currentSector: value as string[] })
              }
            >
              {Object.entries(SECTOR_LABELS)
                .filter(([key]) => key !== 'UNKNOWN')
                .map(([key, label]) => (
                  <Checkbox key={key} value={key} classNames={{ label: 'text-sm' }}>
                    {label}
                  </Checkbox>
                ))}
            </CheckboxGroup>
          </div>

          {/* Year Range */}
          <div>
            <label className="block text-sm font-medium text-default-700 mb-2">
              Ano de Formação
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Mín"
                value={filters.graduationYearMin?.toString() || ''}
                onValueChange={(value) =>
                  onFilterChange({
                    ...filters,
                    graduationYearMin: value ? parseInt(value) : undefined,
                  })
                }
                size="sm"
              />
              <Input
                type="number"
                placeholder="Máx"
                value={filters.graduationYearMax?.toString() || ''}
                onValueChange={(value) =>
                  onFilterChange({
                    ...filters,
                    graduationYearMax: value ? parseInt(value) : undefined,
                  })
                }
                size="sm"
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
