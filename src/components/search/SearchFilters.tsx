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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
            value={filters.researchField || ''}
            onValueChange={(value) =>
              onFilterChange({
                ...filters,
                researchField: value || undefined,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as áreas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as áreas</SelectItem>
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
            value={filters.currentCity || ''}
            onValueChange={(value) =>
              onFilterChange({ ...filters, currentCity: value || undefined })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as cidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as cidades</SelectItem>
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

        <Button onClick={onSearch} className="w-full">
          Buscar
        </Button>
      </CardContent>
    </Card>
  )
}
