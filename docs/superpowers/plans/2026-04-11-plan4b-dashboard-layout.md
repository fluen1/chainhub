# Plan 4B: Dashboard + Layout Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/dashboard` page and `(dashboard)/layout.tsx` chrome with the proto-designed Timeline River + role-specific right panels + proto AppSidebar/AppHeader, wired to real Prisma data via Server Actions.

**Architecture:** The 11 Plan 4A components become the atomic building blocks. This plan wires them together via:
1. New Server Actions in `src/actions/dashboard.ts` that aggregate Prisma data into `TimelineItem[]`, `InlineKpi[]`, `SidebarBadge` records, coverage percentages, and financial totals.
2. A new `HeatmapGrid` component (referenced by the proto dashboard but not part of 4A — it's dashboard-specific chrome, not a generic atom).
3. A new `TimelineSection` component (same reasoning).
4. Dashboard page as a Server Component that fetches all data in parallel, then hands it to a thin client wrapper that chooses the role-specific right-panel layout.
5. Layout swap: `app/(dashboard)/layout.tsx` switches from legacy `Sidebar`/`Header`/`MobileNav` to `AppSidebar`/`AppHeader`. Old files deleted.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5 strict, Tailwind, Prisma 5, NextAuth 4, existing Plan 4A components from `src/components/ui/` and `src/components/layout/`.

**Prerequisites:** Plan 4A fully merged. HEAD at commit `e9f4da2` or later. All 228 tests green. Build clean.

---

## Scope

### In scope
- **Pre-wiring blocker fixes** (2 files from Plan 4A):
  - `src/components/ui/health-bar.tsx` empty-state
  - `src/components/layout/app-header.tsx` SSR hydration fix
- **Bundle optimization**: drop `'use client'` from 4 pure-presentation atoms (fin-row, coverage-bar, health-bar, company-row)
- **Conventions update**: document kebab-case rule for `ui/` and `layout/` in `docs/build/CONVENTIONS.md`
- **Dashboard Server Action** at `src/actions/dashboard.ts` — 6 aggregator functions
- **New dashboard components** (referenced by proto dashboard but not in 4A):
  - `src/components/dashboard/heatmap-grid.tsx`
  - `src/components/dashboard/timeline-section.tsx`
- **Dashboard page rewrite** at `src/app/(dashboard)/dashboard/page.tsx` (Server Component) + `src/app/(dashboard)/dashboard/dashboard-client.tsx` (thin Client wrapper for role-specific panels)
- **Layout swap** in `src/app/(dashboard)/layout.tsx`: switch to `AppSidebar` + `AppHeader`, delete legacy `Sidebar`/`Header`/`MobileNav` files
- **Adapter**: transform `getSidebarData()` output → `AppSidebarProps.badges` record

### Out of scope (Plan 4C)
- `/tasks` list + `/tasks/[id]` detail rewrite
- `/calendar` full page (replaces `/visits`)
- `/search` global search
- `/settings`
- `/companies/[id]` single-page rewrite (replacing subpages)
- Delete `/visits` (done in 4C when `/calendar` replaces it)

### Key design decisions

1. **Dashboard is server-rendered, not client-rendered.** All data fetching happens in the page's Server Component. A thin Client wrapper only handles the role-based panel selection — which is a pure function of props, no state needed. Result: no hydration issues, no client-side loading spinners.

2. **Timeline items are derived from real data, not hardcoded.** Aggregate tasks + contracts + cases + visits + documents into a single chronological stream, bucketed into sections (`overdue`, `today`, `thisweek`, `nextweek`).

3. **Role-specific panels stay in a switch statement.** Proto had `RightPanels({ role })` with 3 role branches. We keep the same pattern — no dynamic registry. Add role-specific panels as the app grows.

4. **Heatmap takes companies with derived health status.** Since the Company model doesn't have `healthStatus`, we derive it: `critical` if >0 overdue tasks OR expired contracts; `warning` if >0 open cases; else `healthy`.

5. **No `/proto/*` links.** All `href`s point to real routes.

6. **Delete the old layout files in the same commit as the swap.** Use `git rm` to stage deletions. Old: `sidebar.tsx`, `header.tsx`, `MobileNav.tsx`. Keep: `Providers`, `lib/sidebar-data.ts` (we adapt its output).

7. **`AppHeader` becomes a Server Component.** Drop `'use client'`. Greeting + date computed server-side, passed via props. The bell button is currently non-functional (Plan 4C will add dropdown); it stays as inline markup — no client boundary needed yet.

---

## Task 0: Fix HealthBar empty-state (Plan 4A blocker)

**Why first:** This is the smallest blocker from Plan 4A reviews. Must be fixed before `HealthBar` is mounted on the dashboard (Task 9) or it will render as a zero-height invisible bar when all counts are 0.

**Files:**
- Modify: `src/components/ui/health-bar.tsx`
- Modify: `src/__tests__/components/health-bar.test.tsx`

- [ ] **Step 0.1: Update component**

Replace `src/components/ui/health-bar.tsx` (DROP `'use client'` too — see Task 2):

```tsx
export interface HealthBarProps {
  healthy: number
  warning: number
  critical: number
}

export function HealthBar({ healthy, warning, critical }: HealthBarProps) {
  const total = healthy + warning + critical
  const isEmpty = total === 0

  return (
    <div>
      <div className="flex gap-6 mt-3">
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums text-green-600">{healthy}</div>
          <div className="text-[11px] text-gray-400">Sund</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums text-amber-600">{warning}</div>
          <div className="text-[11px] text-gray-400">Advarsel</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums text-red-600">{critical}</div>
          <div className="text-[11px] text-gray-400">Kritisk</div>
        </div>
      </div>
      <div className="mt-3 flex gap-[3px] h-2">
        {isEmpty ? (
          <div className="flex-1 rounded bg-slate-100" />
        ) : (
          <>
            <div className="rounded bg-green-500" style={{ flex: healthy }} />
            <div className="rounded bg-amber-500" style={{ flex: warning }} />
            <div className="rounded bg-red-500" style={{ flex: critical }} />
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 0.2: Add empty-state test**

Append to `src/__tests__/components/health-bar.test.tsx` inside the existing `describe` block, after the `håndterer nul-værdier` test:

```tsx
  it('viser en neutral grå bar når alle værdier er 0', () => {
    const { container } = render(<HealthBar healthy={0} warning={0} critical={0} />)
    const barRow = container.querySelector('.h-2') as HTMLElement
    const segments = barRow.querySelectorAll(':scope > div')
    expect(segments).toHaveLength(1)
    expect(segments[0]).toHaveClass('bg-slate-100', 'flex-1')
  })
```

The existing `håndterer nul-værdier` test still passes because it only asserts the three `0` digits appear — it didn't previously check bar segments.

- [ ] **Step 0.3: Run test**

Run: `npx vitest run src/__tests__/components/health-bar.test.tsx`
Expected: 4 tests pass (3 existing + 1 new).

- [ ] **Step 0.4: Commit**

```bash
git add src/components/ui/health-bar.tsx src/__tests__/components/health-bar.test.tsx
git commit -m "fix(ui): HealthBar viser neutral bar når alle værdier er 0"
```

---

## Task 1: Fix AppHeader SSR hydration (Plan 4A blocker)

**Why:** `getGreeting()` and `getDateString()` currently call `new Date()` at render time in a client component. When Next.js SSRs it and then hydrates on the client, the two renders can disagree (clock second, timezone) causing hydration warnings. Fix: convert to Server Component, accept `currentDate: Date` as a prop.

**Files:**
- Modify: `src/components/layout/app-header.tsx`
- Modify: `src/__tests__/components/app-header.test.tsx`

- [ ] **Step 1.1: Update component**

Replace `src/components/layout/app-header.tsx`:

```tsx
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InlineKpi } from '@/types/ui'

function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Godmorgen'
  if (hour < 18) return 'God eftermiddag'
  return 'God aften'
}

function getDateString(date: Date): string {
  const days = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
  const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']
  return `${days[date.getDay()]} ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`
}

export interface AppHeaderProps {
  userName: string
  kpis: InlineKpi[]
  currentDate: Date
}

export function AppHeader({ userName, kpis, currentDate }: AppHeaderProps) {
  const firstName = userName.split(' ')[0]
  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 h-14 py-0">
      <div className="flex items-center gap-0">
        <div className="pr-5">
          <div className="text-sm font-bold text-slate-900 leading-tight">
            {getGreeting(currentDate)}, {firstName}
          </div>
          <div className="text-[11px] text-gray-400 leading-tight">{getDateString(currentDate)}</div>
        </div>

        <div className="w-px h-8 bg-gray-200 mr-5" />

        <div className="flex items-center gap-5">
          {kpis.map((kpi, i) => (
            <div key={i} className="text-center">
              <div
                className={cn(
                  'text-[18px] font-bold tabular-nums leading-tight',
                  kpi.color === 'red' && 'text-red-600',
                  kpi.color === 'amber' && 'text-amber-600',
                  !kpi.color && 'text-slate-900',
                )}
              >
                {kpi.value}
              </div>
              <div className="text-[9px] text-gray-400 leading-tight">{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          className="w-[260px] rounded-lg border border-gray-200 bg-slate-50 px-3.5 py-2 text-[13px] text-gray-400 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
          placeholder="Søg efter selskaber, kontrakter, personer..."
          readOnly
        />
        <button type="button" aria-label="Notifikationer" className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-slate-50 text-gray-400 hover:bg-slate-100 transition-colors">
          <Bell className="h-4 w-4" />
          <div className="absolute top-1.5 right-1.5 h-[7px] w-[7px] rounded-full bg-red-500 border-2 border-white" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-200 text-xs font-bold text-slate-600">
          {initials}
        </div>
      </div>
    </header>
  )
}
```

Key changes:
- Removed `'use client'` (now Server Component)
- Added `currentDate: Date` required prop
- `getGreeting(date)` and `getDateString(date)` take the date as a parameter
- Date computation is done on the server, not in the component

- [ ] **Step 1.2: Update tests**

Replace `src/__tests__/components/app-header.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHeader } from '@/components/layout/app-header'
import type { InlineKpi } from '@/types/ui'

const kpis: InlineKpi[] = [
  { label: 'Selskaber', value: '7' },
  { label: 'Udløbende', value: '3', color: 'amber' },
  { label: 'Forfaldne', value: '12', color: 'red' },
]

describe('AppHeader', () => {
  it('viser Godmorgen før kl 12', () => {
    const date = new Date('2026-04-11T08:30:00')
    render(<AppHeader userName="Philip Larsen" kpis={kpis} currentDate={date} />)
    expect(screen.getByText(/Godmorgen, Philip/)).toBeInTheDocument()
  })

  it('viser God eftermiddag mellem 12-18', () => {
    const date = new Date('2026-04-11T14:00:00')
    render(<AppHeader userName="Philip" kpis={[]} currentDate={date} />)
    expect(screen.getByText(/God eftermiddag/)).toBeInTheDocument()
  })

  it('viser God aften fra kl 18', () => {
    const date = new Date('2026-04-11T20:00:00')
    render(<AppHeader userName="Philip" kpis={[]} currentDate={date} />)
    expect(screen.getByText(/God aften/)).toBeInTheDocument()
  })

  it('formaterer dansk dato korrekt', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="T" kpis={[]} currentDate={date} />)
    expect(screen.getByText(/Lørdag 11\. april 2026/)).toBeInTheDocument()
  })

  it('viser alle KPIs med korrekte farver', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="T" kpis={kpis} currentDate={date} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toHaveClass('text-amber-600')
    expect(screen.getByText('12')).toHaveClass('text-red-600')
    expect(screen.getByText('Selskaber')).toBeInTheDocument()
  })

  it('viser initialer fra userName', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="Philip Larsen" kpis={[]} currentDate={date} />)
    expect(screen.getByText('PL')).toBeInTheDocument()
  })

  it('viser notifikations-bell med aria-label', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="T" kpis={[]} currentDate={date} />)
    expect(screen.getByLabelText('Notifikationer')).toBeInTheDocument()
  })

  it('viser readonly søge-input', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="T" kpis={[]} currentDate={date} />)
    const input = screen.getByPlaceholderText(/Søg efter/)
    expect(input).toHaveAttribute('readOnly')
  })
})
```

- [ ] **Step 1.3: Run test**

Run: `npx vitest run src/__tests__/components/app-header.test.tsx`
Expected: 8 tests pass.

- [ ] **Step 1.4: Commit**

```bash
git add src/components/layout/app-header.tsx src/__tests__/components/app-header.test.tsx
git commit -m "fix(layout): AppHeader → server component, accept currentDate prop

Fjerner SSR hydration warning ved at beregne greeting/dato server-side
og sende den ind via prop. Tests bruger nu faste datoer i stedet for
non-deterministisk regex-match."
```

---

## Task 2: Drop `'use client'` from pure presentation atoms

**Why:** `fin-row.tsx`, `coverage-bar.tsx`, and `company-row.tsx` have no hooks, no event handlers, no browser APIs. They're server-component-safe. Dropping `'use client'` shrinks the dashboard's client bundle. `HealthBar` is already done in Task 0.

**Note:** `KpiCard` keeps `'use client'` because of `onClick`. `InsightCard`/`CalendarWidget`/`AppSidebar` keep it because of `useState`/`usePathname`.

**Files:**
- Modify: `src/components/ui/fin-row.tsx` — remove line 1
- Modify: `src/components/ui/coverage-bar.tsx` — remove line 1
- Modify: `src/components/ui/company-row.tsx` — remove line 1

- [ ] **Step 2.1: Remove directive from fin-row.tsx**

Delete the first line (`'use client'`) and the blank line after it. The file should now start with `import { cn } from '@/lib/utils'`.

- [ ] **Step 2.2: Remove directive from coverage-bar.tsx**

Same — delete the first `'use client'` line. File starts with `import { cn }`.

- [ ] **Step 2.3: Remove directive from company-row.tsx**

Same — delete the first `'use client'` line. File starts with `import Link from 'next/link'`.

- [ ] **Step 2.4: Run all component tests**

Run: `npx vitest run src/__tests__/components/`
Expected: all component tests still pass. `next/link` and `cn()` work in Server Components, so no test should break.

- [ ] **Step 2.5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2.6: Commit**

```bash
git add src/components/ui/fin-row.tsx src/components/ui/coverage-bar.tsx src/components/ui/company-row.tsx
git commit -m "perf(ui): drop 'use client' fra pure presentation atoms

FinRow, CoverageBar og CompanyRow har ingen hooks/events/state og
virker fint som server components. Reducerer client bundle-størrelse
på sider der bruger dem."
```

---

## Task 3: Update CONVENTIONS.md for kebab-case

**Files:**
- Modify: `docs/build/CONVENTIONS.md`

- [ ] **Step 3.1: Find the file-naming section**

Read `docs/build/CONVENTIONS.md` and locate the line that says (or similar):

```
Komponenter:        PascalCase          CompanyCard.tsx
```

- [ ] **Step 3.2: Replace with split rule**

Replace the line above with:

```
UI-primitives:      kebab-case          fin-row.tsx        (src/components/ui/, src/components/layout/ — shadcn convention)
Modul-komponenter:  PascalCase          CompanyCard.tsx    (src/components/<modul>/)
```

Add a note below the file-naming table:

```markdown
**Bemærk:** Nye komponenter i `src/components/ui/` og `src/components/layout/` skal bruge kebab-case (fx `fin-row.tsx`, `app-sidebar.tsx`) for at matche shadcn/ui-konventionen og Plan 4A-migrationerne. Eksisterende PascalCase-filer i disse mapper (`CollapsibleSection.tsx`, `Pagination.tsx`, `MobileNav.tsx`) renameres gradvist — ikke nødvendigt i én commit.
```

- [ ] **Step 3.3: Commit**

```bash
git add docs/build/CONVENTIONS.md
git commit -m "docs(conventions): kebab-case for ui/ og layout/ (shadcn)"
```

---

## Task 4: Dashboard Server Actions

**Files:**
- Create: `src/actions/dashboard.ts`
- Test: `src/__tests__/dashboard-actions.test.ts`

This is the data layer for the dashboard. Six aggregator functions that the dashboard page will call in parallel.

- [ ] **Step 4.1: Create dashboard.ts skeleton**

Create `src/actions/dashboard.ts`:

```ts
'use server'

import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import type {
  CalendarEvent,
  InlineKpi,
  SidebarBadge,
  UrgencyItem,
} from '@/types/ui'

// ---------------------------------------------------------------
// Typer
// ---------------------------------------------------------------

export type TimelineColor = 'red' | 'amber' | 'blue' | 'purple' | 'green' | 'gray'

export interface TimelineItem {
  id: string
  letter: string
  color: TimelineColor
  title: string
  subtitle: string
  aiExtracted?: boolean
  time: string
  href: string
}

export interface TimelineSectionData {
  id: 'overdue' | 'today' | 'thisweek' | 'nextweek'
  label: string
  dotType: 'overdue' | 'today' | 'future'
  items: TimelineItem[]
}

export interface HeatmapCompany {
  id: string
  name: string
  healthStatus: 'healthy' | 'warning' | 'critical'
  openCaseCount: number
}

export interface CoverageItem {
  label: string
  pct: number
}

export interface PortfolioTotals {
  totalOmsaetning: number
  totalEbitda: number
  avgEbitdaMargin: number
}

export interface DashboardData {
  badges: Record<string, SidebarBadge | null>
  inlineKpis: InlineKpi[]
  timelineSections: TimelineSectionData[]
  heatmap: HeatmapCompany[]
  coverage: CoverageItem[]
  portfolioTotals: PortfolioTotals
  underperformingCount: number
  role: string
}

// ---------------------------------------------------------------
// Hoved-aggregator — én query-paralle batch
// ---------------------------------------------------------------
export async function getDashboardData(
  userId: string,
  organizationId: string
): Promise<DashboardData> {
  const [companyIds, roleRows] = await Promise.all([
    getAccessibleCompanies(userId, organizationId),
    prisma.userRoleAssignment.findMany({
      where: { user_id: userId },
      select: { role: true },
      take: 1,
    }),
  ])

  const role = roleRows[0]?.role ?? 'GROUP_READONLY'
  const today = new Date()
  const in14days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const in90days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const twoWeekEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  if (companyIds.length === 0) {
    return emptyDashboardData(role)
  }

  const [
    overdueTasks,
    todayAndFutureTasks,
    expiringContracts,
    openCases,
    upcomingVisits,
    recentDocuments,
    companies,
    tasksByCompany,
    contractCoverageRaw,
    financialMetrics,
    overdueTasksCount,
    contractsCount,
    casesCount,
    tasksCount,
    documentsCount,
    personsCount,
  ] = await Promise.all([
    // Forfaldne opgaver (overdue section)
    prisma.task.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
        company_id: { in: companyIds },
      },
      orderBy: { due_date: 'asc' },
      take: 10,
      include: { company: { select: { id: true, name: true } } },
    }),

    // Opgaver i dag + denne/næste uge
    prisma.task.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { gte: today, lte: twoWeekEnd },
        company_id: { in: companyIds },
      },
      orderBy: { due_date: 'asc' },
      take: 20,
      include: { company: { select: { id: true, name: true } } },
    }),

    // Udløbende kontrakter (14 dage)
    prisma.contract.findMany({
      where: {
        organization_id: organizationId,
        company_id: { in: companyIds },
        deleted_at: null,
        status: 'AKTIV',
        expiry_date: { not: null, lte: twoWeekEnd },
      },
      orderBy: { expiry_date: 'asc' },
      take: 20,
      include: { company: { select: { id: true, name: true } } },
    }),

    // Åbne sager
    prisma.case.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
      },
      orderBy: { updated_at: 'desc' },
      take: 20,
      include: {
        companies: {
          include: { company: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    }),

    // Kommende besøg
    prisma.visit.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: 'PLANLAGT',
        visit_date: { gte: today, lte: twoWeekEnd },
      },
      orderBy: { visit_date: 'asc' },
      take: 10,
      include: { company: { select: { id: true, name: true } } },
    }),

    // Nye dokumenter (sidste 48h)
    prisma.document.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        created_at: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      include: {
        company: { select: { id: true, name: true } },
        extraction: { select: { extraction_status: true } },
      },
    }),

    // Alle accessible companies (til heatmap + contract coverage)
    prisma.company.findMany({
      where: {
        organization_id: organizationId,
        id: { in: companyIds },
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            cases: { where: { case: { deleted_at: null, status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] } } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),

    // Forfaldne opgaver grupperet per selskab (til heatmap urgency)
    prisma.task.groupBy({
      by: ['company_id'],
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
        company_id: { in: companyIds },
      },
      _count: true,
    }),

    // Kontrakter med system_type for coverage-matrix
    prisma.contract.findMany({
      where: {
        organization_id: organizationId,
        company_id: { in: companyIds },
        deleted_at: null,
        status: 'AKTIV',
      },
      select: { company_id: true, system_type: true },
    }),

    // Financial totals (2025)
    prisma.financialMetric.findMany({
      where: {
        organization_id: organizationId,
        company_id: { in: companyIds },
        period_year: 2025,
        period_type: 'AAR',
        metric_type: { in: ['OMSAETNING', 'EBITDA'] },
      },
      select: { company_id: true, metric_type: true, value: true },
    }),

    // Badge-counts
    prisma.task.count({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
        company_id: { in: companyIds },
      },
    }),
    prisma.contract.count({
      where: { organization_id: organizationId, company_id: { in: companyIds }, deleted_at: null, status: 'AKTIV' },
    }),
    prisma.case.count({
      where: { organization_id: organizationId, deleted_at: null, status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] } },
    }),
    prisma.task.count({
      where: { organization_id: organizationId, deleted_at: null, status: { not: 'LUKKET' }, company_id: { in: companyIds } },
    }),
    prisma.document.count({
      where: { organization_id: organizationId, deleted_at: null, company_id: { in: companyIds } },
    }),
    prisma.person.count({
      where: { organization_id: organizationId, deleted_at: null },
    }),
  ])

  // Byg badges
  const badges: Record<string, SidebarBadge | null> = {
    dashboard: null,
    calendar: upcomingVisits.length > 0 ? { count: upcomingVisits.length, urgency: 'neutral' } : null,
    portfolio: companies.length > 0 ? { count: companies.length, urgency: 'neutral' } : null,
    contracts: expiringContracts.length > 0 ? { count: expiringContracts.length, urgency: 'critical' } : null,
    cases: openCases.length > 0 ? { count: openCases.length, urgency: 'neutral' } : null,
    tasks: overdueTasksCount > 0 ? { count: overdueTasksCount, urgency: 'critical' } : null,
    documents: documentsCount > 0 ? { count: documentsCount, urgency: 'neutral' } : null,
    persons: personsCount > 0 ? { count: personsCount, urgency: 'neutral' } : null,
  }

  // Byg inline KPIs (role-adaptiv)
  const omsaetningTotal = sumMetric(financialMetrics, 'OMSAETNING')
  const ebitdaTotal = sumMetric(financialMetrics, 'EBITDA')
  const margin = omsaetningTotal > 0 ? (ebitdaTotal / omsaetningTotal) : 0

  const inlineKpis: InlineKpi[] = buildInlineKpis(role, {
    companiesCount: companies.length,
    expiringCount: expiringContracts.length,
    openCasesCount: openCases.length,
    overdueCount: overdueTasksCount,
    omsaetningTotal,
    ebitdaTotal,
    margin,
  })

  // Byg timeline sections
  const timelineSections = buildTimelineSections({
    overdueTasks,
    todayAndFutureTasks,
    expiringContracts,
    openCases,
    upcomingVisits,
    recentDocuments,
    today,
    weekEnd,
  })

  // Byg heatmap
  const overdueByCompany = new Map<string, number>()
  for (const row of tasksByCompany) {
    if (row.company_id) overdueByCompany.set(row.company_id, row._count)
  }
  const heatmap: HeatmapCompany[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    healthStatus: deriveHealth(c._count.cases, overdueByCompany.get(c.id) ?? 0),
    openCaseCount: c._count.cases,
  }))

  // Byg contract coverage
  const REQUIRED_TYPES: Array<{ type: 'EJERAFTALE' | 'LEJEKONTRAKT_ERHVERV' | 'FORSIKRING' | 'ANSAETTELSE_FUNKTIONAER'; label: string }> = [
    { type: 'EJERAFTALE', label: 'Ejeraftale' },
    { type: 'LEJEKONTRAKT_ERHVERV', label: 'Lejekontrakt' },
    { type: 'FORSIKRING', label: 'Forsikring' },
    { type: 'ANSAETTELSE_FUNKTIONAER', label: 'Ansættelse' },
  ]
  const totalCompanies = companies.length || 1
  const coverage: CoverageItem[] = REQUIRED_TYPES.map((req) => {
    const companiesWithType = new Set(
      contractCoverageRaw.filter((c) => c.system_type === req.type).map((c) => c.company_id)
    )
    return { label: req.label, pct: Math.round((companiesWithType.size / totalCompanies) * 100) }
  })

  // Underperforming = companies with EBITDA < 0 in 2025
  const underperformingIds = new Set<string>()
  const ebitdaByCompany = new Map<string, number>()
  for (const fm of financialMetrics) {
    if (fm.metric_type === 'EBITDA') {
      ebitdaByCompany.set(fm.company_id, Number(fm.value))
    }
  }
  for (const [cid, value] of ebitdaByCompany) {
    if (value < 0) underperformingIds.add(cid)
  }

  return {
    badges,
    inlineKpis,
    timelineSections,
    heatmap,
    coverage,
    portfolioTotals: {
      totalOmsaetning: omsaetningTotal,
      totalEbitda: ebitdaTotal,
      avgEbitdaMargin: margin,
    },
    underperformingCount: underperformingIds.size,
    role,
  }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function sumMetric(
  rows: Array<{ metric_type: string; value: { toString(): string } | number }>,
  type: string
): number {
  let sum = 0
  for (const row of rows) {
    if (row.metric_type === type) {
      sum += Number(row.value)
    }
  }
  return sum
}

function deriveHealth(openCases: number, overdueTasks: number): 'healthy' | 'warning' | 'critical' {
  if (overdueTasks > 0) return 'critical'
  if (openCases > 0) return 'warning'
  return 'healthy'
}

function formatMio(val: number): string {
  return (val / 1_000_000).toFixed(1)
}

function buildInlineKpis(
  role: string,
  data: {
    companiesCount: number
    expiringCount: number
    openCasesCount: number
    overdueCount: number
    omsaetningTotal: number
    ebitdaTotal: number
    margin: number
  }
): InlineKpi[] {
  if (role === 'GROUP_LEGAL') {
    return [
      { label: 'Udløbende', value: String(data.expiringCount), color: data.expiringCount > 0 ? 'amber' : undefined },
      { label: 'Sager', value: String(data.openCasesCount) },
      { label: 'Forfaldne', value: String(data.overdueCount), color: data.overdueCount > 0 ? 'red' : undefined },
    ]
  }
  if (role === 'GROUP_FINANCE') {
    return [
      { label: 'Omsætning', value: `${formatMio(data.omsaetningTotal)}m` },
      { label: 'EBITDA', value: `${formatMio(data.ebitdaTotal)}m` },
      { label: 'Margin', value: `${(data.margin * 100).toFixed(1)}%` },
      { label: 'Forfaldne', value: String(data.overdueCount), color: data.overdueCount > 0 ? 'red' : undefined },
    ]
  }
  // GROUP_OWNER and default
  return [
    { label: 'Selskaber', value: String(data.companiesCount) },
    { label: 'Udløbende', value: String(data.expiringCount), color: data.expiringCount > 0 ? 'amber' : undefined },
    { label: 'Sager', value: String(data.openCasesCount) },
    { label: 'Forfaldne', value: String(data.overdueCount), color: data.overdueCount > 0 ? 'red' : undefined },
  ]
}

function firstLetter(name: string | null | undefined): string {
  return (name ?? '?').charAt(0).toUpperCase()
}

function relativeDays(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

interface TimelineRawData {
  overdueTasks: Array<{ id: string; title: string; due_date: Date | null; company: { id: string; name: string } | null }>
  todayAndFutureTasks: Array<{ id: string; title: string; due_date: Date | null; company: { id: string; name: string } | null }>
  expiringContracts: Array<{ id: string; display_name: string; expiry_date: Date | null; company: { id: string; name: string } }>
  openCases: Array<{ id: string; title: string; status: string; companies: Array<{ company: { id: string; name: string } }> }>
  upcomingVisits: Array<{ id: string; visit_date: Date; visit_type: string; company: { id: string; name: string } }>
  recentDocuments: Array<{ id: string; filename: string; company_id: string | null; company: { id: string; name: string } | null; extraction: { extraction_status: string } | null }>
  today: Date
  weekEnd: Date
}

function buildTimelineSections(data: TimelineRawData): TimelineSectionData[] {
  const { overdueTasks, todayAndFutureTasks, expiringContracts, openCases, upcomingVisits, recentDocuments, today, weekEnd } = data

  // Overdue
  const overdueItems: TimelineItem[] = []
  for (const t of overdueTasks.slice(0, 5)) {
    const days = Math.abs(relativeDays(today, t.due_date ?? today))
    overdueItems.push({
      id: `task-${t.id}`,
      letter: firstLetter(t.company?.name),
      color: 'red',
      title: t.title,
      subtitle: t.company ? `${t.company.name} · ${days}d over frist` : `${days}d over frist`,
      time: `${days}d over`,
      href: '/tasks',
    })
  }
  for (const c of expiringContracts.filter((c) => c.expiry_date && c.expiry_date < today).slice(0, 3)) {
    overdueItems.push({
      id: `contract-${c.id}`,
      letter: firstLetter(c.company.name),
      color: 'amber',
      title: c.display_name,
      subtitle: `${c.company.name} · udløbet`,
      time: 'Udløbet',
      href: `/contracts/${c.id}`,
    })
  }

  // Today
  const todayItems: TimelineItem[] = []
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  for (const v of upcomingVisits.filter((v) => v.visit_date >= todayStart && v.visit_date <= todayEnd).slice(0, 5)) {
    const time = v.visit_date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    todayItems.push({
      id: `visit-${v.id}`,
      letter: firstLetter(v.company.name),
      color: 'blue',
      title: `Besøg — ${v.company.name}`,
      subtitle: v.visit_type.toLowerCase(),
      time,
      href: `/companies/${v.company.id}`,
    })
  }
  for (const t of todayAndFutureTasks.filter((t) => t.due_date && t.due_date >= todayStart && t.due_date <= todayEnd).slice(0, 3)) {
    todayItems.push({
      id: `task-today-${t.id}`,
      letter: firstLetter(t.company?.name),
      color: 'amber',
      title: t.title,
      subtitle: t.company ? `${t.company.name} · Frist i dag` : 'Frist i dag',
      time: 'Frist',
      href: '/tasks',
    })
  }
  for (const d of recentDocuments.slice(0, 2)) {
    todayItems.push({
      id: `doc-${d.id}`,
      letter: firstLetter(d.company?.name),
      color: 'purple',
      title: d.filename,
      subtitle: d.company ? `${d.company.name} · Uploadet` : 'Uploadet',
      aiExtracted: d.extraction !== null,
      time: 'Ny',
      href: '/documents',
    })
  }

  // This week (dag efter i dag → weekEnd)
  const thisweekItems: TimelineItem[] = []
  for (const v of upcomingVisits.filter((v) => v.visit_date > todayEnd && v.visit_date <= weekEnd).slice(0, 3)) {
    thisweekItems.push({
      id: `visit-week-${v.id}`,
      letter: firstLetter(v.company.name),
      color: 'blue',
      title: `Besøg — ${v.company.name}`,
      subtitle: v.visit_type.toLowerCase(),
      time: v.visit_date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }),
      href: `/companies/${v.company.id}`,
    })
  }
  for (const c of expiringContracts.filter((c) => c.expiry_date && c.expiry_date > todayEnd && c.expiry_date <= weekEnd).slice(0, 3)) {
    thisweekItems.push({
      id: `contract-week-${c.id}`,
      letter: firstLetter(c.company.name),
      color: 'amber',
      title: c.display_name,
      subtitle: `${c.company.name} · udløber`,
      time: c.expiry_date!.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }),
      href: `/contracts/${c.id}`,
    })
  }

  // Next week (weekEnd → +7 days)
  const nextweekItems: TimelineItem[] = []
  for (const c of expiringContracts.filter((c) => c.expiry_date && c.expiry_date > weekEnd).slice(0, 3)) {
    nextweekItems.push({
      id: `contract-next-${c.id}`,
      letter: firstLetter(c.company.name),
      color: 'green',
      title: c.display_name,
      subtitle: `${c.company.name} · udløber`,
      time: c.expiry_date!.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }),
      href: `/contracts/${c.id}`,
    })
  }
  for (const ca of openCases.slice(0, 2)) {
    nextweekItems.push({
      id: `case-${ca.id}`,
      letter: firstLetter(ca.companies[0]?.company.name),
      color: 'purple',
      title: ca.title,
      subtitle: ca.companies[0]?.company.name ?? 'Sag',
      time: 'Aktiv',
      href: `/cases/${ca.id}`,
    })
  }

  return [
    { id: 'overdue', label: 'Overskredet', dotType: 'overdue', items: overdueItems },
    { id: 'today', label: 'I dag', dotType: 'today', items: todayItems },
    { id: 'thisweek', label: 'Denne uge', dotType: 'future', items: thisweekItems },
    { id: 'nextweek', label: 'Næste uge', dotType: 'future', items: nextweekItems },
  ]
}

function emptyDashboardData(role: string): DashboardData {
  return {
    badges: {},
    inlineKpis: [
      { label: 'Selskaber', value: '0' },
      { label: 'Sager', value: '0' },
      { label: 'Forfaldne', value: '0' },
    ],
    timelineSections: [
      { id: 'overdue', label: 'Overskredet', dotType: 'overdue', items: [] },
      { id: 'today', label: 'I dag', dotType: 'today', items: [] },
      { id: 'thisweek', label: 'Denne uge', dotType: 'future', items: [] },
      { id: 'nextweek', label: 'Næste uge', dotType: 'future', items: [] },
    ],
    heatmap: [],
    coverage: [
      { label: 'Ejeraftale', pct: 0 },
      { label: 'Lejekontrakt', pct: 0 },
      { label: 'Forsikring', pct: 0 },
      { label: 'Ansættelse', pct: 0 },
    ],
    portfolioTotals: { totalOmsaetning: 0, totalEbitda: 0, avgEbitdaMargin: 0 },
    underperformingCount: 0,
    role,
  }
}
```

- [ ] **Step 4.2: Write smoke test**

Create `src/__tests__/dashboard-actions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getDashboardData } from '@/actions/dashboard'

// Smoke test: uses seed-brugeren philip@chainhub.dk via org-id
// Kræver at local database er seeded med `npx prisma db seed`.
// Springer over hvis DATABASE_URL ikke er sat.
describe.runIf(!!process.env.DATABASE_URL)('getDashboardData', () => {
  const seedUserId = '00000000-0000-0000-0000-000000010001' // philip@chainhub.dk from seed
  const seedOrgId = '00000000-0000-0000-0000-000000009001'

  it('returnerer DashboardData shape', async () => {
    const data = await getDashboardData(seedUserId, seedOrgId)
    expect(data).toHaveProperty('badges')
    expect(data).toHaveProperty('inlineKpis')
    expect(data.timelineSections).toHaveLength(4)
    expect(data.coverage).toHaveLength(4)
    expect(data.role).toBeDefined()
  })

  it('håndterer bruger uden selskaber', async () => {
    const data = await getDashboardData('nonexistent-user-id', seedOrgId)
    expect(data.heatmap).toHaveLength(0)
    expect(data.timelineSections.every((s) => s.items.length === 0)).toBe(true)
  })
})
```

Note: If the seed user IDs don't match, update them by running `npx prisma studio` and finding `philip@chainhub.dk`. The test skips if `DATABASE_URL` is absent so CI without a DB still passes.

- [ ] **Step 4.3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If errors, likely related to Prisma types — check relation names against `prisma/schema.prisma`.

- [ ] **Step 4.4: Run smoke test**

Run: `npx vitest run src/__tests__/dashboard-actions.test.ts`
Expected: 2 tests pass (or skip if no DB).

- [ ] **Step 4.5: Commit**

```bash
git add src/actions/dashboard.ts src/__tests__/dashboard-actions.test.ts
git commit -m "feat(actions): add dashboard aggregator action

Samler badges, inline KPIs, timeline items, heatmap, coverage og
financial totals i én parallel Prisma-batch. Rollespecifik
InlineKpi-vælger for GROUP_OWNER / GROUP_LEGAL / GROUP_FINANCE."
```

---

## Task 5: HeatmapGrid component

**Files:**
- Create: `src/components/dashboard/heatmap-grid.tsx`
- Test: `src/__tests__/components/heatmap-grid.test.tsx`

- [ ] **Step 5.1: Create component**

Create `src/components/dashboard/heatmap-grid.tsx`:

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { HeatmapCompany } from '@/actions/dashboard'

export interface HeatmapGridProps {
  companies: HeatmapCompany[]
}

function shortName(name: string): string {
  return name
    .replace(' ApS', '')
    .replace(' Tandlægehus', '')
    .replace(' Tandklinik', '')
    .replace(' Tandlæge', '')
    .replace(' Tandhus', '')
}

export function HeatmapGrid({ companies }: HeatmapGridProps) {
  const sorted = [...companies]
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, healthy: 2 }
      return order[a.healthStatus] - order[b.healthStatus]
    })
    .slice(0, 15)

  if (sorted.length === 0) {
    return <p className="text-center text-xs text-gray-400 py-4">Ingen selskaber</p>
  }

  return (
    <div className="grid grid-cols-5 gap-1">
      {sorted.map((c) => {
        const cellClass =
          c.healthStatus === 'critical'
            ? 'bg-red-50 border border-red-200 text-red-800'
            : c.healthStatus === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-green-50 border border-green-200 text-green-800'
        return (
          <Link
            key={c.id}
            href={`/companies/${c.id}`}
            className={cn(
              'rounded p-1 text-center cursor-pointer hover:opacity-80 transition-opacity no-underline',
              cellClass
            )}
          >
            <div className="text-[11px] font-bold leading-tight">
              {c.openCaseCount > 0 ? c.openCaseCount : '·'}
            </div>
            <div className="text-[8px] leading-tight truncate">{shortName(c.name)}</div>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5.2: Write test**

Create `src/__tests__/components/heatmap-grid.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeatmapGrid } from '@/components/dashboard/heatmap-grid'
import type { HeatmapCompany } from '@/actions/dashboard'

const companies: HeatmapCompany[] = [
  { id: 'c1', name: 'Tandlæge Aalborg ApS', healthStatus: 'critical', openCaseCount: 2 },
  { id: 'c2', name: 'Tandlæge Aarhus ApS', healthStatus: 'warning', openCaseCount: 1 },
  { id: 'c3', name: 'Tandlæge Odense ApS', healthStatus: 'healthy', openCaseCount: 0 },
]

describe('HeatmapGrid', () => {
  it('renderer forkortede navne', () => {
    render(<HeatmapGrid companies={companies} />)
    expect(screen.getByText('Aalborg')).toBeInTheDocument()
    expect(screen.getByText('Aarhus')).toBeInTheDocument()
    expect(screen.getByText('Odense')).toBeInTheDocument()
  })

  it('sorterer critical først', () => {
    render(<HeatmapGrid companies={companies} />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/companies/c1') // critical
    expect(links[1]).toHaveAttribute('href', '/companies/c2') // warning
    expect(links[2]).toHaveAttribute('href', '/companies/c3') // healthy
  })

  it('viser openCaseCount når > 0, ellers dot', () => {
    render(<HeatmapGrid companies={companies} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('·')).toBeInTheDocument()
  })

  it('viser tom-state ved ingen selskaber', () => {
    render(<HeatmapGrid companies={[]} />)
    expect(screen.getByText('Ingen selskaber')).toBeInTheDocument()
  })

  it('capper ved 15 selskaber', () => {
    const many: HeatmapCompany[] = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      name: `Company ${i}`,
      healthStatus: 'healthy' as const,
      openCaseCount: 0,
    }))
    render(<HeatmapGrid companies={many} />)
    expect(screen.getAllByRole('link')).toHaveLength(15)
  })
})
```

- [ ] **Step 5.3: Run test**

Run: `npx vitest run src/__tests__/components/heatmap-grid.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 5.4: Commit**

```bash
git add src/components/dashboard/heatmap-grid.tsx src/__tests__/components/heatmap-grid.test.tsx
git commit -m "feat(dashboard): add HeatmapGrid component with unit tests"
```

---

## Task 6: TimelineSection component

**Files:**
- Create: `src/components/dashboard/timeline-section.tsx`
- Test: `src/__tests__/components/timeline-section.test.tsx`

- [ ] **Step 6.1: Create component**

Create `src/components/dashboard/timeline-section.tsx`:

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { TimelineSectionData, TimelineColor } from '@/actions/dashboard'

export interface TimelineSectionProps {
  section: TimelineSectionData
}

function colorClass(c: TimelineColor): string {
  switch (c) {
    case 'red':    return 'bg-red-50 text-red-600'
    case 'amber':  return 'bg-amber-50 text-amber-600'
    case 'blue':   return 'bg-blue-50 text-blue-600'
    case 'purple': return 'bg-purple-50 text-purple-600'
    case 'green':  return 'bg-green-50 text-green-600'
    case 'gray':   return 'bg-slate-50 text-slate-500'
  }
}

export function TimelineSection({ section }: TimelineSectionProps) {
  if (section.items.length === 0) return null

  const dotClass = cn(
    'absolute left-[-19px] top-[3px] w-2.5 h-2.5 rounded-full border-2',
    section.dotType === 'overdue' && 'border-red-500 bg-red-50',
    section.dotType === 'today' && 'border-blue-500 bg-blue-500',
    section.dotType === 'future' && 'border-gray-300 bg-gray-50',
  )

  const labelClass = cn(
    'text-[11px] font-semibold mb-2',
    section.dotType === 'overdue' && 'text-red-600',
    section.dotType === 'today' && 'text-blue-600',
    section.dotType === 'future' && 'text-gray-500',
  )

  return (
    <div className="relative pl-5 mb-5">
      <div className="absolute left-[5px] top-[4px] bottom-0 w-0.5 bg-gray-200" />

      <div className="relative mb-2">
        <div className={dotClass} />
        <div className={labelClass}>{section.label}</div>
      </div>

      {section.items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-2.5 mb-1.5 cursor-pointer hover:shadow-sm hover:border-gray-300 transition-all no-underline"
        >
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0', colorClass(item.color))}>
            {item.letter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-800">{item.title}</div>
            <div className="text-[10px] text-gray-400">{item.subtitle}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.aiExtracted && (
              <span className="text-[8px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">AI</span>
            )}
            <span className="text-[10px] tabular-nums text-gray-400">{item.time}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 6.2: Write test**

Create `src/__tests__/components/timeline-section.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimelineSection } from '@/components/dashboard/timeline-section'
import type { TimelineSectionData } from '@/actions/dashboard'

const section: TimelineSectionData = {
  id: 'overdue',
  label: 'Overskredet',
  dotType: 'overdue',
  items: [
    { id: 't1', letter: 'N', color: 'red', title: 'Ejeraftale Nordklinik', subtitle: 'Nordklinik · 3d over', time: '3d over', href: '/contracts/c1' },
    { id: 't2', letter: 'S', color: 'purple', title: 'Dokument', subtitle: 'Sundby · AI', aiExtracted: true, time: 'Ny', href: '/documents' },
  ],
}

describe('TimelineSection', () => {
  it('viser sektion-label', () => {
    render(<TimelineSection section={section} />)
    expect(screen.getByText('Overskredet')).toBeInTheDocument()
  })

  it('viser alle items', () => {
    render(<TimelineSection section={section} />)
    expect(screen.getByText('Ejeraftale Nordklinik')).toBeInTheDocument()
    expect(screen.getByText('Dokument')).toBeInTheDocument()
  })

  it('viser AI-badge for aiExtracted items', () => {
    render(<TimelineSection section={section} />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('links peger på item.href', () => {
    render(<TimelineSection section={section} />)
    const link = screen.getByRole('link', { name: /Ejeraftale Nordklinik/ })
    expect(link).toHaveAttribute('href', '/contracts/c1')
  })

  it('returnerer null for tom sektion', () => {
    const empty: TimelineSectionData = { ...section, items: [] }
    const { container } = render(<TimelineSection section={empty} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 6.3: Run test**

Run: `npx vitest run src/__tests__/components/timeline-section.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 6.4: Commit**

```bash
git add src/components/dashboard/timeline-section.tsx src/__tests__/components/timeline-section.test.tsx
git commit -m "feat(dashboard): add TimelineSection component with unit tests"
```

---

## Task 7: Dashboard page rewrite

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx` — full rewrite (replacing existing ~600-line production dashboard)
- Create: `src/app/(dashboard)/dashboard/right-panels.tsx` — Server Component for role-specific right panels

- [ ] **Step 7.1: Create right-panels.tsx**

Create `src/app/(dashboard)/dashboard/right-panels.tsx`:

```tsx
import { FinRow } from '@/components/ui/fin-row'
import { CoverageBar } from '@/components/ui/coverage-bar'
import { CalendarWidget } from '@/components/ui/calendar-widget'
import { HeatmapGrid } from '@/components/dashboard/heatmap-grid'
import type { DashboardData } from '@/actions/dashboard'
import type { CalendarEvent } from '@/types/ui'

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3.5">
      <div className="text-[11px] font-semibold text-slate-900 mb-2.5">{title}</div>
      {children}
    </div>
  )
}

function formatMio(val: number): string {
  return (val / 1_000_000).toFixed(1)
}

export interface RightPanelsProps {
  data: DashboardData
  calendarEvents: CalendarEvent[]
  upcomingEvents: CalendarEvent[]
  todayISO: string
}

export function RightPanels({ data, calendarEvents, upcomingEvents, todayISO }: RightPanelsProps) {
  if (data.role === 'GROUP_LEGAL') {
    return (
      <div className="space-y-3">
        <Panel title="Kontraktdækning">
          {data.coverage.map((item) => (
            <CoverageBar key={item.label} label={item.label} percentage={item.pct} />
          ))}
        </Panel>
        <CalendarWidget events={calendarEvents} upcoming={upcomingEvents} today={todayISO} />
      </div>
    )
  }

  if (data.role === 'GROUP_FINANCE') {
    return (
      <div className="space-y-3">
        <Panel title="Nøgletal 2025">
          <FinRow label="Omsætning" value={`${formatMio(data.portfolioTotals.totalOmsaetning)}M`} />
          <FinRow label="EBITDA" value={`${formatMio(data.portfolioTotals.totalEbitda)}M`} />
          <FinRow label="Margin" value={`${(data.portfolioTotals.avgEbitdaMargin * 100).toFixed(1)}%`} />
          <FinRow
            label="Underskud lok."
            value={String(data.underperformingCount)}
            valueColor={data.underperformingCount > 0 ? '#ef4444' : undefined}
          />
        </Panel>
        <CalendarWidget events={calendarEvents} upcoming={upcomingEvents} today={todayISO} />
      </div>
    )
  }

  // GROUP_OWNER + default
  return (
    <div className="space-y-3">
      <Panel title="Porteføljeoverblik">
        <HeatmapGrid companies={data.heatmap} />
      </Panel>
      <CalendarWidget events={calendarEvents} upcoming={upcomingEvents} today={todayISO} />
      <Panel title="Kontraktdækning">
        {data.coverage.map((item) => (
          <CoverageBar key={item.label} label={item.label} percentage={item.pct} />
        ))}
      </Panel>
      <Panel title="Økonomi snapshot">
        <FinRow label="Omsætning" value={`${formatMio(data.portfolioTotals.totalOmsaetning)}M`} />
        <FinRow label="EBITDA" value={`${formatMio(data.portfolioTotals.totalEbitda)}M`} />
        <FinRow
          label="Underskud lok."
          value={String(data.underperformingCount)}
          valueColor={data.underperformingCount > 0 ? '#ef4444' : undefined}
        />
      </Panel>
    </div>
  )
}
```

- [ ] **Step 7.2: Replace dashboard/page.tsx**

Replace `src/app/(dashboard)/dashboard/page.tsx` entirely with:

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/actions/dashboard'
import { TimelineSection } from '@/components/dashboard/timeline-section'
import { RightPanels } from './right-panels'
import type { CalendarEvent } from '@/types/ui'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const data = await getDashboardData(session.user.id, session.user.organizationId)
  const todayISO = new Date().toISOString().slice(0, 10)

  // For nu: tomme calendar events (populeres i Plan 4C når /calendar er færdig)
  const calendarEvents: CalendarEvent[] = []
  const upcomingEvents: CalendarEvent[] = []

  return (
    <div className="p-5 h-full">
      <div className="grid grid-cols-[1fr_320px] gap-5 max-w-[1400px] mx-auto">
        {/* Venstre: Timeline River */}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 mb-4">Tidslinje</div>
          {data.timelineSections.map((section) => (
            <TimelineSection key={section.id} section={section} />
          ))}
          {data.timelineSections.every((s) => s.items.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-gray-500">Ingen begivenheder</p>
              <p className="text-xs text-gray-400 mt-1">Din tidslinje er tom lige nu.</p>
            </div>
          )}
        </div>

        {/* Højre: Rolle-specifikke paneler */}
        <div className="min-w-0">
          <RightPanels
            data={data}
            calendarEvents={calendarEvents}
            upcomingEvents={upcomingEvents}
            todayISO={todayISO}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7.3: Typecheck + build**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → success. The dashboard page is the most complex one — if it compiles clean, the plan-level data flow is correct.

- [ ] **Step 7.4: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx src/app/\(dashboard\)/dashboard/right-panels.tsx
git commit -m "feat(dashboard): rewrite page til proto Timeline River + role panels

Erstatter det gamle single-column dashboard med proto-designet:
venstre kolonne timeline med 4 sektioner (overskredet/i dag/denne
uge/næste uge), højre kolonne med rolle-specifikke paneler.

Data hentes server-side via getDashboardData() Server Action."
```

---

## Task 8: Layout swap (AppSidebar + AppHeader)

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx` — replace Sidebar/Header/MobileNav with AppSidebar/AppHeader
- Delete: `src/components/layout/sidebar.tsx`
- Delete: `src/components/layout/header.tsx`
- Delete: `src/components/layout/MobileNav.tsx`
- Modify: `src/lib/sidebar-data.ts` — add `buildSidebarBadges()` adapter function

- [ ] **Step 8.1: Add badge adapter to sidebar-data.ts**

Read `src/lib/sidebar-data.ts` and find the `SidebarData` interface. After the `getSidebarData` function, add:

```ts
import type { SidebarBadge, InlineKpi } from '@/types/ui'

/**
 * Adapter: transformér SidebarData counts → AppSidebarProps.badges record.
 */
export function buildSidebarBadges(data: SidebarData): Record<string, SidebarBadge | null> {
  return {
    dashboard: null,
    calendar: data.visitsCount > 0 ? { count: data.visitsCount, urgency: 'neutral' } : null,
    portfolio: data.companiesCount > 0 ? { count: data.companiesCount, urgency: 'neutral' } : null,
    contracts: data.contractsCount > 0 ? { count: data.contractsCount, urgency: 'neutral' } : null,
    cases: data.casesCount > 0 ? { count: data.casesCount, urgency: 'neutral' } : null,
    tasks: data.overdueTasksCount > 0
      ? { count: data.overdueTasksCount, urgency: 'critical' }
      : data.tasksCount > 0 ? { count: data.tasksCount, urgency: 'neutral' } : null,
    documents: data.documentsCount > 0 ? { count: data.documentsCount, urgency: 'neutral' } : null,
    persons: data.personsCount > 0 ? { count: data.personsCount, urgency: 'neutral' } : null,
  }
}
```

- [ ] **Step 8.2: Rewrite layout.tsx**

Replace `src/app/(dashboard)/layout.tsx`:

```tsx
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { Providers } from '@/components/providers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSidebarData, buildSidebarBadges } from '@/lib/sidebar-data'
import type { InlineKpi } from '@/types/ui'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const sidebarData = await getSidebarData(
    session.user.id,
    session.user.organizationId
  )
  const badges = buildSidebarBadges(sidebarData)

  // Header inline KPIs — generisk 3-tal for layout-niveau
  const headerKpis: InlineKpi[] = [
    { label: 'Selskaber', value: String(sidebarData.companiesCount) },
    { label: 'Sager', value: String(sidebarData.casesCount) },
    {
      label: 'Forfaldne',
      value: String(sidebarData.overdueTasksCount),
      color: sidebarData.overdueTasksCount > 0 ? 'red' : undefined,
    },
  ]

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden">
        <div className="hidden lg:flex h-full">
          <AppSidebar
            userName={session.user.name ?? 'Bruger'}
            userRoleLabel={sidebarData.userRoleLabel}
            badges={badges}
          />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            userName={session.user.name ?? 'Bruger'}
            kpis={headerKpis}
            currentDate={new Date()}
          />
          <main className="flex-1 overflow-y-auto bg-[#f0f2f5]">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  )
}
```

Note: Removed `MobileNav` entirely. The proto design doesn't have a mobile nav variant; the `hidden lg:flex` means sidebar is hidden on mobile. A mobile drawer can be added in a later polish task if needed.

- [ ] **Step 8.3: Delete legacy files**

```bash
git rm src/components/layout/sidebar.tsx
git rm src/components/layout/header.tsx
git rm src/components/layout/MobileNav.tsx
```

- [ ] **Step 8.4: Check for lingering imports**

Run: `grep -rn "from '@/components/layout/sidebar'" src`
Run: `grep -rn "from '@/components/layout/header'" src`
Run: `grep -rn "from '@/components/layout/MobileNav'" src`

Expected: no matches. If any file still imports these, that file needs to be updated to use `app-sidebar`/`app-header` or adapted otherwise.

- [ ] **Step 8.5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8.6: Build**

Run: `npm run build`
Expected: success. All routes still compile.

- [ ] **Step 8.7: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx src/lib/sidebar-data.ts
git commit -m "feat(layout): swap to AppSidebar + AppHeader, delete legacy

(dashboard)/layout.tsx bruger nu proto-designet AppSidebar og
AppHeader. Gamle sidebar.tsx, header.tsx og MobileNav.tsx slettet
(disse blev gjort overflødige af Plan 4B).

buildSidebarBadges() adapter mapper SidebarData counts til
AppSidebarProps.badges record-form."
```

---

## Task 9: Smoke test + visual audit

**Files:** none (validation only)

- [ ] **Step 9.1: Full test suite**

Run: `npm test -- --run`
Expected: all previous tests + new component tests + dashboard-actions test pass. Target: 245+ tests passing.

- [ ] **Step 9.2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 9.3: Full build**

Run: `npm run build`
Expected: success. Review output — confirm `/dashboard` route still builds.

- [ ] **Step 9.4: Cleanup .next**

Run: `rm -rf .next`

- [ ] **Step 9.5: Start dev server**

Run: `npm run dev` (background)
Expected: "ready" on http://localhost:3000.

- [ ] **Step 9.6: Smoke test via curl**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard
```
Expected: 307 (redirect to login — normal since unauthenticated).

- [ ] **Step 9.7: Playwright visual audit**

Open Playwright MCP. Log in as `philip@chainhub.dk / password123`. Navigate to `/dashboard`. Take a fullpage screenshot. Confirm:
- Proto-designed dark sidebar is visible on left
- Top header shows greeting, date, inline KPIs
- Main area has "Tidslinje" header + 2-column layout
- Right side shows rolle-specifikke panels
- No hydration warnings in browser console
- No 404s in browser network tab

If any issue found, stop and report. If visual is OK, proceed to final commit.

- [ ] **Step 9.8: Final status commit**

If there were no code changes from Task 9, skip the commit. Otherwise:

```bash
git add <affected-files>
git commit -m "fix(dashboard): rettelser efter Plan 4B visuelt audit"
```

---

## Completion checklist

- [ ] Task 0: HealthBar empty-state fixed (4 tests pass)
- [ ] Task 1: AppHeader SSR hydration fixed (8 tests pass)
- [ ] Task 2: `'use client'` dropped from 3 pure atoms
- [ ] Task 3: CONVENTIONS.md updated
- [ ] Task 4: Dashboard Server Action created (smoke test passes or skips)
- [ ] Task 5: HeatmapGrid component (5 tests pass)
- [ ] Task 6: TimelineSection component (5 tests pass)
- [ ] Task 7: Dashboard page rewritten
- [ ] Task 8: Layout swapped, legacy files deleted, no lingering imports
- [ ] Task 9: Full test + build + Playwright visual audit green
- [ ] Pushed to remote

## What comes next

**Plan 4C: Remaining pages**
- `/tasks` list + `/tasks/[id]` detail rewrite
- `/calendar` full page (replaces `/visits`, wires real CalendarEvents into `CalendarWidget` on dashboard)
- `/search` global search
- `/settings`
- `/companies/[id]` rewrite (single-page proto design replacing existing subpages)
- Delete `/visits` after `/calendar` takes over
