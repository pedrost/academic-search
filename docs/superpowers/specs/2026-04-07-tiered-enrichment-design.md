# Tiered Enrichment Architecture — Hunter

**Date:** 2026-04-07  
**Status:** Approved  
**Scope:** FREE tier first (Lattes + LinkedIn with real credentials), API and AI tiers wired but not primary

---

## 1. Overview

Hunter enriches Brazilian academic profiles with employment data. The current system uses a single path (Grok-4 AI + web search) which costs ~$0.20/academic — prohibitive at 100k–1M scale.

This design replaces that with a **tiered enrichment system** where the caller selects the cost/reliability trade-off:

| Tier | Cost/Academic | Time/Academic | Reliability | Primary Sources |
|------|--------------|---------------|-------------|-----------------|
| `FREE` | ~$0.001 | 30s–5min | Medium | CNPq Lattes + LinkedIn Playwright (real session) |
| `API`  | ~$0.01   | 5–15s        | High        | SerpAPI + Proxycurl + Gemini Flash |
| `AI`   | ~$0.15–0.25 | 2–5min    | Medium      | Grok-4 × 3 calls + web search (current) |

At 1M academics: FREE = ~$1,000 · API = ~$15,000 · AI = ~$200,000.

---

## 2. Architecture

```
Client Request (tier + identifier + context)
         │
         ▼
  Enrichment Queue (BullMQ)
         │
         ▼
    Tier Router
   ┌─────┼──────┐
   ▼     ▼      ▼
 FREE   API    AI
   │     │      │
   ▼     ▼      ▼
 Lattes  SerpAPI  Grok-4 Discovery
 LinkedIn Proxycurl Grok-4 Enrichment
 (real   Gemini   Grok-4 LinkedIn
 session) Flash   (existing pipeline)
   │     │      │
   └─────┴──────┘
         │
         ▼
    PostgreSQL
    (Academic.enrichmentTier stored)
```

Identity data (CAPES/Sucupira, BDTD, UFMS) is unchanged — scraped for free on schedule, feeding the Academic table that enrichment reads from.

---

## 3. API Contract

### 3.1 Single Academic Discovery (existing endpoint, extended)

```
GET /api/discover-academic

Identifier — one required:
  ?id=<cuid>              Academic ID (precise, skips identity resolution)
  ?name=<string>          Name search (may match multiple — use context to narrow)

Enrichment tier (required):
  &tier=FREE | API | AI

Context filters (optional — injected into all search queries):
  &state=<string>         e.g. "MS"
  &city=<string>          e.g. "Campo Grande"
  &institution=<string>   e.g. "UFMS"

Response: SSE stream
  data: {"phase":"discovery","status":"start"}
  data: {"phase":"lattes","status":"complete","found":true}        // FREE
  data: {"phase":"linkedin","status":"start"}
  data: {"phase":"done","status":"success","academic":{...},
         "enrichmentTier":"FREE","estimatedCost":"$0.001","durationMs":42000}
  data: {"phase":"done","status":"not_found","reason":"..."}
  data: {"phase":"error","status":"error","message":"..."}
```

### 3.2 Bulk Enrichment (new endpoint)

```
POST /api/admin/enrich

Body:
{
  "tier": "FREE" | "API" | "AI",          // required
  "target": "all" | "pending" | ["id1"],  // required
  "filters": {                             // optional — selects which academics to process
    "state": "MS",
    "city": "Campo Grande",
    "institution": "UFMS"
  },
  "limit": 1000                            // optional, default 100
}

Response: SSE stream
  data: {"phase":"queued","count":1000,"estimatedCost":"~$1.00","estimatedTime":"~16min"}
  data: {"phase":"progress","done":42,"total":1000,"errors":2}
  data: {"phase":"done","enriched":998,"failed":2,"durationMs":960000}
```

---

## 4. Data Model Changes

### 4.1 New enum

```prisma
enum EnrichmentTier {
  FREE
  API
  AI
}
```

### 4.2 Academic model additions

```prisma
model Academic {
  // ... existing fields ...
  enrichmentTier   EnrichmentTier?  @map("enrichment_tier")
  lattesId         String?          @map("lattes_id")    // 16-digit CNPq ID
  lattesUrl        String?          @map("lattes_url")   // already exists
}
```

### 4.3 New job type in enrichment queue

```typescript
type TieredEnrichJobData = {
  academicId: string
  tier: 'FREE' | 'API' | 'AI'
  context: {
    name?: string       // pass when not in DB yet
    state?: string
    city?: string
    institution?: string
  }
}
```

---

## 5. Component Breakdown

### New files

| File | Purpose |
|------|---------|
| `src/lib/scrapers/lattes.ts` | Lattes scraper: Google → Lattes ID → fetch CV → parse employment |
| `src/lib/enrichment/free-tier.ts` | FREE orchestrator: Lattes then LinkedIn |
| `src/lib/enrichment/api-tier.ts` | API orchestrator: SerpAPI → Proxycurl → Gemini |
| `src/lib/enrichment/ai-tier.ts` | AI orchestrator: refactored from discover-academic |
| `src/lib/enrichment/tier-router.ts` | Routes job to correct tier function |
| `src/workers/enrichment-worker.ts` | BullMQ worker handling `tiered-enrich` jobs |
| `src/app/api/admin/enrich/route.ts` | Bulk enrich endpoint (SSE) |

### Modified files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `EnrichmentTier` enum + `enrichmentTier` + `lattesId` fields |
| `src/app/api/discover-academic/route.ts` | Add `?tier`, `?id`, `?state`, `?city`, `?institution` params |
| `src/lib/queue/jobs.ts` | Add `queueTieredEnrich()` helper |
| `src/workers/index.ts` | Register enrichment worker |

---

## 6. FREE Tier — Detailed Design

### 6.1 Lattes Strategy (CAPTCHA Avoidance)

**Key insight:** CAPTCHAs appear on `buscatextual.cnpq.br/buscatextual/busca.do` (the search UI). Individual CV pages at `buscatextual.cnpq.br/buscatextual/visualizacv.do?id={16-digit-id}` load without CAPTCHA.

**Strategy: Google → Lattes ID → direct CV fetch**

```
Step 1: Google search via Playwright stealth browser
  Query: "{name}" "{institution}" site:lattes.cnpq.br
  Fallback: "{name}" lattes cnpq "{state}"
  Parse result URLs for 16-digit numeric IDs (pattern: /\d{16}/)

Step 2: Direct CV fetch (no CAPTCHA)
  URL: http://buscatextual.cnpq.br/buscatextual/visualizacv.do?id={lattesId}
  This page requires no auth and no CAPTCHA in normal conditions.

Step 3: Parse employment section
  Look for: "Atuação Profissional", "Vínculo empregatício"
  Extract: current employer, job title, start date
  Also extract: research areas ("Grande área", "Área"), highest degree
```

**Why this avoids CAPTCHA:** We never hit the CNPq search interface. Google search at 1–2 queries/minute is well within normal human behavior — stealth browser + pt-BR locale + Campo Grande timezone make it indistinguishable from a real user browsing Google.

**Rate limiting:** 8–15s random delay between academics. Google will not rate-limit at this pace.

### 6.2 LinkedIn Strategy (Real Credentials)

**Key insight:** LinkedIn's anti-bot detection is session-based. A logged-in session with saved cookies that behaves like a real user is very hard to detect. The existing cookie persistence in Redis (`linkedin:cookies`) is the right foundation.

**Behavior rules to appear human:**
- 15–30s random delay between profile views (vs. current 5s)
- Limit to 50 profile views per session, then pause 2 hours
- After searching, scroll the results page before clicking
- Navigate to profile via the search result, don't jump directly to URL
- If redirected to `/checkpoint/` or `/login`, stop immediately — session expired

**Session management:**
- Cookies stored in Redis (existing `linkedin-auth.ts`)
- On session expiry: mark as `LOGIN_EXPIRED` task in EnrichmentTask, do not retry
- Admin refreshes session via existing `/admin/linkedin` panel

**Confidence thresholds:**
- Only store a LinkedIn match if name similarity > 80% and location/institution matches
- Store `confidence` in `grokMetadata` for audit

### 6.3 FREE Tier Orchestration Flow

```
freeTierEnrich(academicId, context):
  1. Load academic from DB (name, institution, state, city, graduationYear)
  2. Merge context filters (override empty fields only)

  Phase 1: Lattes
  ├── Search Google for Lattes ID
  ├── If found: fetch visualizacv page, parse employment + research areas
  ├── Store lattesId + lattesUrl on academic
  └── Update: researchField, currentJobTitle, currentCompany, currentState, currentCity

  Phase 2: LinkedIn (only if employment still unknown after Lattes)
  ├── Check session is alive
  ├── Search LinkedIn: "{name} {institution}"
  ├── Score candidates by name similarity + location
  ├── If best candidate > threshold: extract profile
  └── Update: currentJobTitle, currentCompany, currentSector, linkedinUrl

  Phase 3: Save
  ├── Update enrichmentStatus: COMPLETE | PARTIAL
  ├── Store enrichmentTier: FREE
  └── Update lastEnrichedAt
```

---

## 7. API Tier — Design

```
apiTierEnrich(academicId, context):
  1. Load academic from DB
  2. SerpAPI search: "{name} {institution} linkedin" → extract LinkedIn URL from results
  3. If LinkedIn URL found: Proxycurl profile fetch → employment data
  4. If name is ambiguous (common name): Gemini Flash to pick best match from SerpAPI results
  5. Save results
```

**Env vars needed:** `SERPAPI_KEY`, `PROXYCURL_KEY`, `GEMINI_API_KEY`

---

## 8. AI Tier — Design

Refactored from existing `discover-academic` route. Same 3-call Grok-4 pipeline, extracted into a reusable function:

```
aiTierEnrich(academicId, context):
  1. Load academic from DB (or use context.name if not in DB yet)
  2. Grok-4 Discovery (web search)
  3. Grok-4 Enrichment (LinkedIn URL + current job)
  4. Grok-4 LinkedIn Extract (career timeline)
  5. Save with tier=AI
```

---

## 9. Cost & Time Reference

### Per academic

| Tier | Cost | Happy path | With failure |
|------|------|-----------|--------------|
| FREE | ~$0.001 | 30–60s | 2–5 min |
| API  | ~$0.01  | 5–15s  | 15–30s  |
| AI   | ~$0.15–0.25 | 2–5 min | 2–5 min |

### At scale (1 worker)

| Tier | 100k cost | 1M cost | 100k time | 1M time |
|------|-----------|---------|-----------|---------|
| FREE | ~$100 | ~$1,000 | ~3 days | ~3 weeks |
| API  | ~$1,500 | ~$15,000 | ~7 hrs | ~3 days |
| AI   | ~$20,000 | ~$200,000 | ~1 month | ~6 months |

*Pricing references: xAI grok-4-0709 (~$3/M input, ~$15/M output), SerpAPI (~$0.005/query at volume), Proxycurl (~$0.01/profile), 2captcha ($0.001/image CAPTCHA). All prices approximate and subject to change.*

---

## 10. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| LinkedIn bans Playwright session | High | Real credentials + 15–30s delays + 50 profiles/session cap + immediate stop on /checkpoint redirect |
| Lattes CV structure changes | Medium | Selector-based parsing with multiple fallback patterns; log parse failures |
| Google CAPTCHA on Lattes ID search | Low | At 1–2 searches/min with pt-BR stealth browser, Google rarely triggers CAPTCHA; 2captcha as last resort |
| CNPq direct page changes | Low | Monitor HTTP 403/404 on visualizacv endpoint; fall back to Lattes search UI with 2captcha |
| Grok-4 hallucinated LinkedIn URLs | Medium | URL format validation already in `mapper.ts`; always validate before storing |
| Proxycurl/SerpAPI pricing changes | Low | Pricing hardcoded only in this doc; code uses env vars |
| Common name ambiguity | Medium | Context filters (state/city/institution) injected into every search; name similarity scoring for LinkedIn |

---

## 11. Implementation Order

1. Schema migration (`EnrichmentTier` enum + `lattesId` field)
2. Lattes scraper (`src/lib/scrapers/lattes.ts`)
3. FREE tier orchestrator (`src/lib/enrichment/free-tier.ts`)
4. API tier stub (`src/lib/enrichment/api-tier.ts`)
5. AI tier refactor (`src/lib/enrichment/ai-tier.ts`)
6. Tier router (`src/lib/enrichment/tier-router.ts`)
7. BullMQ enrichment worker (`src/workers/enrichment-worker.ts`)
8. Updated discover-academic route
9. Bulk enrich endpoint (`src/app/api/admin/enrich/route.ts`)
10. Queue job helpers + worker registration
