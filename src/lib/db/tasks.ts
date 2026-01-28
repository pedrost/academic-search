import { prisma } from '@/lib/db'
import { TaskStatus, TaskType } from '@prisma/client'

export async function getTasks(status?: TaskStatus, limit: number = 50) {
  return prisma.enrichmentTask.findMany({
    where: status ? { status } : undefined,
    include: { academic: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  })
}

export async function getTaskById(id: string) {
  return prisma.enrichmentTask.findUnique({
    where: { id },
    include: { academic: true },
  })
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  assignedTo?: string
) {
  return prisma.enrichmentTask.update({
    where: { id },
    data: {
      status,
      assignedTo,
      completedAt: status === 'COMPLETED' ? new Date() : undefined,
    },
  })
}

export async function createTask(
  taskType: TaskType,
  academicId?: string,
  payload?: any,
  priority: number = 0
) {
  return prisma.enrichmentTask.create({
    data: {
      taskType,
      academicId,
      payload,
      priority,
    },
  })
}

export async function getTaskStats() {
  const [pending, inProgress, completed, total] = await Promise.all([
    prisma.enrichmentTask.count({ where: { status: 'PENDING' } }),
    prisma.enrichmentTask.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.enrichmentTask.count({ where: { status: 'COMPLETED' } }),
    prisma.enrichmentTask.count(),
  ])

  return { pending, inProgress, completed, total }
}
