# Multi-Source Academic Data Worker Architecture

**Date:** 2026-01-29
**Status:** Planning
**Priority:** High - Diversify data sources for reliability

## Problem Statement

Current reliance on CAPES API alone is problematic:
- CAPES API server is extremely slow and unreliable
- Frequent connection timeouts (even with 3-minute timeout)
- Single point of failure for data collection
- Limited to what CAPES exposes

## Solution: Multi-Source Worker System

Create multiple specialized workers, each collecting from different sources:
- **CAPES Worker** (existing) - CAPES Open Data API
- **BDTD Worker** (new) - Biblioteca Digital Brasileira de Teses e Dissertações
- **University Repository Workers** (new) - Direct scraping from UFMS, UCDB, UEMS, IFMS

## Architecture Overview

### Worker Types

#### 1. CAPES Worker (Existing - Enhanced)
**Source:** `dadosabertos.capes.gov.br/api`
**Method:** Playwright browser navigation to API endpoints
**Status:** Implemented with 3-minute timeout
**Pros:** Official data, structured JSON
**Cons:** Very slow, unreliable connections

#### 2. BDTD Worker (New)
**Source:** `bdtd.ibict.br` - IBICT's national thesis/dissertation library
**Method:** OAI-PMH protocol or web scraping
**Coverage:** National (all Brazilian universities)
**Data Format:** XML (OAI-PMH) or HTML (web interface)

**Implementation approach:**
- Research BDTD OAI-PMH endpoint: `http://bdtd.ibict.br/vufind/OAI/Server`
- Use OAI-PMH harvester (request by institution identifier)
- Parse XML metadata: author, title, year, institution, advisor, abstract
- Alternative: Scrape search results if OAI-PMH unavailable

**Estimated effort:** 2-3 hours for OAI-PMH, 4-6 hours for web scraping

#### 3. University Repository Workers (New)

Each MS university has its own digital repository:

**UFMS (Universidade Federal de Mato Grosso do Sul)**
- Repository: `repositorio.ufms.br`
- Browse by: Program, Year, Author
- Format: DSpace-based repository

**UCDB (Universidade Católica Dom Bosco)**
- Repository: `site.ucdb.br/public/biblioteca-dissertacoes-teses/`
- Format: Custom website or institutional repository

**UEMS (Universidade Estadual de Mato Grosso do Sul)**
- Repository: Need to research
- Format: Unknown

**IFMS (Instituto Federal de Mato Grosso do Sul)**
- Repository: Need to research
- Format: Unknown

**Implementation approach:**
- Research each repository URL and structure
- Create browser-based scraper for each
- Extract: author, title, year, program, advisor, PDF link
- Handle pagination and search interfaces

**Estimated effort:** 3-4 hours per repository (12-16 hours total)

## Frontend UI Design

### Worker Management Page Enhancement

**Current state:** Admin dashboard shows 2 workers (Sucupira, LinkedIn)

**Proposed enhancement:**

```
┌─────────────────────────────────────────────────────────┐
│ Worker Control Panel                                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ 📊 Data Collection Workers                               │
│                                                           │
│ ┌───────────────────────────────────────────────────┐   │
│ │ 🇧🇷 CAPES (National API)                   Running │   │
│ │ Collects: All MS universities via CAPES API       │   │
│ │ Last run: 2 hours ago | Next: Daily at 2 AM       │   │
│ │ Status: 47 new, 120 duplicates                    │   │
│ │ [▶ Start] [⏸ Pause] [⏹ Stop] [▶▶ Execute Now]    │   │
│ └───────────────────────────────────────────────────┘   │
│                                                           │
│ ┌───────────────────────────────────────────────────┐   │
│ │ 📚 BDTD (IBICT National Library)          Stopped │   │
│ │ Collects: All MS universities via BDTD            │   │
│ │ Last run: Never | Next: Weekly on Sundays         │   │
│ │ [▶ Start] [⏹ Stop] [▶▶ Execute Now]              │   │
│ └───────────────────────────────────────────────────┘   │
│                                                           │
│ ┌───────────────────────────────────────────────────┐   │
│ │ 🏛️ University Repositories               Stopped  │   │
│ │ ├─ UFMS Repository                                │   │
│ │ ├─ UCDB Repository                                │   │
│ │ ├─ UEMS Repository                                │   │
│ │ └─ IFMS Repository                                │   │
│ │ Collects: Direct from university websites         │   │
│ │ Last run: Never | Next: Monthly                   │   │
│ │ [▶ Start] [⏹ Stop] [▶▶ Execute Now]              │   │
│ │ [⚙️ Configure Sources]                            │   │
│ └───────────────────────────────────────────────────┘   │
│                                                           │
│ 🔍 Enrichment Workers                                    │
│                                                           │
│ ┌───────────────────────────────────────────────────┐   │
│ │ 💼 LinkedIn Enrichment                    Running │   │
│ │ [controls...]                                      │   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Configuration Modal

When clicking "⚙️ Configure Sources" on University Repositories worker:

```
┌─────────────────────────────────────────────────────┐
│ Configure University Repository Workers             │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Select which repositories to scrape:                │
│                                                      │
│ ☑ UFMS - Universidade Federal de MS                │
│   Repository: repositorio.ufms.br                   │
│   Estimated: ~2000 dissertations                    │
│   [Test Connection]                                  │
│                                                      │
│ ☑ UCDB - Universidade Católica Dom Bosco           │
│   Repository: site.ucdb.br/public/...              │
│   Estimated: ~500 dissertations                     │
│   [Test Connection]                                  │
│                                                      │
│ ☐ UEMS - Universidade Estadual de MS               │
│   Repository: Not configured                        │
│   [Configure URL]                                    │
│                                                      │
│ ☐ IFMS - Instituto Federal de MS                   │
│   Repository: Not configured                        │
│   [Configure URL]                                    │
│                                                      │
│ Schedule: ⚪ Daily  ⚪ Weekly  ⦿ Monthly            │
│ Time: [02:00] AM                                     │
│                                                      │
│ [Cancel] [Save Configuration]                        │
└─────────────────────────────────────────────────────┘
```

## Data Model Updates

### Worker Configuration Table

```sql
-- New table to store worker configurations
CREATE TABLE worker_config (
  id SERIAL PRIMARY KEY,
  worker_type VARCHAR(50) NOT NULL, -- 'capes', 'bdtd', 'repo-ufms', etc.
  enabled BOOLEAN DEFAULT true,
  schedule_cron VARCHAR(100), -- '0 2 * * *' for daily at 2 AM
  config_json JSONB, -- Flexible config: {urls, filters, limits}
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track statistics per worker
CREATE TABLE worker_stats (
  id SERIAL PRIMARY KEY,
  worker_type VARCHAR(50) NOT NULL,
  run_date DATE NOT NULL,
  records_found INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_skipped INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Academic Data Model Enhancement

Add source tracking:

```typescript
// Update Academic model
model Academic {
  // ... existing fields ...

  // New fields
  sourceType      String   // 'CAPES', 'BDTD', 'UFMS_REPO', etc.
  sourceUrl       String?  // Original URL where data was found
  sourceMetadata  Json?    // Flexible metadata from source
  lastVerified    DateTime? // When we last checked source
}
```

## Implementation Plan

### Phase 1: BDTD Worker (Week 1)
1. Research BDTD OAI-PMH endpoint and protocols
2. Create `src/workers/bdtd-worker.ts`
3. Implement OAI-PMH harvesting or web scraping
4. Add to worker registry and admin UI
5. Test with MS institutions
6. Deploy and monitor

### Phase 2: University Repository Workers (Week 2-3)
1. Research each university's repository structure
2. Create base repository scraper class
3. Implement UFMS scraper
4. Implement UCDB scraper
5. Implement UEMS scraper (if available)
6. Implement IFMS scraper (if available)
7. Create unified worker that runs all repository scrapers
8. Add configuration UI
9. Test and deploy

### Phase 3: Enhanced Monitoring (Week 4)
1. Create worker statistics dashboard
2. Add success/failure charts
3. Email alerts on worker failures
4. Comparative analysis (which source provides most data)
5. Duplicate detection across sources

## Success Metrics

- **Reliability:** At least one worker successfully collects data daily
- **Coverage:** 90%+ of MS dissertations from all sources combined
- **Performance:** Each worker completes within 30 minutes
- **Data Quality:** <5% duplicates across sources
- **Visibility:** Admin can see which source provided each academic record

## Risks and Mitigations

**Risk:** Repository structures change frequently
**Mitigation:** Version scrapers, add change detection, email alerts on failures

**Risk:** Rate limiting or blocking from university sites
**Mitigation:** Respect robots.txt, add delays, rotate user agents

**Risk:** Data format inconsistencies across sources
**Mitigation:** Normalization layer, manual review queue for unclear data

**Risk:** Duplicate detection complex with multiple sources
**Mitigation:** Fuzzy matching on (name + year + institution), prefer newest data

## Next Steps

1. ✅ Increase CAPES timeout to 3 minutes
2. ⏳ Research BDTD OAI-PMH endpoint
3. ⏳ Research university repository URLs
4. ⏳ Design worker registry system
5. ⏳ Implement BDTD worker
6. ⏳ Update admin UI for multiple workers
