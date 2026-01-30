# Frontend V2 Design

**Date:** 2026-01-29
**Status:** Approved
**Priority:** High

## Overview

Complete frontend redesign focusing on search UX and academic profiles. Migrating from Shadcn/Radix to NextUI for richer visual design with data-dense, professional, vibrant aesthetic.

## Technology & Design System

### UI Foundation
- **NextUI v2** - Primary component library
- **Tailwind CSS** - Custom styling
- **Framer Motion** - Page transitions and animations

### Color Palette
```
Primary:    Blue (#0066CC) - Trust, academic
Secondary:  Emerald (#10B981) - Success, enriched
Warning:    Amber (#F59E0B) - Partial enrichment
Danger:     Rose (#F43F5E) - Errors
Accent:     Violet (#8B5CF6) - Interactive elements
```

### Typography
- Headlines: **Inter** (clean, professional)
- Body: **Geist Sans** (current)
- Monospace: Technical data, IDs

### Component Migration

| Current (Shadcn) | New (NextUI) |
|------------------|--------------|
| Card | NextUI Card with blur/glass variants |
| Button | NextUI Button with loading states |
| Input | NextUI Input with clear button |
| Select | NextUI Autocomplete (searchable) |
| Checkbox | NextUI Checkbox with custom colors |
| Badge | NextUI Chip with variants |
| Table | NextUI Table with sorting |

---

## Search Interface Redesign

### Layout (Desktop)
```
┌─────────────────────────────────────────────────────────┐
│  Hero (compact): Title + quick stats (total academics)  │
├────────────┬────────────────────────────────────────────┤
│            │  Sort: [Relevance ▼]  View: [Grid][List]   │
│  Filters   ├────────────────────────────────────────────┤
│  Sidebar   │                                            │
│  (sticky)  │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│            │   │Card │ │Card │ │Card │ │Card │        │
│  ┌───────┐ │   └─────┘ └─────┘ └─────┘ └─────┘        │
│  │Search │ │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│  └───────┘ │   │Card │ │Card │ │Card │ │Card │        │
│  Field  ▼  │   └─────┘ └─────┘ └─────┘ └─────┘        │
│  Degree ▼  │                                            │
│  City   ▼  │  ◀ 1 2 3 ... 24 ▶   Showing 1-20 of 472   │
│  Sector ▼  └────────────────────────────────────────────┤
│  Year ──●──│                                            │
│            │                                            │
│ [Clear All]│                                            │
└────────────┴────────────────────────────────────────────┘
```

### Filter Behavior (Instant Search)
- Text input: 300ms debounce, then auto-search
- Dropdowns/checkboxes: Immediate search on change
- Active filters shown as removable chips above results
- "Clear all filters" button when any filter active
- URL params sync (shareable search URLs)

### Loading States
- Skeleton cards during fetch (not spinner)
- Subtle pulse animation on skeletons
- Keep previous results visible while loading (opacity fade)

### Empty State
- Friendly illustration
- "No academics found matching your criteria"
- Suggestions with quick-remove filter buttons

---

## Academic Card Redesign

### Card Layout
```
┌──────────────────────────────────────────────────┐
│ ┌──┐  Pedro Sturmer              ◉ Complete     │
│ │PS│  Professor @ UFMS           ───────────────│
│ └──┘  Campo Grande, MS                          │
├──────────────────────────────────────────────────┤
│  🏷 PhD  │  🔬 Computer Science  │  📄 3 pubs   │
├──────────────────────────────────────────────────┤
│  "Machine learning applications in agricultural │
│   data analysis for precision farming..."       │
├──────────────────────────────────────────────────┤
│  [View Profile]  [⚡ Enrich]           2019     │
└──────────────────────────────────────────────────┘
```

### Visual Elements

| Element | Design |
|---------|--------|
| Avatar placeholder | Gradient circle with initials |
| Enrichment status | Chip: Green "Complete" / Amber "Partial" / Gray "Pending" |
| Degree badge | Colored chip: Blue (Masters), Violet (PhD), Emerald (PostDoc) |
| Sector indicator | Icon + text: 🏛 Academia, 🏢 Private |
| Publication count | Small badge with number |
| Quick actions | Ghost buttons, "Enrich" only if status != Complete |
| Hover state | Subtle lift (shadow + translate-y), border highlight |

### Card Variants
- **Grid view**: Compact cards (4 per row desktop)
- **List view**: Horizontal layout, more text visible

---

## Academic Profile Page

### Layout with Tabs
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Search                                           │
├─────────────────────────────────────────────────────────────┤
│  ┌────┐                                                     │
│  │ PS │  Pedro Sturmer                    ◉ Complete        │
│  └────┘  Professor Adjunto @ UFMS                           │
│          Campo Grande, MS · Academia                        │
│                                                             │
│          [LinkedIn] [Lattes] [Email]     [⚡ Re-enrich]     │
├─────────────────────────────────────────────────────────────┤
│  [Overview]  [Timeline]  [Publications]  [Enrichment Log]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  (Tab content area)                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tab: Overview
- Key stats cards: Degree, Field, Graduation Year, Institution
- Current employment details
- Research interests/keywords cloud
- Latest dissertation summary

### Tab: Timeline
- Unified vertical timeline with icons per event type
- Filter by: Academic / Employment / Publications
- Events sorted newest-first, with year markers

### Tab: Publications
- Table/list of all dissertations
- Columns: Title, Year, Type, Abstract preview
- Click to expand full abstract

### Tab: Enrichment Log
- History of enrichment searches
- Raw data from each attempt
- Confidence scores, sources used

---

## Timeline Visualization

### Visual Design
```
          2024  ─────────────────────────────────────
                    ┌─────────────────────────────┐
              🏢    │ Professor Adjunto @ UFMS    │
                    │ Campo Grande, MS            │
                    └─────────────────────────────┘
          2021  ─────────────────────────────────────
                    ┌─────────────────────────────┐
              📄    │ "Machine Learning for..."   │
                    │ PhD Dissertation · UFMS     │
                    └─────────────────────────────┘
          2019  ─────────────────────────────────────
                    ┌─────────────────────────────┐
              🎓    │ PhD in Computer Science     │
                    │ Defended · UFMS             │
                    └─────────────────────────────┘
```

### Event Types & Colors

| Type | Icon | Color | Source |
|------|------|-------|--------|
| Degree completion | 🎓 | Violet | Database (graduation_year) |
| Dissertation | 📄 | Blue | Database (dissertations) |
| Employment | 🏢 | Emerald | Grok enrichment |
| Award/Recognition | 🏆 | Amber | Grok enrichment |

### Interactions
- Click event card to expand details
- Filter toggles: Show/hide event types
- Animate in on tab switch (stagger from top)

---

## Inline Enrichment Flow

### Trigger Points
- "Enrich" button on academic cards
- "Re-enrich" button on profile header
- Bulk action from search results

### Progress UI
```
┌─────────────────────────────────────────────────────────┐
│  ⚡ Enriching Pedro Sturmer...                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [============================          ] 70%           │
│                                                         │
│  ✓ Searching web for employment info                    │
│  ✓ Searching X/Twitter for recent activity              │
│  ● Parsing and validating results...                    │
│  ○ Updating profile                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### States

| State | UI |
|-------|-----|
| Idle | Button shows "Enrich" |
| Loading | Modal/drawer with progress steps |
| Success | Toast: "Found 5 new data points" + refresh |
| Partial | Toast: "Found employment, couldn't verify social links" |
| Error | Toast: "Enrichment failed" with retry button |

### After Enrichment
- Card/profile updates in-place (no page reload)
- New data highlighted briefly (pulse animation)
- Enrichment status chip updates automatically
- Timeline gets new events if employment found

**Note:** UI labels use generic "Enrich" terminology, not "Grok" branding.

---

## Implementation

### New Dependencies
```bash
npm install @nextui-org/react framer-motion
```

### Files to Create/Modify

| File | Action |
|------|--------|
| `tailwind.config.ts` | Add NextUI plugin + custom colors |
| `src/app/providers.tsx` | Add NextUIProvider wrapper |
| `src/components/search-v2/` | New search components |
| `src/components/profile-v2/` | New profile components |
| `src/components/ui-v2/` | Shared NextUI wrappers |
| `src/hooks/useDebounce.ts` | Debounce hook for instant search |
| `src/hooks/useEnrichment.ts` | Enrichment mutation + progress |
| `src/app/page.tsx` | Swap to v2 components |
| `src/app/academic/[id]/page.tsx` | Swap to v2 profile |

### Migration Strategy
1. Build v2 components alongside existing
2. Feature flag to switch between v1/v2
3. Remove v1 once v2 is validated

---

## Implementation Tasks

1. Install NextUI and configure Tailwind
2. Set up NextUIProvider in app providers
3. Create custom color theme
4. Build search filter sidebar (v2)
5. Build academic card component (v2)
6. Build skeleton loading cards
7. Implement instant search with debouncing
8. Add grid/list view toggle
9. Build profile page header
10. Build profile tabs (Overview, Timeline, Publications, Enrichment Log)
11. Build timeline visualization component
12. Build enrichment progress modal
13. Create useEnrichment hook with progress tracking
14. Integrate enrichment flow with cards and profile
15. Add URL param sync for shareable searches
16. Remove v1 components after validation
