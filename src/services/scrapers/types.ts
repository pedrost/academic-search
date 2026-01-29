/**
 * Shared types for scraper services
 *
 * These services extract core scraper logic from workers to enable
 * both scheduled (via BullMQ) and manual (via API) execution.
 */

export interface ScraperOptions {
  /** Maximum number of records to process */
  limit?: number

  /** Progress callback for real-time logging */
  onProgress?: (msg: string) => void

  /** AbortSignal for cancellation support */
  signal?: AbortSignal
}

export interface ScraperResult {
  /** Whether the scrape completed without fatal errors */
  success: boolean

  /** Number of new records created */
  totalCreated: number

  /** Number of duplicate/existing records skipped */
  totalSkipped: number

  /** Number of errors encountered */
  totalErrors: number

  /** Duration in milliseconds */
  duration: number

  /** Error messages if any errors occurred */
  errorMessages?: string[]
}
