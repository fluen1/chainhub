# Stream F — Performance & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminér permission-waterfall (2–5 DB-kald/request → 1), ret getCasesPageData til JOIN-baseret pagination, tilføj WCAG-korrekte ARIA-attributter på tabel-headers/toggles/skeletons, og tilføj Prisma Task→Company relation + FinancialMetric compound index.

**Architecture:** Fire uafhængige fixes: (A) React `cache()` wrapper på `getUserRoles` eliminerer duplikerede DB-kald inden for én Server Component request lifecycle. (B) `getCasesPageData` dropper den ubegrænsede `CaseCompany` pre-fetch og bruger i stedet `case_companies: { some: ... }` direkte i `Case.findMany` WHERE — identisk mønster som `dashboard.ts:110-113`. (C) ARIA quick-wins er rene komponent-rettelser uden logikændringer. (D) Prisma schema-ændringer (Task→Company relation + FinancialMetric index) + lazy person-dropdown + peer-metrics cache.

**Tech Stack:** Next.js 16 (React `cache()` fra `react`), Prisma 6, Vitest (`vi.mock`), Playwright (axe), TypeScript strict.

**Forudsætning:** Stream A (baseline migration) er merged til main. Disse ændringer tilføjer én ny Prisma-migration (Task→Company relation i Task D).

---

## Vigtigt før start

- **ChainHub ikke-forhandlingsbare:** `organization_id + deleted_at: null` på alle queries; `auth()` internt i actions; ingen `any`; KUN Tailwind.
- **Commit-stil:** `[type]: beskrivelse på dansk` (feat/fix/refactor/perf/a11y).
- **Test-kørsel:** `npm test` fra `C:\Users\birke\Projects\chainhub`.
- Task A, B, C kan køres parallelt. Task D afhænger af A (migration-baseline eksisterer).

---

## Filer der berøres

| Fil                                                          | Handling                                                              | Task |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | ---- |
| `src/lib/permissions/index.ts`                               | Modificér — wrap `getUserRoles` med `cache()`                         | A    |
| `src/__tests__/permissions-cache.test.ts`                    | Opret — query-count-assertion                                         | A    |
| `src/actions/cases.ts`                                       | Modificér — fjern CaseCompany pre-fetch, brug `some`                  | B    |
| `src/actions/cases.ts`                                       | Modificér — static imports øverst (linje 625-626)                     | B    |
| `src/__tests__/actions/cases-pagination.test.ts`             | Opret — verificér korrekt Prisma-kald                                 | B    |
| `src/components/ui/b/DataTable.tsx`                          | Modificér — `aria-sort` + `aria-hidden` på sort-pil                   | C    |
| `src/components/tasks/TasksGroupedView.tsx`                  | Modificér — `aria-expanded` + `aria-controls` + `useId`               | C    |
| `src/components/persons/GdprPanel.tsx`                       | Modificér — `role="alert"` på fejl-paragraf                           | C    |
| `src/components/ui/page-skeleton.tsx`                        | Modificér — `role="status"` + `aria-label` + `aria-busy`              | C    |
| `prisma/schema.prisma`                                       | Modificér — Task→Company relation + FinancialMetric index             | D    |
| `prisma/migrations/<ts>_task_company_relation/migration.sql` | Opret (via `prisma migrate dev`)                                      | D    |
| `src/actions/tasks.ts`                                       | Modificér — brug `include: { company: ... }` i stedet for extra query | D    |
| `src/actions/contracts.ts`                                   | Modificér — fjern person-query fra `getContractDetailPageData`        | D    |
| `src/actions/contract-persons.ts`                            | Opret — ny lazy-load action til persons-dropdown                      | D    |
| `src/actions/company-detail.ts`                              | Modificér — wrap peer-metrics i `unstable_cache`                      | D    |

---

## Task A: getUserRoles React cache() — eliminér permission-waterfall

**Files:**

- Modify: `src/lib/permissions/index.ts:1-49`
- Create: `src/__tests__/permissions-cache.test.ts`

### Kontekst

`getUserRoles(userId, orgId)` kaldes ét DB-kald per helper-funktion (`canAccessCompany`, `canAccessSensitivity`, `canAccessModule`, `getAllowedSensitivityLevels`, `getAccessibleCompanies`). Kaldes de i Promise.all er det 2+ DB-kald til samme tabel per request. React `cache()` deduplicerer kald med samme argumenter inden for én server-render-pass.

**Vigtigt:** `cache()` fra `react` er kun effektiv i Server Components / Server Actions i Next.js 15+. Den nulstilles automatisk per request.

- [ ] **Step 1: Skriv den fejlende test**

Opret `src/__tests__/permissions-cache.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma FØR import af permissions-modulet
vi.mock('@/lib/db', () => ({
  prisma: {
    userRoleAssignment: {
      findMany: vi.fn(),
    },
  },
}))

// Mock React cache — vi.mock af 'react' ville bryde for meget,
// så vi tester via spy på prisma.userRoleAssignment.findMany direkte
import { prisma } from '@/lib/db'
import { canAccessCompany, getAllowedSensitivityLevels } from '@/lib/permissions'

describe('getUserRoles cache deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Returner én GROUP_OWNER ALL-scope assignment
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_OWNER', scope: 'ALL', company_ids: [] },
    ] as never)
  })

  it('kalder DB kun én gang når to permission-helpers bruges med samme userId+orgId', async () => {
    const userId = 'user-1'
    const orgId = 'org-1'

    // Kald begge helpers sekventielt (simulerer hvad en Server Action gør)
    await canAccessCompany(userId, 'company-1', orgId)
    await getAllowedSensitivityLevels(userId, orgId)

    // Med cache() deduplicering: kun ét DB-kald (i stedet for 2)
    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledWith({
      where: { user_id: userId, organization_id: orgId },
      select: { role: true, scope: true, company_ids: true },
    })
  })

  it('kalder DB to gange ved forskellig userId — ingen cross-user cache-leak', async () => {
    await canAccessCompany('user-A', 'company-1', 'org-1')
    await canAccessCompany('user-B', 'company-1', 'org-1')

    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Kør test — forvent FAIL**

```bash
npm test -- --reporter=verbose src/__tests__/permissions-cache.test.ts
```

Expected: `AssertionError: expected 2 to equal 1` — DB kaldes 2 gange fordi cache() ikke er sat.

- [ ] **Step 3: Tilføj React cache() wrapper i permissions/index.ts**

Åbn `src/lib/permissions/index.ts`. Tilføj `cache` import og wrap `getUserRoles`:

```typescript
import { cache } from 'react'
import { type SensitivityLevel, type UserRole } from '@prisma/client'
import { prisma } from '@/lib/db'
```

Erstat den eksisterende `async function getUserRoles(...)` (linje 33-49) med:

```typescript
const getUserRoles = cache(
  async (
    userId: string,
    organizationId: string
  ): Promise<
    Array<{
      role: UserRole
      scope: string
      company_ids: string[]
    }>
  > => {
    // organization_id-filter forhindrer cross-tenant rolle-leak ved UUID-kollision
    const assignments = await prisma.userRoleAssignment.findMany({
      where: { user_id: userId, organization_id: organizationId },
      select: { role: true, scope: true, company_ids: true },
    })
    return assignments
  }
)
```

De eksporterede helpers (`canAccessCompany`, `canAccessSensitivity` osv.) behøver ingen ændring — de kalder stadig `getUserRoles(userId, organizationId)` som før.

- [ ] **Step 4: Kør test — forvent PASS**

```bash
npm test -- --reporter=verbose src/__tests__/permissions-cache.test.ts
```

Expected: 2 tests passing.

- [ ] **Step 5: Kør fuld test-suite for at sikre ingen regression**

```bash
npm test
```

Expected: alle tests grønne (ingen ændringer i permissions-logik, kun memoization).

- [ ] **Step 6: Commit**

```bash
git add src/lib/permissions/index.ts src/__tests__/permissions-cache.test.ts
git commit -m "perf: wrap getUserRoles med React cache() — eliminerer permission-waterfall"
```

---

## Task B: getCasesPageData pagination-fix — fjern ubegrænset CaseCompany pre-fetch

**Files:**

- Modify: `src/actions/cases.ts:566-653` (hele `getCasesPageData`)
- Create: `src/__tests__/actions/cases-pagination.test.ts`

### Kontekst

Den nuværende kode (`cases.ts:578-588`) henter ALLE `CaseCompany`-rækker for tilgængelige companies (ingen LIMIT) og bygger en `caseIds`-liste. Derefter bruges `id: { in: caseIds }` i `Case.findMany`. Det korrekte mønster (brugt i `dashboard.ts:110-113` og `search.ts:171-173`) er `case_companies: { some: { company_id: { in: companyIds } } }` direkte i WHERE. Derudover brug af dynamic `await import()` på linje 625-626 for statiske label-funktioner — rettes til static imports.

- [ ] **Step 1: Skriv den fejlende test**

Opret `src/__tests__/actions/cases-pagination.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    case: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    // CaseCompany bør IKKE kaldes i den nye kode
    caseCompany: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['company-1', 'company-2']),
  getAllowedSensitivityLevels: vi
    .fn()
    .mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']),
}))

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getCasesPageData } from '@/actions/cases'

describe('getCasesPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-1',
        organizationId: 'org-1',
        email: 'test@test.dk',
        name: 'Test',
      },
      expires: '2099-01-01',
    } as never)
    vi.mocked(prisma.case.findMany).mockResolvedValue([])
    vi.mocked(prisma.case.count).mockResolvedValue(0)
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
  })

  it('bruger case_companies: { some: ... } i WHERE — kalder IKKE caseCompany.findMany', async () => {
    await getCasesPageData(1, 25)

    // Ny implementering: ingen separat CaseCompany pre-fetch
    expect(prisma.caseCompany.findMany).not.toHaveBeenCalled()

    // Case.findMany skal have case_companies: { some: ... } i WHERE
    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          deleted_at: null,
          case_companies: {
            some: { company_id: { in: ['company-1', 'company-2'] } },
          },
        }),
      })
    )
  })

  it('returnerer tom liste ved tom companyIds', async () => {
    const { getAccessibleCompanies } = await import('@/lib/permissions')
    vi.mocked(getAccessibleCompanies).mockResolvedValue([])

    const result = await getCasesPageData(1, 25)

    expect(result).toEqual({ cases: [], totalCount: 0, page: 1, pageSize: 25 })
    expect(prisma.case.findMany).not.toHaveBeenCalled()
  })

  it('paginerer korrekt — skip og take beregnes fra page/pageSize', async () => {
    await getCasesPageData(3, 10)

    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    )
  })
})
```

- [ ] **Step 2: Kør test — forvent FAIL**

```bash
npm test -- --reporter=verbose src/__tests__/actions/cases-pagination.test.ts
```

Expected: test 1 fejler med `expect(prisma.caseCompany.findMany).not.toHaveBeenCalled()` eller forkert WHERE-struktur.

- [ ] **Step 3: Tilføj statiske imports øverst i cases.ts**

I `src/actions/cases.ts` find de eksisterende imports (øverst i filen) og tilføj:

```typescript
import { getCaseStatusLabel, getCaseTypeLabel } from '@/lib/labels'
import { formatShortDate } from '@/lib/date-helpers'
```

(Fjern de tilsvarende `await import(...)` på linje 625-626 i `getCasesPageData`.)

- [ ] **Step 4: Reskriv getCasesPageData**

Erstat hele funktionen fra linje 566 til 653 i `src/actions/cases.ts`:

```typescript
export async function getCasesPageData(page = 1, pageSize = 25): Promise<CasesPageData> {
  const session = await auth()
  if (!session) return { cases: [], totalCount: 0, page, pageSize }

  const orgId = session.user.organizationId

  const hasAccess = await canAccessModule(session.user.id, 'cases', orgId)
  if (!hasAccess) return { cases: [], totalCount: 0, page, pageSize }

  const [companyIds, allowedLevels] = await Promise.all([
    getAccessibleCompanies(session.user.id, orgId),
    getAllowedSensitivityLevels(session.user.id, orgId),
  ])
  if (companyIds.length === 0) return { cases: [], totalCount: 0, page, pageSize }

  const caseWhere = {
    organization_id: orgId,
    deleted_at: null,
    sensitivity: { in: allowedLevels },
    case_companies: { some: { company_id: { in: companyIds } } },
  }

  const [rawCases, totalCount] = await Promise.all([
    prisma.case.findMany({
      where: caseWhere,
      include: {
        case_companies: {
          take: 1,
          include: { company: { select: { id: true, name: true } } },
        },
      },
      orderBy: { due_date: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.case.count({ where: caseWhere }),
  ])

  const responsibleIds = Array.from(
    new Set(rawCases.map((c) => c.responsible_id).filter((id): id is string => !!id))
  )
  const users = responsibleIds.length
    ? await prisma.user.findMany({
        where: { id: { in: responsibleIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email ?? 'Ukendt']))

  const today = new Date()

  const cases: CaseListRow[] = rawCases.map((c) => {
    const dueMs = c.due_date?.getTime() ?? null
    const fristDays =
      dueMs != null ? Math.ceil((dueMs - today.getTime()) / (1000 * 60 * 60 * 24)) : 9999

    const firstCompany = c.case_companies[0]?.company
    return {
      id: c.id,
      nr: c.case_number ?? '—',
      type: getCaseTypeLabel(c.case_type),
      rawType: c.case_type,
      title: c.title,
      desc: c.description ?? '',
      companyId: firstCompany?.id ?? null,
      selskab: firstCompany?.name ?? '—',
      status: getCaseStatusLabel(c.status),
      rawStatus: c.status,
      frist: c.due_date ? formatShortDate(c.due_date) : '—',
      fristDays,
      ansvarlig: c.responsible_id ? (userMap.get(c.responsible_id) ?? '—') : '—',
      updatedAt: c.updated_at.getTime(),
    }
  })

  return { cases, totalCount, page, pageSize }
}
```

- [ ] **Step 5: Kør test — forvent PASS**

```bash
npm test -- --reporter=verbose src/__tests__/actions/cases-pagination.test.ts
```

Expected: 3 tests passing.

- [ ] **Step 6: Kør fuld test-suite**

```bash
npm test
```

Expected: alle tests grønne. Tjek specifikt at eksisterende `cases.test.ts` stadig er grøn.

- [ ] **Step 7: Commit**

```bash
git add src/actions/cases.ts src/__tests__/actions/cases-pagination.test.ts
git commit -m "perf: getCasesPageData bruger case_companies JOIN i stedet for ubegrænset pre-fetch"
```

---

## Task C: a11y quick-wins — aria-sort, aria-expanded, role=alert, role=status

**Files:**

- Modify: `src/components/ui/b/DataTable.tsx:54-68`
- Modify: `src/components/tasks/TasksGroupedView.tsx:50-90`
- Modify: `src/components/persons/GdprPanel.tsx` (linje med `!nameMatches`-paragraf)
- Modify: `src/components/ui/page-skeleton.tsx:1-70`

### Kontekst

Fire separate ARIA-fixes. Alle er rene HTML-attribut-tilføjelser — ingen logikændring. Rækkefølge: DataTable → TasksGroupedView → GdprPanel → PageSkeleton.

---

### C1: aria-sort og aria-hidden på Th i DataTable

- [ ] **Step 1: Skriv den fejlende test**

Opret `src/__tests__/components/ui/b/DataTable-a11y.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Th } from '@/components/ui/b/DataTable'

describe('Th a11y', () => {
  it('har aria-sort="none" på sortérbar header der ikke er aktiv', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th col="name" sortCol={null} sortDir="asc" onSort={() => {}}>
              Navn
            </Th>
          </tr>
        </thead>
      </table>
    )
    const th = screen.getByRole('columnheader', { name: 'Navn' })
    expect(th).toHaveAttribute('aria-sort', 'none')
  })

  it('har aria-sort="ascending" når kolonnen er aktiv og sortDir=asc', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th col="name" sortCol="name" sortDir="asc" onSort={() => {}}>
              Navn
            </Th>
          </tr>
        </thead>
      </table>
    )
    const th = screen.getByRole('columnheader', { name: 'Navn' })
    expect(th).toHaveAttribute('aria-sort', 'ascending')
  })

  it('har aria-sort="descending" når aktiv og sortDir=desc', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th col="name" sortCol="name" sortDir="desc" onSort={() => {}}>
              Navn
            </Th>
          </tr>
        </thead>
      </table>
    )
    const th = screen.getByRole('columnheader', { name: 'Navn' })
    expect(th).toHaveAttribute('aria-sort', 'descending')
  })

  it('sort-pil-span har aria-hidden="true"', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th col="name" sortCol="name" sortDir="asc" onSort={() => {}}>
              Navn
            </Th>
          </tr>
        </thead>
      </table>
    )
    // Sort-pil skal være skjult for screen-readers
    const hiddenSpan = document.querySelector('span[aria-hidden="true"]')
    expect(hiddenSpan).not.toBeNull()
    expect(hiddenSpan?.textContent).toBe('↑')
  })

  it('ikke-sortérbar header har ingen aria-sort', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th>Handling</Th>
          </tr>
        </thead>
      </table>
    )
    const th = screen.getByRole('columnheader', { name: 'Handling' })
    expect(th).not.toHaveAttribute('aria-sort')
  })
})
```

- [ ] **Step 2: Kør test — forvent FAIL**

```bash
npm test -- --reporter=verbose src/__tests__/components/ui/b/DataTable-a11y.test.tsx
```

Expected: alle 5 tests fejler (`aria-sort` ikke til stede).

- [ ] **Step 3: Tilføj aria-sort og aria-hidden i DataTable.tsx**

I `src/components/ui/b/DataTable.tsx`, erstat `<th>`-elementet (linje 55-68) med:

```typescript
  return (
    <th
      onClick={clickable && col ? () => onSort(col) : undefined}
      aria-sort={
        clickable && col
          ? sorted
            ? sortDir === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
          : undefined
      }
      className={cn(
        'truncate border-b border-b-border bg-b-panel-h px-3 py-1.5 text-[10px] font-semibold uppercase',
        sorted ? 'text-b-1' : 'text-b-2',
        clickable && 'cursor-pointer select-none hover:text-b-1',
        alignRight ? 'text-right' : 'text-left'
      )}
      style={styleObj}
    >
      {children}
      {sorted && (
        <span className="ml-1" aria-hidden="true">
          {sortDir === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </th>
  )
```

- [ ] **Step 4: Kør test — forvent PASS**

```bash
npm test -- --reporter=verbose src/__tests__/components/ui/b/DataTable-a11y.test.tsx
```

Expected: 5 tests passing.

---

### C2: aria-expanded og aria-controls på TasksGroupedView toggle

- [ ] **Step 5: Skriv den fejlende test**

Opret `src/__tests__/components/tasks/TasksGroupedView-a11y.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TasksGroupedView from '@/components/tasks/TasksGroupedView'
import type { TaskRow } from '@/actions/tasks'

const mockTask: TaskRow = {
  id: 'task-1',
  title: 'Test-opgave',
  status: 'NY',
  rawStatus: 'NY',
  priority: 'MELLEM',
  frist: '2026-07-01',
  fristDays: 15,
  ansvarlig: '—',
  selskab: 'TestApS',
  companyId: 'company-1',
  sagId: null,
  sagTitel: null,
  updatedAt: Date.now(),
}

describe('TasksGroupedView toggle a11y', () => {
  it('gruppe-toggle-knap har aria-expanded=true når åben (default)', () => {
    render(<TasksGroupedView tasks={[mockTask]} groupBy="selskab" onRowClick={() => {}} />)
    const toggleButton = screen.getByRole('button', { name: /TestApS/i })
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('gruppe-toggle-knap har aria-expanded=false efter klik (lukket)', () => {
    render(<TasksGroupedView tasks={[mockTask]} groupBy="selskab" onRowClick={() => {}} />)
    const toggleButton = screen.getByRole('button', { name: /TestApS/i })
    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggle-knap har aria-controls der matcher id på indhold-container', () => {
    render(<TasksGroupedView tasks={[mockTask]} groupBy="selskab" onRowClick={() => {}} />)
    const toggleButton = screen.getByRole('button', { name: /TestApS/i })
    const controlsId = toggleButton.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()
    // Indhold-container skal have matchende id
    const contentEl = document.getElementById(controlsId!)
    expect(contentEl).not.toBeNull()
  })
})
```

- [ ] **Step 6: Kør test — forvent FAIL**

```bash
npm test -- --reporter=verbose src/__tests__/components/tasks/TasksGroupedView-a11y.test.tsx
```

Expected: alle 3 tests fejler (`aria-expanded` ikke til stede).

- [ ] **Step 7: Tilføj useId, aria-expanded og aria-controls i TasksGroupedView.tsx**

I `src/components/tasks/TasksGroupedView.tsx`, tilføj `useId` import og opdatér gruppe-render-blokken.

Find øverst i filen (eller tilføj til eksisterende React-imports):

```typescript
import { useState, useId } from 'react'
```

Erstat gruppe-render-blokken (linje 50-88) med:

```typescript
      {groups.map(([name, rows]) => {
        const isOpen = !collapsed.has(name)
        const hasUrgent = rows.some(
          (r) => r.fristDays <= 1 && r.fristDays < 9999 && r.rawStatus !== 'LUKKET'
        )
        // useId genererer stabil, unik ID per gruppe-instans (React 18+)
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const contentId = useId()
        return (
          <div key={name}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={contentId}
              onClick={() => toggle(name)}
              className="flex w-full items-center gap-2 border-b border-b-border bg-b-row-hover px-3 py-1.5 text-left hover:bg-[#ecedf0]"
            >
              <span className="w-3 shrink-0 text-[10px] text-b-2">{isOpen ? '▾' : '▸'}</span>
              <span className="flex-1 text-[12px] font-semibold text-b-1">{name}</span>
              <span
                className={`b-tnum rounded-[10px] px-1.5 py-px text-[10px] font-semibold ${
                  hasUrgent ? 'bg-b-red-bg text-b-red-fg' : 'bg-b-border text-b-gray-fg'
                }`}
              >
                {rows.length}
              </span>
              {hasUrgent && (
                <Badge tone="red" className="text-[10px]">
                  ⚠
                </Badge>
              )}
            </button>
            {isOpen && (
              <table id={contentId} className="w-full table-fixed border-collapse">
                <tbody>
                  {rows.map((t) => (
                    <TaskTr key={t.id} t={t} hideSelskab onClick={() => onRowClick(t.id)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
```

**Bemærk:** `useId()` i et `.map()`-kald er normalt forbudt (Rules of Hooks). Her er det teknisk tilladt fordi `groups` er statisk pr. render og rækkefølgen ikke ændrer sig — men ESLint vil advare. Alternativ: beregn IDs fra `name` med en simpel hash. Brug den sikrere variant:

Erstat `useId`-linjen med:

```typescript
const contentId = `task-group-${name.replace(/\s+/g, '-').toLowerCase()}`
```

Og fjern `useId` fra imports (det er ikke længere nødvendigt).

- [ ] **Step 8: Kør test — forvent PASS**

```bash
npm test -- --reporter=verbose src/__tests__/components/tasks/TasksGroupedView-a11y.test.tsx
```

Expected: 3 tests passing.

---

### C3: role="alert" på GdprPanel fejl-paragraf

- [ ] **Step 9: Find og ret fejl-paragraffen i GdprPanel.tsx**

Søg i filen efter `!nameMatches`:

```bash
grep -n "nameMatches" src/components/persons/GdprPanel.tsx
```

Find linjen der ser ud som:

```typescript
<p className="text-[11px] text-red-600">...</p>
```

vist betinget ved `!nameMatches`. Tilføj `role="alert"`:

```typescript
<p role="alert" className="text-[11px] text-red-600">
  Navn matcher ikke. Skriv personens fulde navn for at bekræfte.
</p>
```

(Den præcise tekst afhænger af hvad der allerede er i filen — bevar den eksisterende tekst, tilføj kun `role="alert"`.)

- [ ] **Step 10: Verificér visuelt korrekt render og ingen regression**

```bash
npm test -- --reporter=verbose --grep="GdprPanel"
```

Expected: eksisterende GdprPanel-tests grønne.

---

### C4: role="status" på PageSkeleton og DashboardSkeleton

- [ ] **Step 11: Opdatér begge skeleton-komponenter i page-skeleton.tsx**

Erstat rod-`<div>` i `PageSkeleton` (linje 3):

```typescript
// Fra:
<div className="space-y-6 animate-pulse">

// Til:
<div role="status" aria-label="Indlæser indhold" aria-busy="true" className="space-y-6 animate-pulse">
```

Erstat rod-`<div>` i `DashboardSkeleton` (linje 42):

```typescript
// Fra:
<div className="p-5 h-full animate-pulse">

// Til:
<div role="status" aria-label="Indlæser dashboard" aria-busy="true" className="p-5 h-full animate-pulse">
```

- [ ] **Step 12: Kør alle a11y-relaterede tests**

```bash
npm test -- --reporter=verbose src/__tests__/components/ui/b/DataTable-a11y.test.tsx src/__tests__/components/tasks/TasksGroupedView-a11y.test.tsx
```

Expected: alle grønne.

- [ ] **Step 13: Kør fuld test-suite**

```bash
npm test
```

Expected: alle tests grønne.

- [ ] **Step 14: Commit**

```bash
git add \
  src/components/ui/b/DataTable.tsx \
  src/components/tasks/TasksGroupedView.tsx \
  src/components/persons/GdprPanel.tsx \
  src/components/ui/page-skeleton.tsx \
  src/__tests__/components/ui/b/DataTable-a11y.test.tsx \
  src/__tests__/components/tasks/TasksGroupedView-a11y.test.tsx
git commit -m "a11y: aria-sort på tabel-headers, aria-expanded på gruppe-toggle, role=alert på GdprPanel, role=status på skeletons"
```

---

## Task D: Øvrige P2/P3 perf-fixes — lazy persons-dropdown, peer-metrics cache, Task→Company relation, FinancialMetric index

**Files:**

- Modify: `prisma/schema.prisma` (Task→Company relation + FinancialMetric index)
- Create: `prisma/migrations/<timestamp>_task_company_relation/migration.sql` (via `prisma migrate dev`)
- Modify: `src/actions/tasks.ts:140-165` (brug `include: { company: ... }`)
- Modify: `src/actions/contracts.ts:815-835` (fjern person-query fra `getContractDetailPageData`)
- Create: `src/actions/contract-persons.ts` (lazy-load action)
- Modify: `src/actions/company-detail.ts:285-293` (wrap peer-metrics i `unstable_cache`)

**Forudsætning:** Stream A baseline-migration er kørt (`prisma migrate deploy` grøn). Kørsel af `prisma migrate dev` her tilføjer én ny migration ovenpå.

### D1: Task→Company Prisma-relation + FinancialMetric compound index

- [ ] **Step 1: Tilføj relation og index i schema.prisma**

I `prisma/schema.prisma`, find `model Task { ... }` (linje 753). Tilføj `company`-relationsfeltet:

```prisma
model Task {
  id              String     @id @default(uuid())
  organization_id String
  title           String
  description     String?
  status          TaskStatus @default(NY)
  priority        Prioritet  @default(MELLEM)
  due_date        DateTime?
  assigned_to     String?
  case_id         String?
  company_id      String?
  contract_id     String?
  completed_at    DateTime?
  created_at      DateTime   @default(now())
  updated_at      DateTime   @updatedAt
  created_by      String
  deleted_at      DateTime?

  organization Organization @relation(fields: [organization_id], references: [id])
  assignee     User?        @relation("TaskAssignedTo", fields: [assigned_to], references: [id])
  case         Case?        @relation(fields: [case_id], references: [id])
  company      Company?     @relation("TaskCompany", fields: [company_id], references: [id])
  comments     Comment[]
  history      TaskHistory[]

  @@index([organization_id, deleted_at])
  @@index([organization_id, assigned_to, deleted_at])
  @@index([organization_id, due_date])
  @@index([organization_id, deleted_at, status])
  @@index([organization_id, company_id])
}
```

Tilføj den modsatte side på `model Company { ... }` — find `company_notes CompanyNote[]` i Company-modellen og tilføj nedenunder:

```prisma
  tasks           Task[]          @relation("TaskCompany")
```

Find `model FinancialMetric { ... }` (linje 894). Tilføj compound index med `period_type`:

```prisma
  @@unique([organization_id, company_id, metric_type, period_type, period_year])
  @@index([organization_id, company_id])
  @@index([organization_id, company_id, metric_type, period_year])
  @@index([organization_id, company_id, period_type, metric_type, period_year])
```

- [ ] **Step 2: Generér og kør migration**

```bash
npx prisma migrate dev --name task_company_relation
```

Expected: migrationen opretter én `CREATE INDEX` for FinancialMetric og tilføjer ingen ny kolonne (relationen er virtuel — `company_id` eksisterer allerede). Prisma genererer kun FK-constraint og index.

- [ ] **Step 3: Regenerér Prisma client**

```bash
npx prisma generate
```

Expected: `@prisma/client` indeholder nu `Task.company` relation.

---

### D2: Brug Task→Company relation i getTasksPaginated

- [ ] **Step 4: Skriv den fejlende test**

Tilføj test i `src/__tests__/actions/tasks.test.ts` (eller opret `src/__tests__/actions/tasks-company-include.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findMany: vi.fn(), count: vi.fn() },
    company: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['company-1']),
}))

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getTasksPaginated } from '@/actions/tasks'

describe('getTasksPaginated — Task→Company relation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
      expires: '2099-01-01',
    } as never)
    vi.mocked(prisma.task.findMany).mockResolvedValue([])
    vi.mocked(prisma.task.count).mockResolvedValue(0)
  })

  it('bruger include: { company: ... } og kalder IKKE company.findMany separat', async () => {
    await getTasksPaginated({})

    expect(prisma.company.findMany).not.toHaveBeenCalled()
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          company: expect.objectContaining({
            select: { id: true, name: true },
          }),
        }),
      })
    )
  })
})
```

- [ ] **Step 5: Kør test — forvent FAIL**

```bash
npm test -- --reporter=verbose src/__tests__/actions/tasks-company-include.test.ts
```

Expected: `expect(prisma.company.findMany).not.toHaveBeenCalled()` fejler fordi koden stadig kalder separat query.

- [ ] **Step 6: Opdatér getTasksPaginated i tasks.ts**

I `src/actions/tasks.ts`, find `prisma.task.findMany` kaldet (ca. linje 130-165). Tilføj `company` til `include`-objektet:

```typescript
    prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        due_date: true,
        company_id: true,
        case_id: true,
        assigned_to: true,
        assignee: { select: { id: true, name: true } },
        case: { select: { id: true, title: true } },
        company: { select: { id: true, name: true } },
      },
    }),
```

Fjern derefter de efterfølgende linjer der henter `companyIdsInPage` og kaller `prisma.company.findMany` (ca. linje 153-163). Opdatér `companyMap`-opbygningen til at bruge `task.company` direkte i mapping-trinnet:

```typescript
const rows: TaskRow[] = rawTasks.map((t) => {
  const dDue = t.due_date ? daysUntil(t.due_date) : null
  const isClosed = t.status === 'LUKKET'
  const fristDays = isClosed ? 9999 : (dDue ?? 9999)
  let frist = '—'
  if (t.due_date && dDue != null) {
    if (isClosed) frist = formatShortDate(t.due_date)
    else if (dDue < 0) frist = `${Math.abs(dDue)}d for sent`
    else frist = formatShortDate(t.due_date)
  }
  return {
    // ... eksisterende felter ...
    selskab: t.company?.name ?? '—',
    companyId: t.company_id,
    // ... resten ...
  }
})
```

- [ ] **Step 7: Kør test — forvent PASS**

```bash
npm test -- --reporter=verbose src/__tests__/actions/tasks-company-include.test.ts
```

Expected: 1 test passing.

---

### D3: Lazy person-dropdown i getContractDetailPageData

- [ ] **Step 8: Opret ny action for lazy person-load**

Opret `src/actions/contract-persons.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import type { ActionResult } from '@/types'

export type PersonOption = {
  id: string
  name: string
  email: string | null
}

export async function getPersonOptions(): Promise<ActionResult<PersonOption[]>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const orgId = session.user.organizationId

  const hasAccess = await canAccessModule(session.user.id, 'persons', orgId)
  if (!hasAccess) return { error: 'Ingen adgang til personsmodulet' }

  const persons = await prisma.person.findMany({
    where: { organization_id: orgId, deleted_at: null },
    orderBy: { last_name: 'asc' },
    take: 200,
    select: { id: true, first_name: true, last_name: true, email: true },
  })

  return {
    data: persons.map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`.trim(),
      email: p.email,
    })),
  }
}
```

- [ ] **Step 9: Fjern person-query fra getContractDetailPageData i contracts.ts**

I `src/actions/contracts.ts`, find `getContractDetailPageData` (ca. linje 780-836). Fjern `prisma.person.findMany`-kaldet (linje 825-830) fra Promise.all-batchen. Fjern `persons` fra destructuring og retur-objektet.

Eksempel — find og fjern denne blok fra Promise.all:

```typescript
    // FJERN DETTE:
    prisma.person.findMany({
      where: { organization_id: orgId, deleted_at: null },
      orderBy: { last_name: 'asc' },
      take: 200,
      select: { id: true, first_name: true, last_name: true, email: true },
    }),
```

Og fjern `persons` fra return-objektet (linje 835):

```typescript
// Fra:
return { contract, cases, tasks, documents, extraction, uploaderMap, persons }
// Til:
return { contract, cases, tasks, documents, extraction, uploaderMap }
```

Opdatér den komponent der bruger `persons` fra denne action til i stedet at kalde `getPersonOptions()` lazy ved dropdown-åbning. (Dette er en UI-ændring — se næste step.)

- [ ] **Step 10: Skriv test for ny action**

Opret `src/__tests__/actions/contract-persons.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    person: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getPersonOptions } from '@/actions/contract-persons'

describe('getPersonOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
      expires: '2099-01-01',
    } as never)
  })

  it('returnerer formaterede person-options med fuldt navn', async () => {
    vi.mocked(prisma.person.findMany).mockResolvedValue([
      { id: 'p-1', first_name: 'Jane', last_name: 'Jensen', email: 'jane@test.dk' },
    ] as never)

    const result = await getPersonOptions()

    expect(result).toEqual({
      data: [{ id: 'p-1', name: 'Jane Jensen', email: 'jane@test.dk' }],
    })
  })

  it('bruger organization_id fra session — ikke parameter', async () => {
    vi.mocked(prisma.person.findMany).mockResolvedValue([])

    await getPersonOptions()

    expect(prisma.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          deleted_at: null,
        }),
      })
    )
  })

  it('returnerer error ved manglende session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const result = await getPersonOptions()

    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })
})
```

- [ ] **Step 11: Kør test — forvent PASS**

```bash
npm test -- --reporter=verbose src/__tests__/actions/contract-persons.test.ts
```

Expected: 3 tests passing.

---

### D4: Peer-metrics unstable_cache i company-detail.ts

- [ ] **Step 12: Wrap peer-metrics query i unstable_cache**

I `src/actions/company-detail.ts`, tilføj import øverst:

```typescript
import { unstable_cache } from 'next/cache'
```

Find peer-metrics query (linje 285-293):

```typescript
    // Peer-omsaetning: alle selskaber i org med helår-omsaetning for rangberegning
    prisma.financialMetric.findMany({
      where: {
        organization_id: organizationId,
        period_year: currentYear,
        period_type: 'HELAAR',
        metric_type: 'OMSAETNING',
      },
      select: { company_id: true, value: true },
    }),
```

Erstat med en cached version. Definer funktionen UDEN FOR `getCompanyDetailData` (øverst i filen, efter imports):

```typescript
const getCachedPeerOmsaetning = unstable_cache(
  async (organizationId: string, year: number) => {
    return prisma.financialMetric.findMany({
      where: {
        organization_id: organizationId,
        period_year: year,
        period_type: 'HELAAR',
        metric_type: 'OMSAETNING',
      },
      select: { company_id: true, value: true },
    })
  },
  ['peer-omsaetning'],
  {
    revalidate: 3600, // 1 time — omsaetningstal ændrer sig sjældent
    tags: ['peer-metrics'],
  }
)
```

Erstat peer-metrics-query i Promise.all med:

```typescript
    getCachedPeerOmsaetning(organizationId, currentYear),
```

**Bemærk om Decimal-serialisering:** `unstable_cache` serialiserer via JSON. `value` er `Decimal` fra Prisma — JSON-serialisering konverterer Decimal til string i Next.js cache. Tilføj type-konvertering i retur-mapping:

```typescript
// Efter peerOmsaetningRaw er resolvet fra Promise.all, konvertér Decimal til Number:
const peerOmsaetning = peerOmsaetningRaw.map((m) => ({
  company_id: m.company_id,
  value: typeof m.value === 'string' ? parseFloat(m.value) : Number(m.value),
}))
```

(Brug `peerOmsaetning` i stedet for `peerOmsaetningRaw` i den resterende logik.)

- [ ] **Step 13: Kør fuld test-suite**

```bash
npm test
```

Expected: alle tests grønne. TypeScript-check:

```bash
npx tsc --noEmit
```

Expected: 0 fejl.

- [ ] **Step 14: Commit**

```bash
git add \
  prisma/schema.prisma \
  prisma/migrations/ \
  src/actions/tasks.ts \
  src/actions/contracts.ts \
  src/actions/contract-persons.ts \
  src/actions/company-detail.ts \
  src/__tests__/actions/tasks-company-include.test.ts \
  src/__tests__/actions/contract-persons.test.ts
git commit -m "perf: Task→Company Prisma-relation, lazy person-dropdown, peer-metrics cache, FinancialMetric index"
```

---

## Exit-gate (definition of done for Stream F)

Stream F er komplet når ALLE disse er sande:

1. `npm test` kører grønt — alle eksisterende tests + nye tests fra Task A/B/C/D.
2. `npx tsc --noEmit` → 0 fejl.
3. `getUserRoles`-testen bekræfter 1 DB-kald (ikke 2) ved kombineret helper-brug.
4. `getCasesPageData`-testen bekræfter `caseCompany.findMany` IKKE kaldes.
5. `DataTable-a11y.test.tsx` → 5 tests grønne (aria-sort på alle 3 tilstande, aria-hidden, ikke-sortérbar header).
6. `TasksGroupedView-a11y.test.tsx` → 3 tests grønne (aria-expanded true/false, aria-controls matcher id).
7. `contract-persons.test.ts` → 3 tests grønne.
8. `prisma migrate deploy` (mod tom DB) → grøn inkl. den nye Task→Company-migration.
9. `npx prisma generate` → ingen TypeScript-fejl i genereret client.

---

## Self-review

**Spec coverage:**

| Roadmap-item                            | Task       |
| --------------------------------------- | ---------- |
| getUserRoles React cache()              | Task A     |
| getCasesPageData pagination-fix         | Task B     |
| aria-sort på tabel-headers              | Task C1    |
| aria-expanded/aria-controls på toggles  | Task C2    |
| role/aria på skeletons                  | Task C4    |
| role=alert på GdprPanel                 | Task C3    |
| Lazy person-dropdown i kontrakt-detalje | Task D3    |
| peer-metrics unstable_cache             | Task D4    |
| FinancialMetric compound index          | Task D1    |
| Task→Company Prisma-relation            | Task D1+D2 |

**Åbne valg og potentielle uklarheder:**

1. **`useId()` i `.map()`** — i C2 anbefales string-baseret ID (`task-group-${name}`) frem for `useId()` i løkke for at undgå ESLint hook-advarsel. Hvis gruppe-navne ikke er unikke (fx to grupper navngivet "Øvrige"), duplikeres IDs. Enten sanitér group-names til garanteret-unikke keys, eller acceptér at det er et edge case der ikke opstår i praksis.

2. **`unstable_cache` + Decimal serialisering** — i D4 konverteres `value` fra `string | Decimal` til `number` efter cache-read. Kontrollér at den eksisterende peer-rang-beregning i `company-detail.ts` bruger `Number(m.value)` korrekt; if not, er parseFloat-konverteringen tilstrækkelig.

3. **`getPersonOptions` UI-integration** — Task D3 fjerner `persons` fra `getContractDetailPageData` retur, men planen dækker ikke hvilken React-komponent (sandsynligvis en EditContractDialog eller tilsvarende) der skal opdateres til at kalde `getPersonOptions()` lazy. Agenten skal identificere consumer-komponent(er) via `grep -r "persons.*getContractDetailPageData\|contract\.persons" src/components/contracts/` og opdatere disse til at bruge Server Action kald ved dropdown-åbning.

4. **`getCasesPageData` dynamic import af labels** — linje 625-626 bruger `await import('@/lib/labels')` og `await import('@/lib/date-helpers')`. Begge moduler er statiske (ingen side-effects ved import), så statiske imports øverst i filen er korrekt. Verificér at `src/actions/cases.ts` ikke allerede har disse imports (check top af filen før tilføjelse for at undgå duplikater).
