/**
 * Worker Control System
 *
 * Manages worker states using Redis for persistence across restarts.
 * Workers check their status before processing jobs.
 */

import { redis } from '@/lib/queue'

export type WorkerName = 'sucupira' | 'bdtd' | 'ufms' | 'linkedin'
export type WorkerStatus = 'running' | 'paused' | 'stopped'

const WORKER_STATUS_PREFIX = 'worker:status:'

/**
 * Set worker status in Redis
 */
export async function setWorkerStatus(worker: WorkerName, status: WorkerStatus): Promise<void> {
  await redis.set(`${WORKER_STATUS_PREFIX}${worker}`, status)
}

/**
 * Get worker status from Redis
 */
export async function getWorkerStatus(worker: WorkerName): Promise<WorkerStatus> {
  const status = await redis.get(`${WORKER_STATUS_PREFIX}${worker}`)
  return (status as WorkerStatus) || 'running'
}

/**
 * Check if worker should run (not paused or stopped)
 */
export async function shouldWorkerRun(worker: WorkerName): Promise<boolean> {
  const status = await getWorkerStatus(worker)
  return status === 'running'
}

/**
 * Get all worker statuses
 */
export async function getAllWorkerStatuses(): Promise<Record<WorkerName, WorkerStatus>> {
  const workers: WorkerName[] = ['sucupira', 'bdtd', 'ufms', 'linkedin']
  const statuses: Record<WorkerName, WorkerStatus> = {} as Record<WorkerName, WorkerStatus>

  for (const worker of workers) {
    statuses[worker] = await getWorkerStatus(worker)
  }

  return statuses
}
