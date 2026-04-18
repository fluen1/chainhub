# UI Migration: Priority Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 6 priority prototype pages from `/proto/*` to production routes under `/(dashboard)/*`. Replace mock data with real Prisma queries via existing Server Actions. Add auth/permission checks. Connect AI-output fields (DocumentExtraction) to UI components. Each page should look identical to the prototype but show real data.

**Architecture:** Each migration follows the same pattern: (1) Read the proto page to understand the design, (2) Read the existing production page to understand what data fetching exists, (3) Create a new page that combines proto's visual design with production's data layer, (4) Add getServerSession + permission checks, (5) Delete the old production page. Pages are Server Components where possible (no `'use client'` unless needed for interactivity).

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5, Tailwind CSS, Prisma 5, NextAuth 4, existing Server Actions in `src/actions/`.

---

## Scope

### In scope (this plan — 6 priority pages)

1. `/documents` (list) — shows real documents with AI review status from DocumentExtraction
2. `/documents/review/[id]` — split-panel AI review wired to real DocumentExtraction data
3. `/contracts` (list + matrix) — shows real contracts with urgency + coverage matrix
4. `/contracts/[id]` (detail) — shows real contract with AI key terms from DocumentExtraction
5. `/portfolio` (list + map) — shows real companies with health status
6. `/portfolio/[id]` (detail) — shows real company with AI insights

### Out of scope (future plans)

- `/dashboard` — separate plan
- `/tasks`, `/tasks/[id]` — separate plan
- `/calendar` — separate plan
- `/search` — separate plan
- `/settings` — separate plan
- Sidebar/header redesign — separate plan

### Prerequisites

- Plan 1 + Plan 2 completed (AI infrastructure in place)
- Existing Server Actions working (companies, contracts, documents)
- NextAuth configured with session.user.organizationId

---

## Migration Pattern (applies to ALL pages)

Every page migration follows this pattern:

### Step 1: Understand the proto page

Read `src/app/proto/[module]/page.tsx`. Note:

- What mock data it imports (e.g., `getCompanies` from `@/mock/companies`)
- What components it renders
- What interactivity it has (useState, filters, toggles)

### Step 2: Understand the production page

Read `src/app/(dashboard)/[module]/page.tsx`. Note:

- How it fetches data (Server Action or direct Prisma)
- What session/permission checks exist
- What shared components it uses (Pagination, SearchAndFilter, etc.)

### Step 3: Create the new page

Combine proto's visual design with production's data layer:

- Keep proto's JSX structure and Tailwind classes
- Replace mock imports with Prisma queries or Server Action calls
- Add `getServerSession` for auth
- Add `canAccessCompany`/`canAccessModule` for permissions
- Use Server Components where possible
- Client Components only for interactive parts (filters, toggles, modals)

### Step 4: Handle AI data

For pages that show AI results:

- Query `DocumentExtraction` alongside the main entity
- If extraction exists → show AI hero cards, confidence levels
- If no extraction → show fallback (no AI card, just regular data)
- Graceful degradation is critical: pages must work WITHOUT AI data

### Step 5: Clean up

- Delete old production page (or rename as backup)
- Update any imports/links that pointed to old page
- Verify navigation works

---

## Tasks

### Task 1: Documents list page

**Files:**

- Read: `src/app/proto/documents/page.tsx` (proto design)
- Read: `src/app/(dashboard)/documents/page.tsx` (current production)
- Read: `src/actions/documents.ts` (existing actions)
- Modify: `src/app/(dashboard)/documents/page.tsx` (replace with proto design + real data)

**Migration steps:**

- [ ] Read proto page and note all mock imports
- [ ] Read production page and note data fetching pattern
- [ ] Read `src/actions/documents.ts` for available functions
- [ ] Replace production page with proto design
- [ ] Replace `getDocuments(dataScenario)` → `prisma.document.findMany({ where: { organization_id, deleted_at: null } })`
- [ ] Replace `getDocumentsAwaitingReview()` → `prisma.document.findMany({ where: { ...existingFilters }, include: { extraction: true } })` and filter by `extraction.extraction_status`
- [ ] Replace `getDocumentsProcessing()` → filter documents by upload status or extraction status
- [ ] Remove `usePrototype()` — get session via `getServerSession(authOptions)`
- [ ] Add `canAccessModule(session.user.id, 'documents')` check
- [ ] Keep interactive parts (filters, drag-drop, search) as Client Component
- [ ] Extract data fetching to Server Component wrapper
- [ ] Test: page loads with real data, filters work, AI status badges show
- [ ] Commit

### Task 2: Document review page

**Files:**

- Read: `src/app/proto/documents/review/[id]/page.tsx`
- Modify: `src/app/(dashboard)/documents/[id]/page.tsx` (or create review route)
- Read: `src/actions/documents.ts`

**Migration steps:**

- [ ] Read proto review page (split-panel, confidence levels, decision tracking)
- [ ] This page needs DocumentExtraction data: `prisma.documentExtraction.findUnique({ where: { document_id } })`
- [ ] The `extracted_fields` JSON contains the structured extraction from the pipeline
- [ ] Map `extracted_fields` to the review UI's "Kræver opmærksomhed" / "Høj konfidence" sections
- [ ] Wire "Brug AI-værdi" / "Behold eksisterende" buttons to `logFieldCorrection()` from `src/lib/ai/feedback.ts`
- [ ] Wire "Godkend" button to update `DocumentExtraction.reviewed_by` and `reviewed_at`
- [ ] Wire field decision tracking to `DocumentExtraction.field_decisions` JSON
- [ ] The mock PDF preview blocks can remain as placeholder (real PDF rendering is future work)
- [ ] Graceful degradation: if no DocumentExtraction exists, show "Ikke AI-behandlet" message
- [ ] Commit

### Task 3: Contracts list page

**Files:**

- Read: `src/app/proto/contracts/page.tsx`
- Read: `src/app/(dashboard)/contracts/page.tsx`
- Read: `src/actions/contracts.ts`
- Modify: `src/app/(dashboard)/contracts/page.tsx`

**Migration steps:**

- [ ] Read proto page (pinned urgency + flat table + coverage matrix)
- [ ] Replace `getContracts(dataScenario)` → Prisma query with org_id + deleted_at filter
- [ ] Derive urgency status from real contract fields (status, expiry_date)
- [ ] Coverage matrix: query all companies + their contracts, check for missing required types
- [ ] Keep the 5-column table (Kontrakt, Selskab, Kategori, Udløber, Status)
- [ ] Keep sticky headers, zone-separators, content-visibility, scroll-to-top
- [ ] Add session + permission checks
- [ ] Commit

### Task 4: Contract detail page

**Files:**

- Read: `src/app/proto/contracts/[id]/page.tsx`
- Read: `src/app/(dashboard)/contracts/[id]/page.tsx` (if exists)
- Modify: `src/app/(dashboard)/contracts/[id]/page.tsx`

**Migration steps:**

- [ ] Read proto page (AI key terms hero, sidebar nav, 4 sections)
- [ ] Fetch contract: `prisma.contract.findUnique({ where: { id, organization_id }, include: { company: true, parties: true, versions: true } })`
- [ ] Fetch DocumentExtraction for this contract's document (if linked)
- [ ] If extraction exists → populate AI key terms hero card from `extracted_fields`
- [ ] If no extraction → show header without AI hero, just basic contract data
- [ ] Related sager: `prisma.caseContract.findMany({ where: { contract_id } })`
- [ ] Related opgaver: `prisma.task.findMany({ where: { company_id: contract.company_id } })`
- [ ] Dokumenter: `prisma.document.findMany({ where: { company_id: contract.company_id } })`
- [ ] Add session + permission checks
- [ ] Commit

### Task 5: Portfolio list page (selskaber)

**Files:**

- Read: `src/app/proto/portfolio/page.tsx`
- Read: `src/app/(dashboard)/companies/page.tsx`
- Modify: `src/app/(dashboard)/companies/page.tsx`

**Migration steps:**

- [ ] Read proto page (geo map + list toggle + filter pills)
- [ ] Replace `getCompanies()` → `prisma.company.findMany({ where: { organization_id, deleted_at: null }, include: { _count: { select: { contracts: true, cases: true } } } })`
- [ ] Derive health status from real data (expired contracts, open cases, EBITDA trends)
- [ ] City positions for map: hardcode CITY_POSITIONS mapping (same as proto)
- [ ] Keep filter pills, view toggle, "Opret lokation" CTA
- [ ] Keep geo map with clustering logic
- [ ] Add session + permission checks via `getAccessibleCompanies()`
- [ ] Commit

### Task 6: Portfolio detail page (selskab)

**Files:**

- Read: `src/app/proto/portfolio/[id]/page.tsx`
- Read: `src/app/(dashboard)/companies/[id]/page.tsx` (main tabs page)
- Modify: `src/app/(dashboard)/companies/[id]/page.tsx`

**Migration steps:**

- [ ] Read proto page (sticky sidebar, AI insight hero, 9 sections)
- [ ] This is the most complex migration — the existing production page has multiple tabs
- [ ] Approach: replace the main overview tab with proto design, keep existing tab structure
- [ ] Fetch company with all relations: contracts, cases, tasks, persons, visits, documents, financial metrics
- [ ] Fetch company AI insight from `company.ai_insight` field (null until insights system is built)
- [ ] If ai_insight exists → show AI hero card
- [ ] If not → show health dimensions without AI recommendation
- [ ] Derive health dimensions from real data (same logic as proto but against real counts)
- [ ] Sections: ownership (from Ownership model), contracts, finance, cases, tasks, persons, visits, documents, activity
- [ ] Add permission checks: `canAccessCompany(session.user.id, companyId)`
- [ ] Commit

### Task 7: Validation + cleanup

- [ ] Run full test suite: `npm test`
- [ ] Run typecheck: `npx tsc --noEmit`
- [ ] Run build: `npm run build`
- [ ] Manual test: navigate to each page, verify data loads
- [ ] Verify links between pages work (click company → contract → document → review)
- [ ] Push to remote

---

## Important patterns to follow

### Auth pattern (existing in codebase)

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const orgId = session.user.organizationId
  // ... fetch data with orgId filter
}
```

### Permission pattern

```typescript
import { canAccessCompany, canAccessModule } from '@/lib/permissions'

// Module access
const hasAccess = await canAccessModule(session.user.id, 'contracts')
if (!hasAccess) redirect('/dashboard')

// Company access (for detail pages)
const canAccess = await canAccessCompany(session.user.id, companyId)
if (!canAccess) notFound()
```

### Mixed Server/Client Components

```typescript
// page.tsx (Server Component — fetches data)
export default async function ContractsPage() {
  const session = await getServerSession(authOptions)
  const contracts = await prisma.contract.findMany({ where: { organization_id: session.user.organizationId } })
  return <ContractsClient contracts={contracts} />
}

// contracts-client.tsx (Client Component — handles interactivity)
'use client'
export function ContractsClient({ contracts }: { contracts: Contract[] }) {
  const [filter, setFilter] = useState('all')
  // ... interactive UI
}
```

### AI data graceful degradation

```typescript
// Fetch extraction alongside document
const document = await prisma.document.findUnique({
  where: { id },
  include: { extraction: true },
})

// In component
{document.extraction ? (
  <AIKeyTermsHero extraction={document.extraction} />
) : (
  <p className="text-[12px] text-slate-400">Ikke AI-behandlet endnu</p>
)}
```

---

## Completion checklist

- [ ] All 6 pages migrated to production routes
- [ ] All pages show real data (not mock)
- [ ] Auth + permissions on every page
- [ ] AI data shown when available, graceful fallback when not
- [ ] Links between pages work (company → contract → document)
- [ ] Tests pass, typecheck clean, build succeeds
- [ ] Pushed to remote

## What comes next

**Plan 4: Secondary pages** — dashboard, tasks, calendar, search, settings migration
**Plan 5: Insights system** — Haiku-based company/contract insights cached in DB
**Plan 6: Søg & Spørg AI** — RAG pipeline with pgvector
