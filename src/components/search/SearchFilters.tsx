'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, X } from 'lucide-react'
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
  onSearch: () => void
}

export function SearchFilters({ filters, onFilterChange, onSearch }: Props) {
  const handleDegreeLevelChange = (level: string, checked: boolean) => {
    const current = filters.degreeLevel || []
    const updated = checked
      ? [...current, level]
      : current.filter((l) => l !== level)
    onFilterChange({ ...filters, degreeLevel: updated })
  }

  const handleSectorChange = (sector: string, checked: boolean) => {
    const current = filters.currentSector || []
    const updated = checked
      ? [...current, sector]
      : current.filter((s) => s !== sector)
    onFilterChange({ ...filters, currentSector: updated })
  }

  return (
    <div className="lg:sticky lg:top-4">
      <Card className="w-full shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="border-b bg-gradient-to-r from-primary-50 to-accent-50">
          <CardTitle className="flex items-center gap-2 text-primary-700">
            <Search className="w-5 h-5" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Active Filters Summary */}
          {(filters.query || (filters.degreeLevel && filters.degreeLevel.length > 0) || (filters.currentSector && filters.currentSector.length > 0)) && (
            <div className="flex flex-wrap gap-2 pb-4 border-b">
              {filters.query && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                  {filters.query}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-primary-900"
                    onClick={() => onFilterChange({ ...filters, query: '' })}
                  />
                </span>
              )}
              {filters.degreeLevel?.map(level => (
                <span key={level} className="inline-flex items-center gap-1 px-3 py-1 bg-accent-100 text-accent-700 rounded-full text-xs font-medium">
                  {DEGREE_LEVEL_LABELS[level as keyof typeof DEGREE_LEVEL_LABELS]}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => {
                      const updated = filters.degreeLevel?.filter(l => l !== level) || []
                      onFilterChange({ ...filters, degreeLevel: updated })
                    }}
                  />
                </span>
              ))}
            </div>
          )}

        <div>
          <label className="text-sm font-medium mb-2 block">
            Buscar por nome ou palavra-chave
          </label>
          <Input
            placeholder="Ex: agricultura familiar, Maria Silva..."
            value={filters.query || ''}
            onChange={(e) =>
              onFilterChange({ ...filters, query: e.target.value })
            }
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Área de Pesquisa
          </label>
          <Select
            value={filters.researchField || 'all'}
            onValueChange={(value) =>
              onFilterChange({
                ...filters,
                researchField: value === 'all' ? undefined : value,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as áreas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {RESEARCH_FIELDS.map((field) => (
                <SelectItem key={field} value={field}>
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Nível de Formação
          </label>
          <div className="space-y-2">
            {Object.entries(DEGREE_LEVEL_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={`degree-${key}`}
                  checked={filters.degreeLevel?.includes(key) || false}
                  onCheckedChange={(checked) =>
                    handleDegreeLevelChange(key, checked as boolean)
                  }
                />
                <label htmlFor={`degree-${key}`} className="text-sm">
                  {label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Cidade Atual</label>
          <Select
            value={filters.currentCity || 'all'}
            onValueChange={(value) =>
              onFilterChange({ ...filters, currentCity: value === 'all' ? undefined : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as cidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {MS_CITIES.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Setor Atual</label>
          <div className="space-y-2">
            {Object.entries(SECTOR_LABELS)
              .filter(([key]) => key !== 'UNKNOWN')
              .map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sector-${key}`}
                    checked={filters.currentSector?.includes(key) || false}
                    onCheckedChange={(checked) =>
                      handleSectorChange(key, checked as boolean)
                    }
                  />
                  <label htmlFor={`sector-${key}`} className="text-sm">
                    {label}
                  </label>
                </div>
              ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Ano Mín.</label>
            <Input
              type="number"
              placeholder="2010"
              value={filters.graduationYearMin || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  graduationYearMin: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Ano Máx.</label>
            <Input
              type="number"
              placeholder="2024"
              value={filters.graduationYearMax || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  graduationYearMax: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
        </div>

        <Button
          onClick={onSearch}
          className="w-full bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          <Search className="w-4 h-4 mr-2" />
          Buscar Acadêmicos
        </Button>
      </CardContent>
    </Card>
    </div>
  )
}
