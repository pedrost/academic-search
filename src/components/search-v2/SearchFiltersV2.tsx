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
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary-500 to-violet-500 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <span className="font-semibold">Filtros de Busca</span>
          </div>
        </CardHeader>
        <CardBody className="gap-5">
          {/* Active Filters */}
          {hasActiveFilters && (
            <>
              <div className="flex flex-wrap gap-2">
                {filters.query && (
                  <Chip
                    onClose={() => removeFilter('query')}
                    variant="flat"
                    color="primary"
                    size="sm"
                  >
                    &ldquo;{filters.query}&rdquo;
                  </Chip>
                )}
                {filters.researchField && (
                  <Chip
                    onClose={() => removeFilter('researchField')}
                    variant="flat"
                    color="secondary"
                    size="sm"
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
                    size="sm"
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
                    size="sm"
                  >
                    {SECTOR_LABELS[sector as keyof typeof SECTOR_LABELS]}
                  </Chip>
                ))}
                {filters.currentCity && (
                  <Chip
                    onClose={() => removeFilter('currentCity')}
                    variant="flat"
                    size="sm"
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
                    size="sm"
                  >
                    {filters.graduationYearMin || '...'} - {filters.graduationYearMax || '...'}
                  </Chip>
                )}
              </div>
              <Button
                size="sm"
                variant="light"
                color="danger"
                startContent={<X className="w-4 h-4" />}
                onPress={clearAllFilters}
              >
                Limpar todos os filtros
              </Button>
              <Divider />
            </>
          )}

          {/* Search Input */}
          <Input
            label="Buscar por nome ou palavra-chave"
            placeholder="Ex: agricultura familiar, Maria Silva..."
            value={filters.query || ''}
            onValueChange={(value) => onFilterChange({ ...filters, query: value })}
            startContent={<Search className="w-4 h-4 text-default-400" />}
            isClearable
            onClear={() => onFilterChange({ ...filters, query: '' })}
          />

          {/* Research Field */}
          <Select
            label="Área de Pesquisa"
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

          {/* Degree Level */}
          <CheckboxGroup
            label="Nível de Formação"
            value={filters.degreeLevel || []}
            onValueChange={(value) =>
              onFilterChange({ ...filters, degreeLevel: value as string[] })
            }
          >
            {Object.entries(DEGREE_LEVEL_LABELS).map(([key, label]) => (
              <Checkbox key={key} value={key} size="sm">
                {label}
              </Checkbox>
            ))}
          </CheckboxGroup>

          {/* City */}
          <Select
            label="Cidade Atual"
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

          {/* Sector */}
          <CheckboxGroup
            label="Setor Atual"
            value={filters.currentSector || []}
            onValueChange={(value) =>
              onFilterChange({ ...filters, currentSector: value as string[] })
            }
          >
            {Object.entries(SECTOR_LABELS)
              .filter(([key]) => key !== 'UNKNOWN')
              .map(([key, label]) => (
                <Checkbox key={key} value={key} size="sm">
                  {label}
                </Checkbox>
              ))}
          </CheckboxGroup>

          {/* Year Range */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Ano Mín."
              placeholder="2010"
              value={filters.graduationYearMin?.toString() || ''}
              onValueChange={(value) =>
                onFilterChange({
                  ...filters,
                  graduationYearMin: value ? parseInt(value) : undefined,
                })
              }
            />
            <Input
              type="number"
              label="Ano Máx."
              placeholder="2024"
              value={filters.graduationYearMax?.toString() || ''}
              onValueChange={(value) =>
                onFilterChange({
                  ...filters,
                  graduationYearMax: value ? parseInt(value) : undefined,
                })
              }
            />
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
