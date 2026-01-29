import { NextRequest, NextResponse } from 'next/server'
import { getAllWorkerLogs, type WorkerName } from '@/lib/worker-logger'
import { redis } from '@/lib/queue'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    const logs = await getAllWorkerLogs(limit)

    // Transform to match UI expected format
    const formattedLogs = logs.map((log, index) => ({
      id: `${log.timestamp}-${index}`,
      timestamp: new Date(log.timestamp).getTime(),
      worker: log.worker,
      level: log.level,
      message: log.message,
    }))

    return NextResponse.json({ logs: formattedLogs })
  } catch (error) {
    console.error('Get worker logs error:', error)
    return NextResponse.json(
      { error: 'Failed to get worker logs', logs: [] },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const workers: WorkerName[] = ['sucupira', 'bdtd', 'ufms', 'linkedin']

    for (const worker of workers) {
      await redis.del(`worker:logs:${worker}`)
    }

    return NextResponse.json({ message: 'Logs cleared' })
  } catch (error) {
    console.error('Clear worker logs error:', error)
    return NextResponse.json(
      { error: 'Failed to clear logs' },
      { status: 500 }
    )
  }
}
