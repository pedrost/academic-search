# Academic Hunter - System Design

**Date:** 2026-01-28
**Status:** Approved
**Scope:** POC focused on Mato Grosso do Sul (MS) state

## Problem Statement

Universities in Brazil pay for complete information about academics' current roles and activities. Government and policy makers need to find experts in specific fields for consultations or public positions, but lack easy access to this information.

## Solution

A "Person Hunter" system that aggregates data from public academic sources (Sucupira, Lattes) and enriches it with current employment data (LinkedIn), making it searchable by research field, location, sector, and other criteria.

## Target Users

Government and policy makers looking to find academic experts for:
- Public consultations
- Advisory roles
- Government positions
- Policy development

---

## Architecture Overview

### Three Main Components

1. **Web App (Next.js)** - Search UI for end-users + Operator dashboard for interventions
2. **Scraper Service (Node.js + Playwright)** - Background workers that crawl data sources, queue tasks when blocked
3. **Database (PostgreSQL)** - Stores academics, dissertations, enrichment data, pending tasks

### Data Flow

```
[Sucupira/Lattes/LinkedIn]
        ↓
[Scraper Workers] ←→ [Task Queue] ←→ [Operator Dashboard]
        ↓
   [PostgreSQL]
        ↓
   [Search API]
        ↓
[End-user Search UI]
```

---

## Data Model

### Academic (main entity)
```
- id, name, email (if found)
- research_field (e.g., "Ciências Agrárias", "Saúde Pública")
- degree_level (masters, phd, postdoc)
- graduation_year
- institution (where they studied)
- current_location (city, state)
- current_sector (academia, government, private, ngo)
- linkedin_url, lattes_url
- last_enriched_at
- enrichment_status (pending, partial, complete)
```

### Dissertation
```
- id, academic_id (FK)
- title, abstract, keywords
- defense_year
- institution, program
- advisor_name
- source_url (Sucupira link)
```

### EnrichmentTask (operator queue)
```
- id, academic_id (FK)
- task_type (captcha, linkedin_match, login_expired, manual_review)
- status (pending, in_progress, completed, skipped)
- payload (JSON: captcha image URL, candidate LinkedIn profiles, etc.)
- assigned_to (operator)
- created_at, completed_at
```

### ScraperSession (tracking)
```
- id, source (sucupira, lattes, linkedin)
- status (running, paused, waiting_intervention, completed)
- last_activity_at
- stats (profiles_scraped, tasks_created, errors)
```

---

## Scraper Architecture

### Three Dedicated Scrapers

1. **Sucupira Scraper** - Crawls dissertations/theses for MS institutions. No CAPTCHA, relatively straightforward. Extracts: academic name, dissertation title, keywords, year, institution, program, advisor.

2. **Lattes Scraper** - Enriches academic profiles with full CV data. CAPTCHA-protected. When CAPTCHA appears → pauses, saves screenshot, creates task for operator.

3. **LinkedIn Scraper** - Runs in operator-authenticated session. Searches for academics by name + institution, extracts current job/company/location. When session expires or ambiguous match → creates intervention task.

### Intervention Flow

```
Scraper hits obstacle
       ↓
Creates EnrichmentTask (type: captcha/linkedin_match/etc)
       ↓
Scraper pauses for that profile, continues with others
       ↓
Operator sees task in dashboard
       ↓
Operator resolves (solves captcha / confirms match / re-logs in)
       ↓
Task marked complete, scraper picks up where it left off
```

---

## Browser Stealth & Anti-Detection

### Making the Browser Look Human

**Playwright Stealth Configuration:**
- Use `playwright-extra` + `stealth plugin` - Patches common detection vectors
- Realistic viewport & user-agent - Match common Brazilian browser profiles
- Timezone & locale - Set to America/Campo_Grande, pt-BR language
- Persistent session - Reuse browser profile/cookies across sessions

**Human-like Behavior:**
- Random delays - 2-5 seconds between actions, longer pauses on "reading" pages
- Mouse movements - Simulate cursor moving to elements before clicking
- Scroll patterns - Scroll down gradually, pause, scroll more
- Session limits - Max 30-50 profiles per session, take breaks between batches

**CAPTCHA Handling (tiered):**
1. Prevention first - Stealth config + human-like behavior should minimize CAPTCHAs
2. Auto-solve attempt - Integrate 2Captcha/Anti-Captcha as optional first pass (off by default)
3. Manual fallback - Only if auto-solve fails or is disabled, queue for operator

---

## Frontend UI Design

### End-User Search Interface

**Main search page:**
- Search bar with keyword input (searches dissertation titles, research fields)
- Filter sidebar:
  - Research field (dropdown/multi-select)
  - Degree level (checkboxes: Masters, PhD, Post-doc)
  - Graduation year (range slider)
  - Current location (state/city dropdown, defaulted to MS)
  - Current sector (checkboxes: Academia, Government, Private, NGO)
- Results list showing: name, degree, research field, current role/sector, institution
- Profile detail page - Full info, dissertation abstract, LinkedIn link, Lattes link

### Operator Dashboard

**Separate `/admin` route (protected):**
- Scraper status panel - Shows each scraper's state, profiles processed, last activity
- Task queue - Filterable list of pending interventions with type badges
- Task resolution view:
  - For CAPTCHA: shows image + input field
  - For LinkedIn match: academic info side-by-side with candidate profiles
  - For login expired: button to open embedded browser
- Browser control panel - Embedded Playwright browser view for LinkedIn session

---

## Tech Stack

### Full Stack (TypeScript)

**Frontend:**
- Next.js 14 (App Router) - React framework with SSR, API routes
- Tailwind CSS - Rapid styling
- shadcn/ui - Pre-built accessible components
- TanStack Query - Data fetching, caching

**Backend:**
- Next.js API Routes - REST endpoints
- Prisma - Type-safe ORM for PostgreSQL
- BullMQ + Redis - Job queue for scraper tasks
- Playwright + playwright-extra + stealth plugin - Browser automation

**Database:**
- PostgreSQL - Main data store
- Redis - Queue backend + session/cache storage

**Infrastructure (POC):**
- Docker Compose - Local dev with Postgres, Redis, app containers
- Single VPS deployment - All services on one machine for POC

**Optional additions:**
- 2Captcha SDK - If auto-solve is enabled
- Meilisearch - If full-text search needs to be faster (later)

---

## Project Structure

```
hunter/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Search UI
│   │   ├── academic/[id]/      # Profile detail page
│   │   └── admin/              # Operator dashboard
│   ├── components/             # Shared UI components
│   ├── lib/
│   │   ├── db/                 # Prisma client, queries
│   │   ├── queue/              # BullMQ job definitions
│   │   └── scrapers/           # Scraper logic
│   │       ├── sucupira.ts
│   │       ├── lattes.ts
│   │       └── linkedin.ts
│   ├── workers/                # Background job processors
│   └── types/                  # Shared TypeScript types
├── prisma/
│   └── schema.prisma           # Database schema
├── docker-compose.yml          # Postgres + Redis + App
└── package.json
```

---

## POC Scope (Phase 1)

### Included
1. Sucupira scraper for MS institutions (UFMS, UEMS, UFGD)
2. Basic search UI with filters
3. Operator dashboard with task queue
4. LinkedIn enrichment via controlled browser session
5. CAPTCHA manual resolution flow

### Deferred to Later Phases
- Lattes integration (more complex, heavy CAPTCHA)
- Auto CAPTCHA solving
- Map visualization
- Advanced analytics dashboard

---

## Search/Filter Criteria

Essential filters for POC:
- Research field/area
- Degree level (Masters, PhD, Post-doc)
- Current location (city/state)
- Current sector (Academia, Government, Private, NGO)
- Keywords in dissertation/thesis title
- Year of graduation

---

## Data Sources

### Sucupira (Primary - POC)
- URL: https://sucupira-v2.capes.gov.br/observatorio/teses-e-dissertacoes
- No CAPTCHA protection
- Contains: dissertations, theses, academic info, institutions

### Lattes (Secondary - Later Phase)
- URL: https://buscatextual.cnpq.br/buscatextual/busca.do
- CAPTCHA protected
- Contains: full academic CVs, publications, experience

### LinkedIn (Enrichment)
- Operator-controlled browser session
- Contains: current job, company, location
- Human-in-the-loop for matching and authentication
