# Grok Academic Search Integration

**Date:** 2026-01-29
**Status:** Approved
**Priority:** High

## Overview

On-demand enrichment endpoint that uses xAI's Grok API to find current professional information about academics in our database.

**Endpoint:** `GET /api/search-academic?name=Pedro%20Sturmer`

**Flow:**
```
Request → Validate academic exists → Build Grok prompt → Call xAI API
→ Parse JSON response → Upsert academic + store overflow in JSONB → Return updated profile
```

## Data Priority

1. **Employment** (highest) - Current job title, company/institution, sector, location
2. **Professional** - Publications, research projects, conferences, awards
3. **Social/Contact** - LinkedIn, Twitter/X, Lattes CV, personal website, email

## API Design

### Request

```
GET /api/search-academic?name=Pedro%20Sturmer
GET /api/search-academic?academicId=clx123...
```

**Parameters:**
- `name` (required if no academicId) - Academic name to search
- `academicId` (optional) - Specific academic record to enrich

### Response

Returns updated academic record with enrichment data.

```json
{
  "id": "clx123...",
  "name": "Pedro Sturmer",
  "currentJobTitle": "Professor",
  "currentCompany": "UFMS",
  "currentSector": "ACADEMIA",
  "grokMetadata": {
    "publications": ["..."],
    "conferences": ["..."],
    "sources": ["https://..."]
  },
  "grokEnrichedAt": "2026-01-29T15:30:00Z"
}
```

## Grok Prompt Design

### System Prompt

```
You are a research assistant finding current professional information about Brazilian academics.
Return ONLY valid JSON matching the schema provided. No markdown, no explanation.
```

### User Prompt Template

```
Find current information about this academic researcher:

Name: {name}
Known institution: {institution}
Graduation year: {graduationYear}
Research field: {researchField}
Dissertation: {dissertationTitle}

Search for:
1. PRIORITY: Current employment (job title, company/institution, sector)
2. Recent publications, research projects, conference presentations
3. Social profiles (LinkedIn, Twitter/X, Lattes CV, personal website, email)

Focus on Brazilian academic and professional sources.
Return JSON matching this schema:
{jsonSchema}
```

### Expected JSON Schema

```typescript
{
  employment: {
    jobTitle: string | null,
    company: string | null,
    sector: "ACADEMIA" | "GOVERNMENT" | "PRIVATE" | "NGO" | null,
    city: string | null,
    state: string | null,
    confidence: "high" | "medium" | "low"
  },
  professional: {
    recentPublications: string[],
    researchProjects: string[],
    conferences: string[],
    awards: string[]
  },
  social: {
    linkedinUrl: string | null,
    twitterHandle: string | null,
    lattesUrl: string | null,
    personalWebsite: string | null,
    email: string | null
  },
  sources: string[]
}
```

## Database Changes

### Schema Migration

```prisma
model Academic {
  // ... existing fields ...

  grokMetadata     Json?     @map("grok_metadata")
  grokEnrichedAt   DateTime? @map("grok_enriched_at")
}
```

### Field Mapping

| Grok Response | Database Column | Overflow to grokMetadata |
|---------------|-----------------|--------------------------|
| employment.jobTitle | currentJobTitle | No |
| employment.company | currentCompany | No |
| employment.sector | currentSector | No |
| employment.city | currentCity | No |
| employment.state | currentState | No |
| social.linkedinUrl | linkedinUrl | No |
| social.lattesUrl | lattesUrl | No |
| social.email | email | No |
| professional.* | - | Yes |
| social.twitterHandle | - | Yes |
| social.personalWebsite | - | Yes |
| sources | - | Yes |

**Rule:** Only store in `grokMetadata` what cannot be mapped to existing columns.

## Implementation Structure

### New Files

```
src/
├── lib/
│   └── grok/
│       ├── client.ts        # xAI API client wrapper
│       ├── prompts.ts       # Prompt templates
│       └── mapper.ts        # Map Grok response → Academic fields
└── app/api/
    └── search-academic/
        └── route.ts         # GET endpoint
```

### API Route Flow

```typescript
// GET /api/search-academic?name=Pedro%20Sturmer

1. Parse & validate query params
2. Find academic by name (or academicId if provided)
3. If not found → return 404
4. Build prompt with academic's known data
5. Call Grok API with web_search + x_search tools
6. Parse JSON response
7. Map known fields → update Academic record
8. Store unmapped fields → grokMetadata
9. Set grokEnrichedAt = now()
10. Return updated academic
```

## xAI API Integration

### Configuration

```typescript
const XAI_BASE_URL = "https://api.x.ai/v1"

const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "grok-4-1-fast",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    tools: [
      { type: "web_search" },
      { type: "x_search" }
    ],
    temperature: 0.1,
    response_format: { type: "json_object" }
  })
})
```

### Settings

| Setting | Value | Reason |
|---------|-------|--------|
| model | `grok-4-1-fast` | Best tool-calling, 2M context |
| tools | `web_search`, `x_search` | Real-time web + Twitter data |
| temperature | 0.1 | Deterministic, factual responses |
| response_format | `json_object` | Enforce JSON output |

## Environment Variables

```env
XAI_API_KEY=xai-...  # xAI API key (never commit)
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Academic not found | Return 404 |
| Grok API fails | Return 502, no database changes |
| JSON parse fails | Store raw in `grokMetadata.rawError`, return partial success |
| Grok returns empty | Update `grokEnrichedAt`, leave other fields unchanged |

## Implementation Tasks

1. Add `grokMetadata` and `grokEnrichedAt` to Prisma schema
2. Run migration
3. Create `src/lib/grok/client.ts` - xAI API wrapper
4. Create `src/lib/grok/prompts.ts` - Prompt templates
5. Create `src/lib/grok/mapper.ts` - Response → Academic field mapper
6. Create `src/app/api/search-academic/route.ts` - API endpoint
7. Add `XAI_API_KEY` to `.env`
8. Test with sample academics
9. Add "Enrich with Grok" button to frontend (future)
