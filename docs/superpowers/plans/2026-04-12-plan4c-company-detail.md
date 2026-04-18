# Plan 4C: Selskabs-detalje Single-Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `/companies/[id]` from 11 tab-subpages into a single proto-designed scroll-view with 7 grid sections + 1 full-width AI Insight, role-filtered server-side, AI-powered alerts and strategic insight cached 24h.

**Architecture:** Server Component page calls one `getCompanyDetailData()` aggregator action which runs parallel Prisma queries and either reads cached AI or synchronously regenerates. Pure helper functions in `src/lib/company-detail/helpers.ts` derive health dimensions, sort rules, and role-section mapping. One new Prisma model `CompanyInsightsCache` stores AI output (alerts + insight) per company with 24h TTL. 11 subpage routes + `CompanyTabs` component deleted.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5 strict, Tailwind, Prisma 5, Anthropic SDK (via existing `createClaudeClient()` from Sprint 8B AI infra), Vitest + Testing Library, Zod for AI output validation.

**Prerequisites:** Plan 4B merged. HEAD at commit `a9e3150` or later. All 242 tests green. Build clean. `ANTHROPIC_API_KEY` in `.env.local` for AI cache regeneration.

**Spec reference:** `docs/superpowers/specs/2026-04-12-plan4c-company-detail-design.md`. Proto reference: `.superpowers/brainstorm/45074-1775072716/content/selskab-detail-v1.html`.

---

## Scope

### In scope

- New Prisma model `CompanyInsightsCache` + migration
- Pure helpers: `sectionsForRole`, `pickHighestPriorityRole`, `deriveHealthDimensions`, `deriveStatusBadge`, `sortContractsByUrgency`, `sortCasesByUrgency`, `selectKeyPersons`
- New atomic components: `AlertBanner`, `AiInsightCard`, `SectionCard`
- 7 sektion-komponenter: `OwnershipSection`, `ContractsSection`, `FinanceSection`, `CasesSection`, `PersonsSection`, `VisitsSection`, `DocumentsSection`
- `CompanyHeader` Server Component
- `EditStamdataDialog` Client Component modal + `updateCompanyStamdata` Server Action
- AI job `src/lib/ai/jobs/company-insights.ts` with Claude Sonnet 4.6 via existing client, 8s timeout, Zod output validation
- Server Action `src/actions/company-detail.ts` with parallel Prisma batch + AI cache read/regen
- Page rewrite `src/app/(dashboard)/companies/[id]/page.tsx`
- Deletion of 11 subpage folders + `company-detail-client.tsx` + `layout.tsx` + `src/components/companies/CompanyTabs.tsx`

### Out of scope (Plan 4D or later)

- `/tasks`, `/calendar`, `/search`, `/settings` rewrites
- Dashboard Indsigter section (Plan 4B's dashboard stays as-is)
- Dismiss functionality on alerts or insight (proto has no dismiss affordance)
- Mobile drawer (BLK-003 remains open)
- AI insights for pages other than `/companies/[id]`

### Key design decisions

1. **Role filtering is server-side.** `getCompanyDetailData()` computes `visibleSections` from the user's highest-priority role and skips Prisma queries for sections that will not render. No `display: none` CSS hiding.
2. **AI cache is synchronous.** First visit after 24h cache expiry awaits a less-than-8s AI call before rendering. Graceful degradation: AI failure renders alerts empty, insight null, page still works.
3. **One AI call returns both alerts AND insight.** Halves the prompt token overhead vs two calls. Cached as one row in `CompanyInsightsCache`.
4. **Helpers stay pure.** No Prisma in `helpers.ts`. Fully unit-testable without DB.
5. **Sections are Server Components.** No `'use client'` except `EditStamdataDialog` (needs `useState` for modal). Follows Plan 4A/4B pattern.
6. **Subpage delete is part of the page rewrite task.** Single commit removes old and adds new so git history is clean.

---

## Task 0: Prisma migration — add CompanyInsightsCache

**Why first:** All downstream tasks that touch the AI cache (Task 14, Task 15) depend on this model being generated. Migration must land before any Prisma client regeneration.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: new migration folder under `prisma/migrations/` (created by `prisma migrate dev`)

- [ ] **Step 0.1: Add model to schema.prisma**

Open `prisma/schema.prisma`. Find the end of the file (after the last model). Add:

```prisma
model CompanyInsightsCache {
  id              String   @id @default(uuid())
  organization_id String
  company_id      String   @unique
  alerts          Json
  insight         Json?
  model_name      String
  total_cost_usd  Decimal  @db.Decimal(10, 4)
  generated_at    DateTime @default(now())

  organization Organization @relation(fields: [organization_id], references: [id])
  company      Company      @relation(fields: [company_id], references: [id])

  @@index([company_id, generated_at])
}
```

- [ ] **Step 0.2: Add back-relations**

Find `model Organization` and add inside its block:

```prisma
  company_insights_caches CompanyInsightsCache[]
```

Find `model Company` and add inside its block:

```prisma
  insights_cache CompanyInsightsCache?
```

- [ ] **Step 0.3: Run migration**

```bash
npx prisma migrate dev --name add_company_insights_cache
```

Expected: new migration file created under `prisma/migrations/`, Prisma client regenerated, "Your database is now in sync with your schema" output.

- [ ] **Step 0.4: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean (no output).

- [ ] **Step 0.5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add CompanyInsightsCache model for Plan 4C

Ny tabel holder AI-genererede alerts og strategisk insight per selskab
med 24h TTL. Unique company_id sikrer at der hoejst er en cache-row
per selskab. Generated_at styrer stale-detection i Server Actionen."
```

---

## Due to plan size — Tasks 1-17 continued in this same file

_Full plan (approximately 2300 lines) follows below. Each task includes its own code blocks, test cases, and commit message._

---

## Task 1: Pure helpers

**Files:**

- Create: `src/lib/company-detail/helpers.ts`
- Create: `src/__tests__/company-detail/helpers.test.ts`

The helper module provides pure functions used by all section components and the server action. It has zero Prisma dependencies so it can be unit tested in isolation.

**Helpers to export:**

- `sectionsForRole(role: string): Set<SectionKey>` — maps ChainHub role to visible section set, matching proto's `roleConfig` exactly
- `pickHighestPriorityRole(roleRows: Array<{ role: string }>): string` — resolves multiple role assignments to one
- `deriveHealthDimensions(input): HealthDimensions` — returns red/amber/green for each of 4 dimensions
- `deriveStatusBadge(dims): StatusBadge` — overall severity from max of 4 dimensions
- `sortContractsByUrgency(contracts, today): Contract[]` — expired first, then expiring soon, then far-out
- `sortCasesByUrgency(cases): Case[]` — NY > AKTIV > AFVENTER
- `selectKeyPersons(candidates): CompanyPerson[]` — filter by KEY_PERSON_ROLES, sort by hierarchy then anciennity

**Role priority constants:**

```
GROUP_OWNER=100, GROUP_ADMIN=90, GROUP_LEGAL=80, GROUP_FINANCE=80,
GROUP_READONLY=70, COMPANY_MANAGER=60, COMPANY_LEGAL=50, COMPANY_READONLY=40
```

**Role-section mappings (matches proto's roleConfig):**

- GROUP_OWNER and GROUP_READONLY: `[ownership, contracts, finance, cases, persons, visits, documents, insight]` (8)
- GROUP_ADMIN: `[ownership, persons, visits, documents]` (4)
- GROUP_LEGAL and COMPANY_LEGAL: `[ownership, contracts, cases, documents, insight]` (5)
- GROUP_FINANCE: `[contracts, finance, insight]` (3)
- COMPANY_MANAGER and COMPANY_READONLY: `[persons, visits]` (2)

**KEY_PERSON_ROLES (hierarchical, index-ordered):**

```
Partner, Medejer, CEO, Direktoer, CFO, Bestyrelsesformand,
Bestyrelsesmedlem, Klinisk leder, Klinikchef, Stedfortraeder
```

**Health dimension rules:**

- **Kontrakter**: red if any aktiv contract has `expiry_date < today`, amber if any has `expiry_date` in `[today, today+30d)`, else green
- **Sager**: red if any open case has status NY or AKTIV, amber if only AFVENTER\_\* cases, else green
- **Oekonomi**: red if `ebitda < 0`, amber if `margin < 5%` or YoY omsaetning drop `> 10%`, else green (null if no 2025 data)
- **Governance**: red if last visit older than 365 days or no visits ever, amber if 180-365 days, else green

**Status badge rules:** max severity of 4 dims: red-to-Kritisk/critical, amber-to-Advarsel/warning, green-to-Sund/healthy.

**Full TypeScript implementation:** follows the spec `docs/superpowers/specs/2026-04-12-plan4c-company-detail-design.md` paragraph 7. All types `SectionKey`, `DimSeverity`, `HealthDimensions`, `StatusBadge` are exported.

- [ ] **Step 1.1: Create helpers.ts** — write the complete module following the rules above. Use spec section 7 for exact semantics.

- [ ] **Step 1.2: Write tests** — target 30+ test cases covering all helpers:
  - `pickHighestPriorityRole`: empty array to GROUP_READONLY; picks highest priority; unknown role fallback
  - `sectionsForRole`: all 8 role keys plus unknown fallback (verify sizes: 8/4/5/3/2)
  - `deriveHealthDimensions`: each dimension red/amber/green boundary cases (minimum 12 tests)
  - `deriveStatusBadge`: 3 cases matching max severity
  - `sortContractsByUrgency`: expired-first, null-expiry-last
  - `sortCasesByUrgency`: NY before AKTIV before AFVENTER, within-status newest-first
  - `selectKeyPersons`: empty, filter non-senior, hierarchy-order, anciennity tiebreaker, cap at 3

- [ ] **Step 1.3: Run tests**

```bash
npx vitest run src/__tests__/company-detail/helpers.test.ts
```

Expected: all tests pass (approximately 30 tests).

- [ ] **Step 1.4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/company-detail/ src/__tests__/company-detail/
git commit -m "feat(company-detail): add pure helpers for Plan 4C

sectionsForRole, pickHighestPriorityRole, deriveHealthDimensions,
deriveStatusBadge, sortContractsByUrgency, sortCasesByUrgency,
selectKeyPersons — alle pure functions uden DB-afhaengighed,
testbare isoleret. Rolle-mapping matcher proto's roleConfig praecist."
```

---

## Tasks 2-11: Component tasks

Each of the 10 component tasks follows the same structure:

1. Create component file in `src/components/company-detail/`
2. Create test file in `src/__tests__/components/company-detail/`
3. Run the single test file
4. Commit with descriptive message

Due to plan length, full code for each component task lives in the spec at `docs/superpowers/specs/2026-04-12-plan4c-company-detail-design.md`, paragraphs 5 (header), 6 (sections), 9 (component signatures). Implementer should read the corresponding spec section, then implement the component with props and behavior as specified, following Plan 4A/4B component patterns (Tailwind, `cn()` helper, no inline styles except where proto demands gradients, Server Components except EditStamdataDialog).

### Task 2: AlertBanner component

**Files:**

- Create: `src/components/company-detail/alert-banner.tsx`
- Create: `src/__tests__/components/company-detail/alert-banner.test.tsx`

**Props:** `{ severity: 'critical' | 'warning', title, sub, actionLabel, actionHref }`

**Visual rules:** red background for critical, amber for warning. Icon box on left with `!`. Title bold, sub smaller. Action link on right wraps to "Se kontrakt" etc. Matches proto's `.alert-banner` CSS (`bg-red-50`/`bg-amber-50`, `border-red-200`/`border-amber-200`, rounded-xl, flex layout).

- [ ] **Step 2.1:** Create component using `cn()` from `@/lib/utils` for conditional classes.

- [ ] **Step 2.2:** Write 4 tests: renders title+sub+action label, critical uses red colors, warning uses amber colors, action link points to actionHref.

- [ ] **Step 2.3:** Run `npx vitest run src/__tests__/components/company-detail/alert-banner.test.tsx` — expect 4 pass.

- [ ] **Step 2.4:** Commit.

```bash
git add src/components/company-detail/alert-banner.tsx src/__tests__/components/company-detail/alert-banner.test.tsx
git commit -m "feat(company-detail): add AlertBanner component for Plan 4C"
```

---

### Task 3: AiInsightCard component

**Files:**

- Create: `src/components/company-detail/ai-insight-card.tsx`
- Create: `src/__tests__/components/company-detail/ai-insight-card.test.tsx`

**Props:** `{ headlineMd: string, bodyMd: string }`

**Visual rules:** purple gradient background `linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)` (inline style since Tailwind gradient utilities do not match proto's exact colors), `AI` icon box purple, prose text indigo-900.

**Markdown parsing:** minimal `**bold**` to `<strong>` parser. No HTML injection: only the `**...**` pattern is converted, everything else is plain text. Safe against XSS because React escapes text content.

- [ ] **Step 3.1:** Create component with internal `renderMarkdownBold()` helper that converts `**X**` to `<strong>X</strong>` using regex.

- [ ] **Step 3.2:** Write 4 tests: renders headline+body, converts bold to strong tag, shows AI icon, handles text without bold.

- [ ] **Step 3.3:** Run test — expect 4 pass.

- [ ] **Step 3.4:** Commit.

```bash
git add src/components/company-detail/ai-insight-card.tsx src/__tests__/components/company-detail/ai-insight-card.test.tsx
git commit -m "feat(company-detail): add AiInsightCard for full-width AI insight"
```

---

### Task 4: SectionCard wrapper

**Files:**

- Create: `src/components/company-detail/section-card.tsx`
- Create: `src/__tests__/components/company-detail/section-card.test.tsx`

**Props:** `{ title, badge?: { label, tone: 'red' | 'amber' | 'green' | 'purple' | 'neutral' }, footerLinkHref?, footerLinkLabel?, children }`

**Visual rules:** white bg, rounded-2xl, shadow, section-header with title left and optional badge right (color by tone), body section with children, optional centered footer link to "Vis alle X right-arrow".

- [ ] **Step 4.1:** Create component.

- [ ] **Step 4.2:** Write 4 tests: shows title+children, badge tone renders correct bg, footer link conditional render, no link when href missing.

- [ ] **Step 4.3:** Run test — expect 4 pass.

- [ ] **Step 4.4:** Commit.

```bash
git add src/components/company-detail/section-card.tsx src/__tests__/components/company-detail/section-card.test.tsx
git commit -m "feat(company-detail): add SectionCard wrapper"
```

---

### Task 5: OwnershipSection

**Files:**

- Create: `src/components/company-detail/ownership-section.tsx`
- Create: `src/__tests__/components/company-detail/ownership-section.test.tsx`

**Props:** `{ data: OwnershipData | null }` where `OwnershipData = { kaedegruppePct, localPartner: { name, pct } | null, ejeraftaleStatus: { label, danger } | null, holdingCompanyName: string | null }`

**Contents per spec section 6.1:** 4 data-rows plus a visual ownership-bar split showing kaedegruppe vs partnere percentages.

- [ ] **Step 5.1:** Create component with empty-state when `data === null` ("Ingen ejerskabsdata registreret"). Otherwise render 4 DataRow elements and a horizontal split bar.

- [ ] **Step 5.2:** Write 4 tests: empty state, renders 4 rows, danger styling for expired ejeraftale, ownership-bar split text.

- [ ] **Step 5.3:** Run test — expect 4 pass.

- [ ] **Step 5.4:** Commit.

```bash
git add src/components/company-detail/ownership-section.tsx src/__tests__/components/company-detail/ownership-section.test.tsx
git commit -m "feat(company-detail): add OwnershipSection (sektion 1)"
```

---

### Task 6: ContractsSection

**Files:**

- Create: `src/components/company-detail/contracts-section.tsx`
- Create: `src/__tests__/components/company-detail/contracts-section.test.tsx`

**Props:** `{ contracts: ContractRow[], totalCount: number, companyId: string }` where `ContractRow = { id, iconLetters, iconTone, name, meta, badge }`

**Contents per spec section 6.2:** top 3 item-rows each with icon-letters-box + name + meta + status-badge. Section badge shows `<N> udloebet` (red) or `<N> aktive` (green). "Vis alle X kontrakter right-arrow" footer link if `totalCount > 3` points to `/contracts?company={companyId}`.

- [ ] **Step 6.1:** Create component. Each item-row is a link to `/contracts/{id}`. Empty state "Ingen aktive kontrakter".

- [ ] **Step 6.2:** Write 5 tests: empty state, renders rows, badge text shows expired count, footer link conditional, cap at 3 rows.

- [ ] **Step 6.3:** Run test — expect 5 pass.

- [ ] **Step 6.4:** Commit.

```bash
git add src/components/company-detail/contracts-section.tsx src/__tests__/components/company-detail/contracts-section.test.tsx
git commit -m "feat(company-detail): add ContractsSection (sektion 2)"
```

---

### Task 7: FinanceSection

**Files:**

- Create: `src/components/company-detail/finance-section.tsx`
- Create: `src/__tests__/components/company-detail/finance-section.test.tsx`

**Props:** `{ data: FinanceData | null }` where `FinanceData` has omsaetning/ebitda/margin_pct/resultat/quarterly/statusBadge.

**Contents per spec section 6.3:** 4 data-rows with YoY deltas colored by sign, Q1-Q4 bar chart.

- [ ] **Step 7.1:** Create component. DataRow helper inside file. Q1-Q4 bars rendered as flex-1 divs with heights proportional to quarterly[i].fraction. Last quarter is darker (bg-blue-600 vs bg-blue-200).

- [ ] **Step 7.2:** Write 6 tests: empty state (data null), 4 data-row values, positive/negative YoY colors, negative resultat red, status badge "Positiv" shown, 4 quarterly bars rendered.

- [ ] **Step 7.3:** Run test — expect 6 pass.

- [ ] **Step 7.4:** Commit.

```bash
git add src/components/company-detail/finance-section.tsx src/__tests__/components/company-detail/finance-section.test.tsx
git commit -m "feat(company-detail): add FinanceSection (sektion 3)"
```

---

### Task 8: CasesSection

**Files:**

- Create: `src/components/company-detail/cases-section.tsx`
- Create: `src/__tests__/components/company-detail/cases-section.test.tsx`

**Props:** `{ cases: CaseRow[], totalCount: number }` where `CaseRow = { id, iconLetter, iconTone, title, meta, badge }`

**Contents per spec section 6.4:** top 3 item-rows, badge `<N> aktive` red when `totalCount > 0`, hidden when 0. Each row links to `/cases/{id}`.

- [ ] **Step 8.1:** Create component.

- [ ] **Step 8.2:** Write 4 tests: empty state, badge count, renders rows, links to /cases/id.

- [ ] **Step 8.3:** Run test — expect 4 pass.

- [ ] **Step 8.4:** Commit.

```bash
git add src/components/company-detail/cases-section.tsx src/__tests__/components/company-detail/cases-section.test.tsx
git commit -m "feat(company-detail): add CasesSection (sektion 4)"
```

---

### Task 9: PersonsSection

**Files:**

- Create: `src/components/company-detail/persons-section.tsx`
- Create: `src/__tests__/components/company-detail/persons-section.test.tsx`

**Props:** `{ persons: PersonRow[], totalCount: number, companyId: string }` where `PersonRow = { id, initials, name, role }`

**Contents per spec section 6.5:** top 3 person-rows each with circular initials-avatar + name + role. Footer link "Vis alle X medarbejdere right-arrow" when `totalCount > 3`, targets `/persons?company={companyId}`.

- [ ] **Step 9.1:** Create component. Empty state "Ingen noeglepersoner registreret".

- [ ] **Step 9.2:** Write 4 tests: empty state, initials+name rendered, footer link hidden when total less than 4, footer link shown with correct href when total more than 3.

- [ ] **Step 9.3:** Run test — expect 4 pass.

- [ ] **Step 9.4:** Commit.

```bash
git add src/components/company-detail/persons-section.tsx src/__tests__/components/company-detail/persons-section.test.tsx
git commit -m "feat(company-detail): add PersonsSection (sektion 5)"
```

---

### Task 10: VisitsSection

**Files:**

- Create: `src/components/company-detail/visits-section.tsx`
- Create: `src/__tests__/components/company-detail/visits-section.test.tsx`

**Props:** `{ visits: VisitRow[] }` where `VisitRow = { id, typeLabel, meta, badge: { label, tone: 'blue' | 'green' | 'slate' } }`

**Contents per spec section 6.6:** top 3 item-rows with B-icon, type label, date meta, status badge. Row links to `/visits/{id}`.

- [ ] **Step 10.1:** Create component. Empty state "Ingen besoeg registreret".

- [ ] **Step 10.2:** Write 4 tests: empty state, renders rows, badge colors per tone, links to /visits/id.

- [ ] **Step 10.3:** Run test — expect 4 pass.

- [ ] **Step 10.4:** Commit.

```bash
git add src/components/company-detail/visits-section.tsx src/__tests__/components/company-detail/visits-section.test.tsx
git commit -m "feat(company-detail): add VisitsSection (sektion 6)"
```

---

### Task 11: DocumentsSection

**Files:**

- Create: `src/components/company-detail/documents-section.tsx`
- Create: `src/__tests__/components/company-detail/documents-section.test.tsx`

**Props:** `{ documents: DocumentRow[], awaitingReviewCount: number }` where `DocumentRow = { id, isAiExtracted, fileName, meta, badge: { label, tone: 'purple' | 'green' } }`

**Contents per spec section 6.7:** top 3 rows. Icon is `AI` purple if `isAiExtracted`, else `PDF` slate. Badge shows "Til review" (purple) or "Arkiveret" (green). Section badge shows `<N> til review` purple when `awaitingReviewCount > 0`. Row links to `/documents/review/{id}`.

- [ ] **Step 11.1:** Create component. Empty state "Ingen dokumenter uploadet".

- [ ] **Step 11.2:** Write 4 tests: empty state, AI icon vs PDF icon, badge count "1 til review", links to /documents/review/id.

- [ ] **Step 11.3:** Run test — expect 4 pass.

- [ ] **Step 11.4:** Commit.

```bash
git add src/components/company-detail/documents-section.tsx src/__tests__/components/company-detail/documents-section.test.tsx
git commit -m "feat(company-detail): add DocumentsSection (sektion 7)"
```

---

## Task 12: CompanyHeader

**Files:**

- Create: `src/components/company-detail/company-header.tsx`
- Create: `src/__tests__/components/company-detail/company-header.test.tsx`

**Props:** `{ name, cvr, city, status, foundedYear, statusBadge, healthDimensions, showHealthDims, editStamdataButton: ReactNode, createTaskHref, readOnly }`

The `editStamdataButton` is a slot (ReactNode) so `page.tsx` can pass the `EditStamdataDialog` trigger in without the header needing to import the Client Component (keeps header as a Server Component).

**Visual rules per spec section 5:**

- grid `grid-template-columns: 1fr auto`
- left: name + status-badge inline, meta-row as flex-wrap gap list (CVR, city, status, founded year), health-dimensions row (4 dots when `showHealthDims`)
- right: quick-actions column, "Opret opgave" link (disabled when `readOnly`), edit-stamdata slot
- status badge color by severity: critical red, warning amber, healthy green
- health dim dot colors: red/amber/green bg

- [ ] **Step 12.1:** Create component. Meta-row filters out null CVR/city/foundedYear. Opret opgave is an anchor with `aria-disabled` and pointer-events-none class when `readOnly`.

- [ ] **Step 12.2:** Write 8 tests: shows name+badge, meta-row with CVR/city/status/founded, 4 health dims when shown, hidden when showHealthDims false, createTask href, readOnly disabled styling, editStamdataButton slot rendered, status badge color per severity.

- [ ] **Step 12.3:** Run test — expect 8 pass.

- [ ] **Step 12.4:** Commit.

```bash
git add src/components/company-detail/company-header.tsx src/__tests__/components/company-detail/company-header.test.tsx
git commit -m "feat(company-detail): add CompanyHeader with slot for edit dialog"
```

---

## Task 13: EditStamdataDialog + updateCompanyStamdata action

**Files:**

- Create: `src/components/company-detail/edit-stamdata-dialog.tsx`
- Modify: `src/actions/companies.ts` (add `updateCompanyStamdata`)
- Create: `src/__tests__/components/company-detail/edit-stamdata-dialog.test.tsx`

**Action:** Zod-validated server action `updateCompanyStamdata(companyId, input)` where input has name/cvr/address/city/postal_code/founded_date (ISO date string). Returns `ActionResult<void>`. Validates CVR as 8 digits when not null. Checks access via `canAccessCompany(session.user.id, companyId)` (or `getAccessibleCompanies` if canAccessCompany is not exported — check `src/lib/permissions/index.ts`). Calls `prisma.company.update()` with `organization_id` in where clause for tenant safety. Calls `revalidatePath(/companies/{companyId})`.

**Component (Client Component, uses `useState` + `useTransition`):**

- Trigger button "Rediger stamdata" (receives `disabled` prop for readOnly)
- Modal with form fields: navn, CVR, adresse, by, postnummer, stiftelsesdato
- Modal uses role="dialog" aria-modal overlay clickable to dismiss
- Submit button shows "Gemmer..." during transition
- On success: toast.success("Stamdata opdateret"), close modal
- On failure: toast.error(result.error), keep modal open

- [ ] **Step 13.1:** Read existing `src/actions/companies.ts` to see the `ActionResult<T>` type import path and existing action patterns.

- [ ] **Step 13.2:** Add `updateCompanyStamdata` action. Imports: `z` from zod, `revalidatePath` from `next/cache`, `prisma` from `@/lib/db`, `auth` from `@/lib/auth`, access helper from `@/lib/permissions`, `ActionResult` from the types file. Define Zod schema `stamdataSchema`. Function validates, checks access, updates, revalidates.

- [ ] **Step 13.3:** Create dialog component. Uses `useState` for `open` and form state, `useTransition` for submit pending. Mocks server action in tests via `vi.mock`.

- [ ] **Step 13.4:** Write 4 tests: trigger button shown closed initially, click opens modal with initial values, cancel closes modal, disabled prop disables trigger.

- [ ] **Step 13.5:** Run tests.

```bash
npx vitest run src/__tests__/components/company-detail/edit-stamdata-dialog.test.tsx
```

Expected: 4 pass.

- [ ] **Step 13.6:** Typecheck.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 13.7:** Commit.

```bash
git add src/components/company-detail/edit-stamdata-dialog.tsx src/__tests__/components/company-detail/edit-stamdata-dialog.test.tsx src/actions/companies.ts
git commit -m "feat(company-detail): add EditStamdataDialog + updateCompanyStamdata action"
```

---

## Task 14: AI job — company-insights

**Files:**

- Create: `src/lib/ai/jobs/company-insights.ts`
- Create: `src/__tests__/ai/company-insights.test.ts`

**Exports:**

- `CompanySnapshot` interface (input shape per spec section 8)
- `CompanyAlert`, `AiInsight`, `CompanyInsightsResult` types + matching Zod schemas
- `generateCompanyInsights(snapshot): Promise<GenerateInsightsOutcome>` where outcome is `{ ok: true, data, cost_usd, model_name }` or `{ ok: false, error }`

**Implementation:**

- Uses `createClaudeClient()` from `@/lib/ai/client`
- System prompt per spec section 8 (dansk, JSON output requirements, anti-bias rules, coverage language)
- User message is `JSON.stringify(snapshot, null, 2)`
- 8s timeout via `Promise.race` against `setTimeout`
- Response content array first text block extracted
- JSON fence stripping: regex `/```(?:json)?\s*(\{[\s\S]*?\})\s*```/` fallback to first `{` through last `}`
- Zod validation via `CompanyInsightsResultSchema.safeParse`
- Cost tracking via `computeCostUsd(MODEL, input_tokens, output_tokens)`
- Model constant: `claude-sonnet-4-6` (verify via reading `src/lib/ai/client/types.ts` — if the ClaudeModel type does not include this, use closest available model from the type)
- All failure modes caught in try/catch, returned as `{ ok: false, error: message }`

**Zod schemas:**

```
CompanyAlertSchema = z.object({
  severity: z.enum(['critical', 'warning']),
  title: z.string().max(60),
  sub: z.string().max(100),
  action_label: z.string().max(20),
  action_href: z.string().startsWith('/'),
  roles: z.array(z.enum(['owner', 'legal', 'finance', 'admin', 'manager'])).min(1),
})

AiInsightSchema = z.object({
  headline_md: z.string().max(80),
  body_md: z.string().max(280),
})

CompanyInsightsResultSchema = z.object({
  alerts: z.array(CompanyAlertSchema).max(5),
  insight: AiInsightSchema.nullable(),
})
```

- [ ] **Step 14.1:** Read `src/lib/ai/client/index.ts` and `src/lib/ai/client/types.ts` to confirm:
  - `createClaudeClient()` exported and returns an object with a message-sending method
  - The method name (likely `.complete()`, `.sendMessage()`, or `.createMessage()`)
  - Request shape: does it take `{ model, max_tokens, system, messages }` or differently shaped args?
  - Response shape: does it return `{ content: [{ type, text }], usage: { input_tokens, output_tokens } }` or differently?
  - `ClaudeModel` type and which models are valid

  Adjust the implementation to match the actual client interface. If the interface differs from what this plan assumes, the test assertions must also match.

- [ ] **Step 14.2:** Create `src/lib/ai/jobs/company-insights.ts` with all types, Zod schemas, system prompt, and `generateCompanyInsights` function.

- [ ] **Step 14.3:** Write 5 tests using `vi.mock('@/lib/ai/client', ...)` to mock the client:
  - Happy path: mock returns valid JSON, result is `{ ok: true }` with parsed data
  - JSON in markdown fence: extracted correctly
  - Malformed JSON: returns `{ ok: false }`
  - Schema mismatch (e.g., invalid severity): returns `{ ok: false }`
  - Client throws (e.g., missing API key): caught, returns `{ ok: false }`

- [ ] **Step 14.4:** Run tests.

```bash
npx vitest run src/__tests__/ai/company-insights.test.ts
```

Expected: 5 pass.

- [ ] **Step 14.5:** Typecheck.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 14.6:** Commit.

```bash
git add src/lib/ai/jobs/company-insights.ts src/__tests__/ai/company-insights.test.ts
git commit -m "feat(ai): add company-insights AI job for Plan 4C

En Claude-call returnerer baade alerts og strategisk insight for et
selskab. Timeout 8s via Promise.race, Zod-valideret output, markdown
JSON fence-stripping, cost-tracking. Graceful degradation: alle fejl
returnerer { ok: false, error }."
```

---

## Task 15: Server Action — company-detail

**Files:**

- Create: `src/actions/company-detail.ts`
- Create: `src/__tests__/company-detail-actions.test.ts`

**Exports:**

- Types: `CompanyDetailData`, `OwnershipData`, `ContractViewRow`, `FinanceViewData`, `CaseViewRow`, `PersonViewRow`, `VisitViewRow`, `DocumentViewRow` (all the view-shapes that section components consume)
- `getCompanyDetailData(companyId, userId, organizationId): Promise<CompanyDetailData | null>` — returns null when user has no access to the company

**Core flow (spec section 10 + section 8 cache-strategi):**

1. Pre-fetch: `getAccessibleCompanies(userId, organizationId)` in parallel with `prisma.userRoleAssignment.findMany({ where: { user_id: userId, organization_id: organizationId } })`
2. If `companyId` not in accessibleIds: return null
3. Compute `role = pickHighestPriorityRole(roleRows)` and `visibleSections = sectionsForRole(role)`
4. Parallel Prisma batch (see Step 15.3 below) fetching: company row, ownerships + ejeraftale contract, active contracts + count, finance 2025 + 2024 + quarterly, open cases + count, company persons + count, visits, documents, AI cache row
5. Compute health-dimensions + status-badge from fetched data (using helpers from Task 1)
6. AI cache read/regen logic: if cache exists and age < 24h, use cached (filtered by role via proto role name mapping). Otherwise build snapshot, call `generateCompanyInsights`, on success upsert cache and use result, on failure use empty
7. Build view-rows for each visible section via internal helpers (`buildOwnership`, `buildContracts`, `buildFinance`, `buildCases`, `buildPersons`, `buildVisits`, `buildDocuments`)
8. Return full `CompanyDetailData`

**Internal helpers (in same file):**

- `sumFinance(metrics)` — aggregates FinancialMetric rows into `{ omsaetning, ebitda, resultat }` nulls when absent
- `buildOwnership(ownerships, ejeraftaleContract, today)` — computes kaedegruppePct/localPartner/ejeraftaleStatus/holdingCompanyName per spec. For now `holdingCompanyName` returns null (follow-up task).
- `buildContracts(contractsRaw, today, totalCount)` — applies `sortContractsByUrgency`, slices top 3, maps to ContractViewRow
- `buildFinance(sum2025, sum2024, quarterlyRaw)` — YoY delta calc, margin, Q1-Q4 fractions from max quarter, status badge tone
- `buildCases(casesRaw, totalCount)` — applies `sortCasesByUrgency`, slices top 3, maps to CaseViewRow
- `buildPersons(companyPersonsRaw, totalCount)` — applies `selectKeyPersons`, maps to PersonViewRow
- `buildVisits(visitsRaw)` — top 3 visits with tone/label per status
- `buildDocuments(documentsRaw)` — top 3 docs with AI/PDF icon, purple/green badge, returns `awaitingReviewCount`
- `buildSnapshot(companyId, organizationId, company)` — minimal snapshot for AI call (empty contracts/cases/finance/persons arrays in v1 — Task 15 establishes the flow, enriching snapshot is a follow-up)
- `rolename(role)` — maps ChainHub role to proto role ('owner'|'legal'|'finance'|'admin'|'manager') for alert role-tag filtering
- `formatDateDa(date)` — `<dag>. <maaned> <aar>` using dansk month abbreviations
- `humanizeVisitType(type)` — KVARTALSBESOEG to "Kvartalsbesoeg" etc.

**Snapshot builder (minimal v1):** Fetches peer companies in same city via `prisma.company.findMany({ where: { organization_id, deleted_at: null, id: { not: companyId }, city: company.city } })` limit 5, then their 2025 omsaetning via a separate FinancialMetric query. Returns snapshot with empty `contracts: []`, `cases: []`, `finance: null`, etc. AI will produce lighter-weight output; richer snapshots come in a follow-up.

**Tenant safety:** every query has `organization_id: organizationId`. Soft-delete tables use `deleted_at: null`. Access check via `getAccessibleCompanies` before any other Prisma calls (early-returns null on miss).

**Prisma batch query details (Step 15.3):**

For visible sections, fetch real data. For hidden sections, use `Promise.resolve(<empty>)` to skip the DB roundtrip. Finance sums are always fetched (regardless of `finance` section visibility) because they feed `deriveHealthDimensions`. Similarly contracts/cases/visits need their light variants fetched for health computation even if the full section is hidden — handle this by fetching the lightweight `select` version unconditionally.

The safer approach: fetch ALL data regardless of visibility on v1 (simpler and easier to test), then skip the building step for hidden sections. This trades a small amount of DB work for simpler logic. Use this approach.

- [ ] **Step 15.1:** Read `prisma/schema.prisma` to confirm these fields exist exactly:
  - `Company.cvr`, `Company.address`, `Company.city`, `Company.postal_code`, `Company.status`, `Company.founded_date`, `Company.company_type`
  - `Ownership.ownership_pct`, `Ownership.owner_person_id`, `Ownership.owner_company_id`, `Ownership.owner_person` relation
  - `Contract.system_type`, `Contract.display_name`, `Contract.expiry_date`, `Contract.status`
  - `Case.status`, `Case.case_type`, `Case.title`, `Case.created_at`, `Case.case_companies` relation
  - `CompanyPerson.role`, `CompanyPerson.anciennity_start`, `CompanyPerson.end_date`, `CompanyPerson.person` relation with `first_name`/`last_name`
  - `FinancialMetric.metric_type`, `FinancialMetric.period_year`, `FinancialMetric.period_type`, `FinancialMetric.value`, `FinancialMetric.period_quarter` (if needed for sorting)
  - `Visit.visit_type`, `Visit.visit_date`, `Visit.status`
  - `Document.file_name`, `Document.uploaded_at`, `Document.extraction` relation with `extraction_status`/`reviewed_at`

  If any field differs, adjust the action accordingly.

- [ ] **Step 15.2:** Create `src/actions/company-detail.ts` with `'use server'` directive, all type exports, `getCompanyDetailData` function implementing the core flow, and all internal helpers.

- [ ] **Step 15.3:** Inside the parallel batch, each Prisma call uses tenant-safe `where` clauses. Structure the batch as one `Promise.all([...])` with matching destructure. Example of ownership fetch:

```ts
prisma.ownership.findMany({
  where: { company_id: companyId, organization_id: organizationId },
  include: { owner_person: { select: { first_name: true, last_name: true } } },
})
```

And for contracts:

```ts
prisma.contract.findMany({
  where: {
    company_id: companyId,
    organization_id: organizationId,
    deleted_at: null,
    status: 'AKTIV',
  },
  take: 20,
})
```

For cases with tenant-scope (match dashboard Plan 4B pattern):

```ts
prisma.case.findMany({
  where: {
    organization_id: organizationId,
    deleted_at: null,
    status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
    case_companies: { some: { company_id: companyId } },
  },
  take: 10,
})
```

- [ ] **Step 15.4:** Write smoke test at `src/__tests__/company-detail-actions.test.ts`. Mock `@/lib/ai/jobs/company-insights` so `generateCompanyInsights` returns `{ ok: false, error: 'mocked' }` (graceful degradation path). Use `describe.runIf(!!process.env.DATABASE_URL)` to skip when no DB. Two tests:
  - `returnerer null for selskab udenfor adgang` — call with random company ID, expect null
  - `returnerer CompanyDetailData shape for seed selskab` — fetch first seed company via `prisma.company.findFirst`, call action, assert shape (visibleSections is Set, healthDimensions has 4 keys, statusBadge has label, alerts is empty array due to mocked AI failure, aiInsight is null)

- [ ] **Step 15.5:** Typecheck.

```bash
npx tsc --noEmit
```

Expected: clean. Common issues: `Decimal` type needing `.toString()`/`Number()` conversion, optional fields needing null-coalescing, relation field access after `include`.

- [ ] **Step 15.6:** Run test.

```bash
npx vitest run src/__tests__/company-detail-actions.test.ts
```

Expected: 2 pass (or skip if no DB).

- [ ] **Step 15.7:** Commit.

```bash
git add src/actions/company-detail.ts src/__tests__/company-detail-actions.test.ts
git commit -m "feat(actions): add getCompanyDetailData aggregator for Plan 4C

Parallel Prisma batch henter company + alle sektion-data + AI cache i en
call. Rolle-baseret visibleSections filtrerer render, ikke queries.
Stale-after-24h AI cache regenereres synkront med 8s timeout, graceful
degradation ved fejl. Returnerer null ved manglende adgang."
```

---

## Task 16: Page rewrite + delete subpages

**Files:**

- Rewrite: `src/app/(dashboard)/companies/[id]/page.tsx`
- Delete: `src/app/(dashboard)/companies/[id]/layout.tsx`
- Delete: `src/app/(dashboard)/companies/[id]/company-detail-client.tsx`
- Delete: 11 subpage folders (cases, contracts, documents, employees, finance, governance, log, overview, ownership, stamdata, visits)
- Delete: `src/components/companies/CompanyTabs.tsx`

- [ ] **Step 16.1:** Read current `src/app/(dashboard)/companies/[id]/page.tsx`, `layout.tsx`, and `company-detail-client.tsx` to understand the structure being replaced. Read `src/components/companies/CompanyTabs.tsx` to confirm no other file needs it.

- [ ] **Step 16.2:** Use Grep tool to search for lingering imports from the subpage paths and CompanyTabs. Patterns to check:
  - `from '@/components/companies/CompanyTabs'`
  - `/companies/\[id\]/(cases|contracts|documents|employees|finance|governance|log|overview|ownership|stamdata|visits)` in import statements

  If any external file imports from these locations, note the paths and plan updates. Most likely zero external imports since subpages were leaf routes.

- [ ] **Step 16.3:** Delete the 11 subpage folders.

```bash
git rm -r "src/app/(dashboard)/companies/[id]/cases/"
git rm -r "src/app/(dashboard)/companies/[id]/contracts/"
git rm -r "src/app/(dashboard)/companies/[id]/documents/"
git rm -r "src/app/(dashboard)/companies/[id]/employees/"
git rm -r "src/app/(dashboard)/companies/[id]/finance/"
git rm -r "src/app/(dashboard)/companies/[id]/governance/"
git rm -r "src/app/(dashboard)/companies/[id]/log/"
git rm -r "src/app/(dashboard)/companies/[id]/overview/"
git rm -r "src/app/(dashboard)/companies/[id]/ownership/"
git rm -r "src/app/(dashboard)/companies/[id]/stamdata/"
git rm -r "src/app/(dashboard)/companies/[id]/visits/"
```

- [ ] **Step 16.4:** Delete the old layout + client wrapper + CompanyTabs component.

```bash
git rm "src/app/(dashboard)/companies/[id]/layout.tsx"
git rm "src/app/(dashboard)/companies/[id]/company-detail-client.tsx"
git rm "src/components/companies/CompanyTabs.tsx"
```

- [ ] **Step 16.5:** Rewrite `src/app/(dashboard)/companies/[id]/page.tsx` as a Server Component:

```tsx
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCompanyDetailData } from '@/actions/company-detail'
import { CompanyHeader } from '@/components/company-detail/company-header'
import { AlertBanner } from '@/components/company-detail/alert-banner'
import { OwnershipSection } from '@/components/company-detail/ownership-section'
import { ContractsSection } from '@/components/company-detail/contracts-section'
import { FinanceSection } from '@/components/company-detail/finance-section'
import { CasesSection } from '@/components/company-detail/cases-section'
import { PersonsSection } from '@/components/company-detail/persons-section'
import { VisitsSection } from '@/components/company-detail/visits-section'
import { DocumentsSection } from '@/components/company-detail/documents-section'
import { AiInsightCard } from '@/components/company-detail/ai-insight-card'
import { EditStamdataDialog } from '@/components/company-detail/edit-stamdata-dialog'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const data = await getCompanyDetailData(params.id, session.user.id, session.user.organizationId)
  if (!data) notFound()

  const readOnly = data.role === 'GROUP_READONLY' || data.role === 'COMPANY_READONLY'

  return (
    <div className="mx-auto max-w-[1100px] p-6">
      <nav className="mb-4 text-xs text-gray-400">
        <Link href="/companies" className="text-slate-500 no-underline hover:text-blue-600">
          Selskaber
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{data.company.name}</span>
      </nav>

      <CompanyHeader
        name={data.company.name}
        cvr={data.company.cvr}
        city={data.company.city}
        status={data.company.status}
        foundedYear={data.company.founded_date?.getFullYear() ?? null}
        statusBadge={data.statusBadge}
        healthDimensions={data.healthDimensions}
        showHealthDims={data.role !== 'COMPANY_MANAGER' && data.role !== 'COMPANY_READONLY'}
        editStamdataButton={
          <EditStamdataDialog
            companyId={data.company.id}
            initial={{
              name: data.company.name,
              cvr: data.company.cvr,
              address: data.company.address,
              city: data.company.city,
              postal_code: data.company.postal_code,
              founded_date: data.company.founded_date,
            }}
            disabled={readOnly}
          />
        }
        createTaskHref={`/tasks/new?company=${data.company.id}`}
        readOnly={readOnly}
      />

      {data.alerts.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {data.alerts.slice(0, 3).map((alert, i) => (
            <AlertBanner
              key={i}
              severity={alert.severity}
              title={alert.title}
              sub={alert.sub}
              actionLabel={alert.action_label}
              actionHref={alert.action_href}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {data.visibleSections.has('ownership') && <OwnershipSection data={data.ownership} />}
        {data.visibleSections.has('contracts') && (
          <ContractsSection
            contracts={data.contracts.top}
            totalCount={data.contracts.totalCount}
            companyId={data.company.id}
          />
        )}
        {data.visibleSections.has('finance') && <FinanceSection data={data.finance} />}
        {data.visibleSections.has('cases') && (
          <CasesSection cases={data.cases.top} totalCount={data.cases.totalCount} />
        )}
        {data.visibleSections.has('persons') && (
          <PersonsSection
            persons={data.persons.top}
            totalCount={data.persons.totalCount}
            companyId={data.company.id}
          />
        )}
        {data.visibleSections.has('visits') && <VisitsSection visits={data.visits} />}
        {data.visibleSections.has('documents') && (
          <DocumentsSection
            documents={data.documents.rows}
            awaitingReviewCount={data.documents.awaitingReviewCount}
          />
        )}
        {data.visibleSections.has('insight') && data.aiInsight && (
          <div className="col-span-2">
            <AiInsightCard
              headlineMd={data.aiInsight.headline_md}
              bodyMd={data.aiInsight.body_md}
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 16.6:** Grep again for remaining references to deleted files.

```
Grep pattern: from '@/components/companies/CompanyTabs'
Grep pattern: CompanyTabs
```

Expected: zero results (the only import was in the now-deleted `company-detail-client.tsx`).

- [ ] **Step 16.7:** Typecheck.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 16.8:** Build.

```bash
npm run build
```

Expected: success. Verify `/companies/[id]` appears as a single dynamic route in the output, no subpage suffixes.

- [ ] **Step 16.9:** Commit.

```bash
git add "src/app/(dashboard)/companies/[id]/page.tsx"
git commit -m "feat(company-detail): rewrite page as proto single-page (Plan 4C)

Erstatter 11 subpage-tabs med et single scroll-view der matcher
brainstorm-proto'en. CompanyHeader + alert-banners + 2-column grid
med 7 sektioner + full-width AI Insight. Rolle-filtrering server-side
via visibleSections Set. Data hentes via getCompanyDetailData action
der ogsaa haandterer AI cache read/regen med 24h TTL.

Sletter: cases/, contracts/, documents/, employees/, finance/,
governance/, log/, overview/, ownership/, stamdata/, visits/ subpage-
mapper samt layout.tsx, company-detail-client.tsx og CompanyTabs.tsx."
```

---

## Task 17: Full validate + Playwright audit

**Files:** none (validation only)

- [ ] **Step 17.1:** Full test suite.

```bash
npm test -- --run
```

Expected: all previous 242 Plan 4B tests plus approximately 65 new Plan 4C tests. Target: 300+ passing, 4 still skipped (AI queue integration).

- [ ] **Step 17.2:** Full typecheck.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 17.3:** Full build.

```bash
rm -rf .next && npm run build
```

Expected: success.

- [ ] **Step 17.4:** Start dev server.

```bash
npm run dev
```

Expected: ready on `http://localhost:3000` (or 3001 if 3000 taken).

- [ ] **Step 17.5:** Smoke test via curl.

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/companies/abc
```

Expected: 307 (redirect to /login).

- [ ] **Step 17.6:** Playwright visual audit.

Open Playwright MCP. Log in as `philip@chainhub.dk / password123`. Navigate to `/companies` portfolio list, click first company to open `/companies/{id}`.

Verify:

- Company header renders with name, status badge, meta-row (CVR, city, status, founded year), 4 health-dimensions dots
- Alert banners render at top if AI has generated any (may be empty on first visit — this is acceptable)
- Content grid shows 2 columns with all 8 sections for Philip (GROUP_OWNER)
- AI Insight card renders full-width at bottom (purple gradient)
- No console errors
- No 404s in network tab
- "Rediger stamdata" button opens modal when clicked

If AI section shows as gracefully degraded (empty) on first visit, this is expected — the 8s timeout may fire or cache may still be writing. Refresh to verify subsequent requests use the cache.

- [ ] **Step 17.7:** Role-switch smoke test (optional).

Log out, log in as `maria@tandlaegegruppen.dk / password123` (GROUP_LEGAL). Navigate to same company. Verify:

- Only 5 sections visible: Ejerskab, Kontrakter, Aabne sager, Seneste dokumenter, AI Insight
- Finance, Persons, Visits sections NOT rendered

- [ ] **Step 17.8:** Stop dev server via TaskStop or Ctrl-C.

- [ ] **Step 17.9:** Final commit if fixes needed.

```bash
git add <affected-files>
git commit -m "fix(company-detail): rettelser efter Plan 4C visuelt audit"
```

Otherwise skip.

---

## Completion checklist

- [ ] Task 0: Prisma migration applied (CompanyInsightsCache model exists)
- [ ] Task 1: Pure helpers with approximately 30 unit tests passing
- [ ] Task 2: AlertBanner (4 tests)
- [ ] Task 3: AiInsightCard (4 tests)
- [ ] Task 4: SectionCard (4 tests)
- [ ] Task 5: OwnershipSection (4 tests)
- [ ] Task 6: ContractsSection (5 tests)
- [ ] Task 7: FinanceSection (6 tests)
- [ ] Task 8: CasesSection (4 tests)
- [ ] Task 9: PersonsSection (4 tests)
- [ ] Task 10: VisitsSection (4 tests)
- [ ] Task 11: DocumentsSection (4 tests)
- [ ] Task 12: CompanyHeader (8 tests)
- [ ] Task 13: EditStamdataDialog + action (4 tests)
- [ ] Task 14: company-insights AI job (5 tests)
- [ ] Task 15: company-detail Server Action (2 smoke tests)
- [ ] Task 16: Page rewrite + subpage deletion (11 folders + 3 files removed)
- [ ] Task 17: Full validate + Playwright audit green
- [ ] Pushed to `origin/master`

## Follow-ups (not blockers for Plan 4C)

- Wire up `holdingCompanyName` in `buildOwnership` (second Prisma query to resolve `owner_company_id` to `company.name`)
- Enrich `buildSnapshot` with real contract/case/finance/person data so AI has more context to analyze (v1 uses minimal snapshot to establish the flow)
- Decide BLK-003 mobile drawer approach before mobile traffic becomes relevant
- Add unit tests for `humanizeVisitType`, `formatDateDa`, `rolename`, `sumFinance`, `buildContracts`, `buildFinance`, `buildCases`, `buildPersons`, `buildVisits`, `buildDocuments` (Task 15 action smoke test covers happy path only)

## What comes next

**Plan 4D scope (to be brainstormed separately):**

- `/tasks` list + `/tasks/[id]` detail rewrite
- `/calendar` full page (replaces `/visits`, feeds CalendarWidget on dashboard)
- `/search` global search
- `/settings`
- Delete `/visits` after `/calendar` takes over
