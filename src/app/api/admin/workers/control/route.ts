import { NextRequest, NextResponse } from 'next/server'
import { setWorkerStatus, getAllWorkerStatuses } from '@/lib/worker-control'
import { logWorkerActivity } from '@/lib/worker-logger'

export async function GET() {
  try {
    const statuses = await getAllWorkerStatuses()
    return NextResponse.json(statuses)
  } catch (error) {
    console.error('Get worker status error:', error)
    return NextResponse.json(
      { error: 'Failed to get worker status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worker, action } = body

    if (!worker || !['sucupira', 'bdtd', 'ufms', 'linkedin'].includes(worker)) {
      return NextResponse.json(
        { error: 'Invalid worker. Use "sucupira", "bdtd", "ufms", or "linkedin"' },
        { status: 400 }
      )
    }

    if (action === 'start') {
      await setWorkerStatus(worker, 'running')
      await logWorkerActivity(worker, 'success', 'Worker started by admin')
      return NextResponse.json({ message: `${worker} worker started` })
    }

    if (action === 'pause') {
      await setWorkerStatus(worker, 'paused')
      await logWorkerActivity(worker, 'info', 'Worker paused by admin')
      return NextResponse.json({ message: `${worker} worker paused` })
    }

    if (action === 'stop') {
      await setWorkerStatus(worker, 'stopped')
      await logWorkerActivity(worker, 'info', 'Worker stopped by admin')
      return NextResponse.json({ message: `${worker} worker stopped` })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "start", "pause", or "stop"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Worker control error:', error)
    return NextResponse.json(
      { error: 'Failed to control worker' },
      { status: 500 }
    )
  }
}
