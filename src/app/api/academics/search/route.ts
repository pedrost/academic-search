import { NextRequest, NextResponse } from 'next/server'
import { searchAcademics } from '@/lib/db/academics'
import { SearchFilters } from '@/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const filters: SearchFilters = {
    query: searchParams.get('q') || undefined,
    researchField: searchParams.get('researchField') || undefined,
    degreeLevel: searchParams.getAll('degreeLevel'),
    graduationYearMin: searchParams.get('yearMin')
      ? parseInt(searchParams.get('yearMin')!)
      : undefined,
    graduationYearMax: searchParams.get('yearMax')
      ? parseInt(searchParams.get('yearMax')!)
      : undefined,
    currentState: searchParams.get('state') || undefined,
    currentCity: searchParams.get('city') || undefined,
    currentSector: searchParams.getAll('sector'),
  }

  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')

  try {
    const result = await searchAcademics(filters, page, pageSize)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Failed to search academics' },
      { status: 500 }
    )
  }
}
