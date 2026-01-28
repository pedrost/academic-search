import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AcademicWithDissertations } from '@/types'
import { DEGREE_LEVEL_LABELS, SECTOR_LABELS } from '@/lib/constants'
import Link from 'next/link'

type Props = {
  academic: AcademicWithDissertations
}

export function AcademicCard({ academic }: Props) {
  return (
    <Link href={`/academic/${academic.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">{academic.name}</CardTitle>
            {academic.degreeLevel && (
              <Badge variant="secondary">
                {DEGREE_LEVEL_LABELS[academic.degreeLevel]}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {academic.researchField && (
            <p className="text-sm text-muted-foreground">
              {academic.researchField}
            </p>
          )}

          {academic.institution && (
            <p className="text-sm">
              <span className="font-medium">Instituição:</span>{' '}
              {academic.institution}
            </p>
          )}

          {(academic.currentCity || academic.currentState) && (
            <p className="text-sm">
              <span className="font-medium">Localização:</span>{' '}
              {[academic.currentCity, academic.currentState]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}

          {academic.currentSector && academic.currentSector !== 'UNKNOWN' && (
            <p className="text-sm">
              <span className="font-medium">Setor:</span>{' '}
              {SECTOR_LABELS[academic.currentSector]}
            </p>
          )}

          {academic.currentJobTitle && (
            <p className="text-sm">
              <span className="font-medium">Cargo:</span>{' '}
              {academic.currentJobTitle}
              {academic.currentCompany && ` @ ${academic.currentCompany}`}
            </p>
          )}

          {academic.dissertations.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {academic.dissertations.length} dissertação(ões)
              </p>
              <p className="text-sm truncate">
                {academic.dissertations[0].title}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
