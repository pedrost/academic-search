/**
 * Shared types for scraper services
 *
 * These services extract core scraper logic from workers to enable
 * both scheduled (via BullMQ) and manual (via API) execution.
 */

export interface ScraperOptions {
  /**
   * Max records to fetch from the source.
   * Counted against source records seen, not DB outcomes —
   * so limit=10 always means "look at 10 records" regardless of duplicates.
   */
  limit?: number

  /**
   * Dry run: fetch and parse real data but never write to the database.
   * Use to verify connectivity, parsing, and data quality without side effects.
   */
  dryRun?: boolean

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
