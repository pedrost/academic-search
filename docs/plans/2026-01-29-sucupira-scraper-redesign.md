# Sucupira Scraper Redesign

**Date:** 2026-01-29
**Status:** Implementing
**Priority:** High - Current scraper completely failing

## Problem Statement

Current Sucupira worker fails to collect dissertation data:
- Node.js fetch times out (TLS handshake fails with CAPES API)
- Generic error logs ("fetch failed") don't help debug
- Workers running old code with wrong resource IDs
- No visibility into what's happening

## Solution: Enhanced Worker with Visible Browser

### Architecture

**Browser Choice: Playwright with System Chrome**
- Use `channel: 'chrome'` to use system-installed Chrome
- Falls back to Chromium if Chrome not found
- Visible browser (`headless: false`) for debugging
- Show clear error in admin UI if browser fails to launch

**Enhanced Logging**
- Write to: file, Redis (UI streaming), console
- Log levels: DEBUG, INFO, SUCCESS, WARNING, ERROR, CRITICAL
- Every log includes: timestamp, institution, step, data
- HTTP details: full URL, status, response preview
- Data tracking: each dissertation with author, title, year

**Manual Intervention**
- Worker pauses automatically on any error
- Admin UI shows: "Paused - Review logs and Resume/Stop"
- Worker polls Redis every 2s while paused
- Full error context saved to log file

**Resource IDs (Verified Working)**
```
2024: 87133ba7-ac99-4d87-966e-8f580bc96231
2023: b69baf26-8d02-4c10-ba39-7e9ab799e6ed
2022: 78f73608-6f5e-463c-ba79-0bff4f8a578d
2021: 068003e4-196c-41f4-8c35-1f7c94b4e55c
```

### Data Flow

1. User clicks "Execute Now" in admin UI
2. Job queued to BullMQ
3. Worker picks up job
4. Worker launches visible Chrome browser
5. For each institution:
   - Log: "Processing [Institution]"
   - Navigate to API URL with Playwright
   - Log: HTTP response details
   - Extract JSON from `<pre>` tag
   - Log: "Found X records"
   - For each record: log author, title, save to DB
   - On error: pause, log full details, wait for resume
6. Browser closes when done or stopped

### Implementation Steps

1. ✅ Fix resource IDs (already done, needs worker restart)
2. Create detailed logger module
3. Update worker to use visible browser
4. Add manual intervention controls
5. Update admin UI with better error display
6. Test with one institution first

### Success Criteria

- Browser opens and you can watch it navigate
- Logs show every step: "Opening browser" → "Navigating" → "Found 47 records"
- On error: worker pauses, logs show full context
- Successfully saves dissertations to database
- Works on fresh laptop install (with Chrome/Chromium)
