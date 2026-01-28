import { NextRequest, NextResponse } from 'next/server'
import { getTaskById, updateTaskStatus } from '@/lib/db/tasks'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await getTaskById(params.id)

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, solution, selectedProfile } = body

    const task = await getTaskById(params.id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Handle different task types
    if (task.taskType === 'CAPTCHA' && solution) {
      // Store solution for scraper to use
      await prisma.enrichmentTask.update({
        where: { id: params.id },
        data: {
          payload: { ...(task.payload as any), solution },
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
    } else if (task.taskType === 'LINKEDIN_MATCH' && selectedProfile) {
      // Update academic with selected profile data
      if (task.academicId) {
        await prisma.academic.update({
          where: { id: task.academicId },
          data: {
            linkedinUrl: selectedProfile.profileUrl,
            currentJobTitle: selectedProfile.currentTitle,
            currentCompany: selectedProfile.currentCompany,
            enrichmentStatus: 'PARTIAL',
            lastEnrichedAt: new Date(),
          },
        })
      }

      await updateTaskStatus(params.id, 'COMPLETED')
    } else {
      await updateTaskStatus(params.id, status)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
