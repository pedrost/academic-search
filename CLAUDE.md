# Academic Search (Hunter)

Academic researcher discovery and enrichment platform focused on academics in Mato Grosso do Sul, Brazil. Aggregates data from multiple Brazilian sources, enriches profiles with LinkedIn employment information, and provides searchable database of academics with their dissertations.

## Quick Reference

```bash
# Development
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint

# Database
npx prisma migrate dev   # Run migrations
npx prisma generate      # Generate Prisma client
npx prisma studio        # Database GUI

# Workers (run in separate terminals)
npx tsx src/workers/index.ts  # Start all workers

# Docker (PostgreSQL + Redis)
docker compose up -d     # Start databases
docker compose down      # Stop databases
```

## Architecture Overview

```
Frontend (Next.js + React)
    ↓
API Layer (/api/*)
    ↓
Business Logic (src/lib/*)
    ↓
Workers (BullMQ)  ←→  Redis (Queues)
    ↓
PostgreSQL (Prisma ORM)
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Public search interface
│   ├── academic/[id]/     # Academic detail page
│   ├── admin/             # Admin dashboard (tasks, workers, browser)
│   └── api/               # API route handlers
├── components/            # React components
│   ├── ui/               # Shadcn/Radix primitives
│   ├── SearchFilters.tsx # Search filter UI
│   ├── SearchResults.tsx # Results with pagination
│   ├── TaskQueue.tsx     # Admin task management
│   └── WorkerControl.tsx # Worker monitoring
├── lib/                   # Business logic
│   ├── db.ts             # Prisma client singleton
│   ├── queue.ts          # BullMQ queue setup
│   ├── academic-upsert.ts # Smart deduplication/merge
│   └── scrapers/         # Playwright-based scrapers
│       ├── sucupira.ts   # CAPES API scraper
│       ├── bdtd.ts       # BDTD library scraper
│       ├── ufms.ts       # UFMS repository scraper
│       └── linkedin.ts   # LinkedIn enrichment
└── workers/              # BullMQ worker processes
    ├── index.ts          # Worker initialization
    ├── sucupira.ts       # CAPES worker (daily 2 AM)
    ├── bdtd.ts           # BDTD worker (weekly Sun 3 AM)
    ├── ufms.ts           # UFMS worker (monthly 1st 4 AM)
    └── linkedin.ts       # LinkedIn worker (every 6h)
```

## Data Model

**Core Entities:**
- `Academic` - Researcher profile (name, institution, degree, employment, enrichment status)
- `Dissertation` - Thesis/dissertation (title, abstract, keywords, defense year)
- `EnrichmentTask` - Manual review queue (CAPTCHA, LinkedIn matching)
- `ScraperSession` - Scraper execution tracking

**Key Enums:**
- `DegreeLevel`: MASTERS, PHD, POSTDOC
- `EnrichmentStatus`: PENDING, PARTIAL, COMPLETE
- `Sector`: ACADEMIA, GOVERNMENT, PRIVATE, NGO, UNKNOWN

**Relationships:**
- Academic 1:N Dissertation (cascade delete)
- Academic 1:N EnrichmentTask (cascade delete)

## Key Patterns

### Smart Deduplication (`src/lib/academic-upsert.ts`)
- Primary key: name + institution + graduation_year
- Merge strategy: "Never overwrite good data" - only fills empty fields
- Preserves enrichment status from LinkedIn
- Handles multi-source data aggregation

### Worker System
- BullMQ with Redis backend
- Concurrency: 1 per worker (rate limiting)
- Scheduled via cron expressions
- Playwright for browser automation (prefers Chrome, falls back to Chromium)

### API Conventions
- Search: `/api/academics/search?q=&field=&degree=&yearMin=&yearMax=&location=&sector=`
- Detail: `/api/academics/[id]`
- Admin: `/api/admin/*` (tasks, workers, scrapers)

## Data Sources

| Source | Worker | Schedule | Data |
|--------|--------|----------|------|
| CAPES/Sucupira | sucupira | Daily 2 AM | MS institution dissertations |
| BDTD (IBICT) | bdtd | Weekly Sun 3 AM | Digital library theses |
| UFMS Repository | ufms | Monthly 1st 4 AM | Institutional repository |
| LinkedIn | linkedin | Every 6h | Employment enrichment |

## Environment Variables

```env
DATABASE_URL=postgresql://hunter:hunter_dev@localhost:5499/hunter
REDIS_URL=redis://localhost:6380
```

## Testing

```bash
# Run database integration tests (fast, no external API)
npx tsx scripts/test-database.ts

# Run full worker integration test (slow, hits CAPES API)
npx tsx scripts/test-workers.ts
```

## Common Tasks

### Adding a New Scraper
1. Create scraper logic in `src/lib/scrapers/`
2. Create worker in `src/workers/`
3. Register worker in `src/workers/index.ts`
4. Add to admin UI in `src/app/admin/workers/`

### Modifying the Schema
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description`
3. Update affected API routes and components

### Debugging Scrapers
- Workers run Playwright in visible mode by default
- Check worker logs in admin dashboard (`/admin/workers`)
- CAPES API timeout is 3 minutes per call

## Tech Stack

- **Frontend**: Next.js 16, React 19, TanStack Query, Tailwind CSS, Radix UI
- **Backend**: Node.js, Prisma 7, BullMQ, Playwright
- **Database**: PostgreSQL 16, Redis 7
- **Language**: TypeScript 5

## Notes

- UI language is Portuguese (pt-BR)
- Geographic focus: Mato Grosso do Sul (UFMS, UCDB, UEMS, IFMS)
- LinkedIn worker requires browser session with saved cookies
- No test suite implemented yet
