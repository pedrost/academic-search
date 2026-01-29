# Worker Manual Execution Design

**Date:** 2026-01-29
**Status:** Approved
**Priority:** High

## Problem Statement

Manual worker execution via `/api/admin/workers/trigger` requires `npm run workers` to be running. Jobs are queued in Redis but never processed if the worker process isn't active. This creates friction during development and manual testing.

## Solution Overview

Create a service layer that extracts scraper business logic into reusable functions. Enable two execution paths:

1. **Scheduled execution (existing):** `npm run workers` → BullMQ → Worker → Service
2. **Manual execution (new):** API endpoint → Service (direct, no queue)

## Architecture

### Current State

```
Workers (src/workers/*.ts)
├── All scraper logic embedded (400+ lines)
├── Scheduled via BullMQ cron patterns
└── Manual triggers queue jobs (require workers running)
```

### New Architecture

```
src/services/scrapers/
├── types.ts              # Shared interfaces
├── sucupira-scraper.ts   # CAPES API logic
├── bdtd-scraper.ts       # BDTD scraper logic
├── ufms-scraper.ts       # UFMS scraper logic
└── linkedin-scraper.ts   # LinkedIn enrichment logic

Execution Paths:
1. Scheduled: npm run workers → BullMQ → Worker → Service
2. Manual:    Admin UI → API → Service (direct)
```

### Benefits

- Zero breaking changes to existing workers
- Service functions are reusable, testable, framework-agnostic
- Manual execution bypasses queue entirely
- Clear separation: workers = orchestration, services = business logic

## Service Interface

### Shared Types

```typescript
// src/services/scrapers/types.ts

export interface ScraperOptions {
  limit?: number                      // Max records to process
  onProgress?: (msg: string) => void  // Progress callback
  signal?: AbortSignal                // For cancellation
}

export interface ScraperResult {
  success: boolean
  totalCreated: number
  totalSkipped: number
  totalErrors: number
  duration: number           // milliseconds
  errorMessages?: string[]
}
```

### Service Functions

```typescript
// Sucupira - processes all MS institutions
export async function runSucupiraScrape(
  options?: ScraperOptions
): Promise<ScraperResult>

// BDTD - searches digital library
export async function runBdtdScrape(
  options?: ScraperOptions
): Promise<ScraperResult>

// UFMS - institutional repository
export async function runUfmsScrape(
  options?: ScraperOptions
): Promise<ScraperResult>

// LinkedIn - enriches pending academics
export async function runLinkedinEnrichment(
  options?: ScraperOptions
): Promise<ScraperResult>
```

### Design Decisions

- All functions async with standardized return types
- Progress callbacks enable real-time logging
- AbortSignal supports cancellation
- No framework dependencies (pure business logic)

## API Endpoint

### New Endpoint

**POST `/api/admin/workers/run`** (separate from `/trigger`)

**Request:**
```json
{
  "worker": "sucupira" | "bdtd" | "ufms" | "linkedin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sucupira scrape completed",
  "result": {
    "totalCreated": 15,
    "totalSkipped": 42,
    "totalErrors": 0,
    "duration": 45230
  }
}
```

### Implementation

```typescript
// src/app/api/admin/workers/run/route.ts
import { logWorkerActivity } from '@/lib/worker-logger'
import { runSucupiraScrape } from '@/services/scrapers/sucupira-scraper'

export async function POST(request: NextRequest) {
  const { worker } = await request.json()

  if (worker === 'sucupira') {
    const result = await runSucupiraScrape({
      onProgress: (msg) => {
        // Logs appear in admin UI log box
        logWorkerActivity('sucupira', 'info', msg)
      }
    })

    return NextResponse.json({
      success: result.success,
      message: 'Sucupira scrape completed',
      result
    })
  }
  // ... other workers
}
```

### Flow

1. Admin UI → POST `/api/admin/workers/run` with worker name
2. API calls service function with `logWorkerActivity` callback
3. Progress messages appear in admin log box (real-time)
4. Returns final result when complete

## Migration Strategy

### Step 1: Create Service Files

Extract logic from workers into services:

```
src/workers/sucupira-worker.ts
  ├── processSucupiraScrape() ─────┐
  └── searchCAPESDataStore()       │
                                   ├──> src/services/scrapers/sucupira-scraper.ts
Remove BullMQ code ───────────────┤      └── export async function runSucupiraScrape()
Add ScraperResult return ─────────┘
```

### Step 2: Update Workers

```typescript
// src/workers/sucupira-worker.ts (after refactor)
import { runSucupiraScrape } from '@/services/scrapers/sucupira-scraper'

async function processSucupiraScrape() {
  const result = await runSucupiraScrape({
    onProgress: (msg) => logWorkerActivity('sucupira', 'info', msg)
  })

  await logWorkerActivity('sucupira', 'success',
    `Complete: ${result.totalCreated} new, ${result.totalSkipped} skipped`)
}

// Worker remains unchanged - still listens to BullMQ
const sucupiraWorker = new Worker('scraper', async (job) => {
  if (job.name === 'sucupira-scrape') {
    await processSucupiraScrape()
  }
}, { connection, concurrency: 1 })
```

### Step 3: Create API Endpoint

Build `/api/admin/workers/run/route.ts`:
- Import service functions
- Wire up progress logging
- Return standardized results

### Step 4: Update Admin UI

Add "Run Now (Direct)" button:
```tsx
<Button onClick={() => runWorkerDirect('sucupira')}>
  ▶️ Run Now (Direct)
</Button>
```

## Implementation Details

### Error Handling

Services catch errors and return them (never throw):

```typescript
export async function runSucupiraScrape(
  options?: ScraperOptions
): Promise<ScraperResult> {
  const startTime = Date.now()
  let totalCreated = 0
  let totalErrors = 0
  const errorMessages: string[] = []

  try {
    // Core scraping logic...
  } catch (error) {
    totalErrors++
    errorMessages.push(error.message)
    options?.onProgress?.(`❌ Fatal error: ${error.message}`)
  }

  return {
    success: totalErrors === 0,
    totalCreated,
    totalSkipped,
    totalErrors,
    duration: Date.now() - startTime,
    errorMessages: totalErrors > 0 ? errorMessages : undefined
  }
}
```

### Browser/Resource Management

- Services handle their own Playwright browser instances
- Ensure cleanup in finally blocks
- Support AbortSignal for cancellation

### Logging Patterns

```typescript
// Workers: use logWorkerActivity
onProgress: (msg) => logWorkerActivity('sucupira', 'info', msg)

// Direct testing: console.log
onProgress: (msg) => console.log(msg)

// API: logs to admin UI
onProgress: (msg) => logWorkerActivity('sucupira', 'info', msg)
```

### Testing

Services can be tested without BullMQ:

```typescript
import { runSucupiraScrape } from '@/services/scrapers/sucupira-scraper'

const result = await runSucupiraScrape({
  limit: 10,
  onProgress: console.log
})

console.log(`Created: ${result.totalCreated}`)
console.log(`Duration: ${result.duration}ms`)
```

## Implementation Tasks

1. Create `src/services/scrapers/types.ts` with shared interfaces
2. Extract Sucupira logic → `src/services/scrapers/sucupira-scraper.ts`
3. Extract BDTD logic → `src/services/scrapers/bdtd-scraper.ts`
4. Extract UFMS logic → `src/services/scrapers/ufms-scraper.ts`
5. Extract LinkedIn logic → `src/services/scrapers/linkedin-scraper.ts`
6. Update `src/workers/sucupira-worker.ts` to call service
7. Update `src/workers/bdtd-worker.ts` to call service
8. Update `src/workers/ufms-worker.ts` to call service
9. Update `src/workers/linkedin-worker.ts` to call service
10. Create `src/app/api/admin/workers/run/route.ts`
11. Update admin UI to add "Run Now (Direct)" buttons
12. Test scheduled workers still work
13. Test manual execution works without `npm run workers`

## Future Enhancements

- Add streaming progress updates via Server-Sent Events (SSE)
- Add job cancellation via AbortSignal
- Add scraper-specific options (institution filter, date range, etc.)
- Add result caching to avoid duplicate scrapes
