import { NextRequest, NextResponse } from 'next/server'
import { getTasks, getTaskStats, updateTaskStatus } from '@/lib/db/tasks'
import { TaskStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') as TaskStatus | null

  try {
    const [tasks, stats] = await Promise.all([
      getTasks(status || undefined),
      getTaskStats(),
    ])

    return NextResponse.json({ tasks, stats })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, assignedTo } = body

    const task = await updateTaskStatus(id, status, assignedTo)
    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
