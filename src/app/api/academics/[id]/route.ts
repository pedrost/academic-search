import { NextRequest, NextResponse } from 'next/server'
import { getAcademicById } from '@/lib/db/academics'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const academic = await getAcademicById(id)

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
