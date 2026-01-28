import { NextRequest, NextResponse } from 'next/server'
import { getAcademicById } from '@/lib/db/academics'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const academic = await getAcademicById(params.id)

    if (!academic) {
      return NextResponse.json(
        { error: 'Academic not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(academic)
  } catch (error) {
    console.error('Error fetching academic:', error)
    return NextResponse.json(
      { error: 'Failed to fetch academic' },
      { status: 500 }
    )
  }
}
