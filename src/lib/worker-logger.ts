/**
 * Worker Logger System
 *
 * Centralized logging for workers with Redis pub/sub for real-time updates
 * and file persistence for debugging.
 */

import { redis } from '@/lib/queue'

export type WorkerName = 'sucupira' | 'bdtd' | 'ufms' | 'linkedin'
export type LogLevel = 'info' | 'success' | 'error' | 'warning'

interface LogEntry {
  worker: WorkerName
  level: LogLevel
  message: string
  timestamp: string
}

const LOG_CHANNEL = 'worker:logs'
const LOG_HISTORY_PREFIX = 'worker:logs:'
const MAX_LOG_HISTORY = 100

/**
 * Log worker activity
 * - Publishes to Redis channel for real-time UI updates
 * - Stores recent logs in Redis list for history
 * - Outputs to console for debugging
 */
export async function logWorkerActivity(
  worker: WorkerName,
  level: LogLevel,
  message: string
): Promise<void> {
  const timestamp = new Date().toISOString()

  const entry: LogEntry = {
    worker,
    level,
    message,
    timestamp,
  }

  // Console output with color
  const levelColors: Record<LogLevel, string> = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    error: '\x1b[31m',   // red
    warning: '\x1b[33m', // yellow
  }
  const reset = '\x1b[0m'
  console.log(`${levelColors[level]}[${worker}]${reset} ${message}`)

  try {
    // Publish for real-time updates
    await redis.publish(LOG_CHANNEL, JSON.stringify(entry))

    // Store in history list (per worker)
    const historyKey = `${LOG_HISTORY_PREFIX}${worker}`
    await redis.lpush(historyKey, JSON.stringify(entry))
    await redis.ltrim(historyKey, 0, MAX_LOG_HISTORY - 1)
  } catch (error) {
    // Don't let logging errors crash the worker
    console.error('Failed to log to Redis:', error)
  }
}

/**
 * Get recent logs for a worker
 */
export async function getWorkerLogs(worker: WorkerName, limit: number = 50): Promise<LogEntry[]> {
  const historyKey = `${LOG_HISTORY_PREFIX}${worker}`
  const logs = await redis.lrange(historyKey, 0, limit - 1)
  return logs.map(log => JSON.parse(log))
}

/**
 * Get recent logs for all workers
 */
export async function getAllWorkerLogs(limit: number = 20): Promise<LogEntry[]> {
  const workers: WorkerName[] = ['sucupira', 'bdtd', 'ufms', 'linkedin']
  const allLogs: LogEntry[] = []

  for (const worker of workers) {
    const logs = await getWorkerLogs(worker, limit)
    allLogs.push(...logs)
  }

  // Sort by timestamp descending
  return allLogs.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  ).slice(0, limit)
}
