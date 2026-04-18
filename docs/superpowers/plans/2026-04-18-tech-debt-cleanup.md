# ChainHub Tech-Debt Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjern 6 konkrete tech-debt-kilder uden at ændre funktionalitet: ubrugt dependency, duplikerede kalender-constanter, spredte dato-formateringer, `dashboard.ts`-helpers der burde være extractable, 31 `as never`-typecasts pga. manglende Zod↔Prisma-enum-bro, og duplikerede nav-arrays. Alle tasks er simplificerings-refactors — ingen feature-ændringer.

**Architecture:** Extract-first. Byg genanvendelige lib-moduler (`calendar-constants`, `date-helpers`, `dashboard-helpers`, `zod-enums`, `nav-config`), refaktorér call-sites til at importere dem. Tests dækker helpers unit-level; eksisterende UI-tests fanger regressions. Zod-enum-broen eliminerer `as never`-casts ved at matche Zod-enum-strings direkte med Prisma-enum-typer.

**Tech Stack:** TypeScript 5 strict, Zod 3, Prisma 5, Vitest. Ingen nye dependencies — kun fjerner én.

---

## Kontekst

Tech-debt-audit (2026-04-18) fandt:

- `fastest-levenshtein` installed men 0 usages (ren bloat)
- `MONTH_NAMES`/`DAY_NAMES` duplikeret i `full-calendar.tsx` og `calendar-widget.tsx`
- Inline `.toLocaleDateString('da-DK', {...})` spredt over 6+ filer (ingen central helper)
- `filterLatestPerCompany` + 6 andre helpers låst inde i `dashboard.ts` (740 linjer)
- 31 `as never` / `as never`-cast-steder pga. Zod returnerer generisk `string` mens Prisma kræver enum-literal
- `mobile-nav.tsx` og `app-sidebar.tsx` har parallelle nav-arrays med samme entries

Efter cleanup: `dashboard.ts` fra 740→~500 linjer, type-safety-gaps elimineret, nav + kalender + datoer centraliseret. Estimeret 2-3 timer effektiv arbejde.

**Udfald:**

- 0 `as never` casts relateret til Zod/Prisma enum-bro
- `fastest-levenshtein` fjernet fra package.json
- 5 nye lib-moduler med unit-tests
- Test-suite: 550 → ~560 passed
- Alle UI + format/lint/tsc/build fortsat grønne

---

## File Structure

**Nye filer:**

- `src/lib/calendar-constants.ts` — `MONTH_NAMES_DA`, `MONTH_NAMES_DA_SHORT`, `WEEKDAYS_DA`, `WEEKDAYS_DA_SHORT`
- `src/lib/date-helpers.ts` — `formatDanishDate`, `formatDanishDateTime`, `formatShortDate`, `formatRelativeDate`
- `src/lib/dashboard-helpers.ts` — `filterLatestPerCompany` + 6 andre helpers fra `dashboard.ts`
- `src/lib/zod-enums.ts` — factory `zodPrismaEnum<T>(values: readonly T[])` + præ-exporterede enum-schemas (CaseType, TaskStatus, VisitType, ContractStatus, osv.)
- `src/lib/nav-config.ts` — `NAV_ITEMS` array + `NAV_SECTIONS` grouping
- `src/__tests__/dashboard-helpers.test.ts` — unit tests for extractede helpers
- `src/__tests__/date-helpers.test.ts` — unit tests for dato-formatering
- `src/__tests__/zod-enums.test.ts` — unit tests for enum-factory

**Ændrede filer:**

- `package.json` — fjern `fastest-levenshtein`
- `src/components/calendar/full-calendar.tsx` — importér fra `calendar-constants`
- `src/components/ui/calendar-widget.tsx` — importér fra `calendar-constants`
- `src/actions/dashboard.ts` — reducér til orchestrator, importér helpers
- `src/actions/cases.ts`, `contracts.ts`, `finance.ts`, `tasks.ts`, `visits.ts` — brug zod-enums
- `src/app/(dashboard)/cases/page.tsx`, `tasks/page.tsx` — fjern `as never` filter-casts
- `src/components/layout/mobile-nav.tsx` — importér `NAV_ITEMS`
- `src/components/layout/app-sidebar.tsx` — importér `NAV_SECTIONS`
- Forskellige filer med `.toLocaleDateString('da-DK', ...)` → `formatDanishDate(...)`

**Ingen ændringer i:** Database schema, actions' eksterne API, komponent-props.

---

## Plan

### Task 0: Plan commit

- [ ] **Step 1: Plan allerede gemt** ved `docs/superpowers/plans/2026-04-18-tech-debt-cleanup.md`.

```bash
git add docs/superpowers/plans/2026-04-18-tech-debt-cleanup.md
git commit -m "docs(plan): tech-debt cleanup plan"
```

---

### Task 1: Fjern ubrugt dependency

**Files:** Modify `package.json`, `package-lock.json`

- [ ] **Step 1: Verificér 0 brug**

```bash
grep -rn "fastest-levenshtein" src/ tests/ scripts/ 2>/dev/null
# Forventet: ingen output
```

Hvis der er output, STOP og rapportér til controller.

- [ ] **Step 2: Fjern**

```bash
npm uninstall fastest-levenshtein
```

- [ ] **Step 3: Verificér**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -3
rm -rf .next && npx next build 2>&1 | tail -5
```

Alle tre skal være grønne.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): fjern ubrugt fastest-levenshtein"
```

---

### Task 2: Calendar constants extraction

**Files:**

- Create `src/lib/calendar-constants.ts`
- Modify `src/components/calendar/full-calendar.tsx`
- Modify `src/components/ui/calendar-widget.tsx`

- [ ] **Step 1: Læs eksisterende definitioner**

```bash
grep -n "MONTH_NAMES\|DAY_NAMES\|WEEKDAYS\|monthNames" src/components/calendar/full-calendar.tsx src/components/ui/calendar-widget.tsx
```

Noter præcise array-navne og indhold begge steder.

- [ ] **Step 2: Opret `src/lib/calendar-constants.ts`**

```ts
/**
 * Danske kalender-constanter. Brug disse i stedet for inline arrays.
 */

export const MONTH_NAMES_DA = [
  'januar',
  'februar',
  'marts',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'december',
] as const

export const MONTH_NAMES_DA_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
] as const

/** Mandag-start, som er dansk konvention. */
export const WEEKDAYS_DA = [
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
  'søndag',
] as const

export const WEEKDAYS_DA_SHORT = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'] as const

export type MonthName = (typeof MONTH_NAMES_DA)[number]
export type WeekdayName = (typeof WEEKDAYS_DA)[number]
```

Juster array-indholdet til at matche EKSAKT hvad eksisterende kode forventer (tjek case/præfikser nøje — hvis `full-calendar.tsx` bruger "Januar" med stort J, brug det). Hvis der er case-forskel mellem de to filer, konsolidér til én form og opdater begge filer.

- [ ] **Step 3: Refaktor `src/components/calendar/full-calendar.tsx`**

- Fjern inline `MONTH_NAMES`/`DAY_NAMES`-konstanter
- Importér fra `@/lib/calendar-constants`
- Erstat alle usages (søg efter de gamle array-navne i filen)
- Hvis navnet ændrede sig (fx `MONTH_NAMES` → `MONTH_NAMES_DA`), opdater alle referencer

- [ ] **Step 4: Refaktor `src/components/ui/calendar-widget.tsx`**

- Samme pattern. Fjern `WEEKDAYS` / `monthNames` inline-definitioner.
- Importér.

- [ ] **Step 5: Verificér**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -3
```

Kør `npm run dev` og åbn `/dashboard` og `/tasks?view=kanban` (hvis calendar-widget bruges der) — visuel check at kalender stadig viser danske måneder/ugedage korrekt.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calendar-constants.ts src/components/calendar/full-calendar.tsx src/components/ui/calendar-widget.tsx
git commit -m "refactor(calendar): ekstrahér måneds- og ugedags-constanter til lib/"
```

---

### Task 3: Date helpers extraction

**Files:**

- Create `src/lib/date-helpers.ts`
- Create `src/__tests__/date-helpers.test.ts`
- Modify 4-6 filer der bruger inline `.toLocaleDateString('da-DK', ...)`

- [ ] **Step 1: Find call-sites**

```bash
grep -rn "toLocaleDateString('da-DK'" src/ --include="*.tsx" --include="*.ts" > /tmp/date-sites.log
cat /tmp/date-sites.log
wc -l /tmp/date-sites.log
```

Noter de 3 mest brugte formater — typisk:

- Kort: `dd/MM/yyyy` eller `dd. mmm yyyy`
- Lang: `d. mmmm yyyy`
- Med tid: `d. mmmm yyyy kl. HH:mm`
- Relativ: "i dag", "i går", "for 3 dage siden" (se også `src/lib/labels.ts` `relativeDate`)

- [ ] **Step 2: Opret `src/lib/date-helpers.ts`**

```ts
import { MONTH_NAMES_DA, MONTH_NAMES_DA_SHORT } from '@/lib/calendar-constants'

/** "15. april 2026" */
export function formatDanishDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()}. ${MONTH_NAMES_DA[d.getMonth()]} ${d.getFullYear()}`
}

/** "15. april 2026 kl. 14:30" */
export function formatDanishDateTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${formatDanishDate(d)} kl. ${hours}:${minutes}`
}

/** "15. apr 2026" */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()}. ${MONTH_NAMES_DA_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/** "i dag", "i går", "for 3 dage siden", "om 5 dage", ellers formatDanishDate */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'i dag'
  if (diffDays === -1) return 'i går'
  if (diffDays === 1) return 'i morgen'
  if (diffDays < 0 && diffDays >= -7) return `for ${-diffDays} dage siden`
  if (diffDays > 0 && diffDays <= 7) return `om ${diffDays} dage`
  return formatDanishDate(d)
}
```

- [ ] **Step 3: Hvis `relativeDate` findes i `src/lib/labels.ts`, migrér signaturen**

Læs `src/lib/labels.ts`. Hvis der er en eksisterende `relativeDate` / `formatRelative` — behold bagudkompatibilitet ved at re-exportere fra date-helpers eller omvendt. Brug din dømmekraft: én source of truth.

- [ ] **Step 4: Opret `src/__tests__/date-helpers.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  formatDanishDate,
  formatDanishDateTime,
  formatShortDate,
  formatRelativeDate,
} from '@/lib/date-helpers'

describe('formatDanishDate', () => {
  it('formaterer dato på dansk', () => {
    expect(formatDanishDate(new Date('2026-04-15T10:00:00Z'))).toBe('15. april 2026')
  })
  it('returnerer tom streng for null', () => {
    expect(formatDanishDate(null)).toBe('')
  })
  it('parser ISO-string', () => {
    expect(formatDanishDate('2026-12-01T00:00:00Z')).toBe('1. december 2026')
  })
  it('returnerer tom streng for invalid', () => {
    expect(formatDanishDate('ikke en dato')).toBe('')
  })
})

describe('formatDanishDateTime', () => {
  it('inkluderer klokkeslæt', () => {
    const d = new Date(2026, 3, 15, 14, 30)
    expect(formatDanishDateTime(d)).toBe('15. april 2026 kl. 14:30')
  })
})

describe('formatShortDate', () => {
  it('bruger kort måned', () => {
    const d = new Date(2026, 0, 5)
    expect(formatShortDate(d)).toBe('5. jan 2026')
  })
})

describe('formatRelativeDate', () => {
  it('genkender i dag', () => {
    expect(formatRelativeDate(new Date())).toBe('i dag')
  })
  it('genkender i går', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(formatRelativeDate(d)).toBe('i går')
  })
  it('bruger "for N dage siden" for <= 7 dage tilbage', () => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    expect(formatRelativeDate(d)).toBe('for 3 dage siden')
  })
  it('falder tilbage til absolut for > 7 dage tilbage', () => {
    const d = new Date('2026-01-01')
    expect(formatRelativeDate(d)).toMatch(/januar/)
  })
})
```

- [ ] **Step 5: Kør tests**

```bash
npx vitest run src/__tests__/date-helpers.test.ts
```

Forventet: alle passerer.

- [ ] **Step 6: Refaktor call-sites**

For hver fil i `/tmp/date-sites.log`:

- Læs linjen
- Bedøm formatet (kort/lang/med tid?)
- Erstat med passende helper-kald
- Hvis formatet ikke passer 1-til-1 på en helper, behold den inline men flag i commit-message

Commit pr. 2-3 filer med message som `refactor(dates): brug formatDanishDate i <område>`.

- [ ] **Step 7: Endelig verifikation**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -3
```

- [ ] **Step 8: Commit af helpers + tests**

Helpers + tests committes FØRST (Step 5), så call-site-refactors (Step 6) hver for sig. Det gør det muligt at cherry-pick fra call-site-commits hvis noget fejler.

---

### Task 4: Dashboard helpers extraction

**Files:**

- Create `src/lib/dashboard-helpers.ts`
- Create `src/__tests__/dashboard-helpers.test.ts`
- Modify `src/actions/dashboard.ts`

- [ ] **Step 1: Læs `src/actions/dashboard.ts`**

Identificér alle ikke-eksporterede helper-funktioner. Baseret på audit (linje 410-425) inkluderer dette mindst `filterLatestPerCompany`. Find også andre kandidater — typisk:

- Sortering/aggregering pr. selskab
- Urgency/priority-sortering
- Dato-bucketing
- Top-N-selection

Noter hvilke helpers der har:

- Ingen side-effects
- Pure input → output
- Ikke afhænger af session/prisma (dem kan ekstraheres)

- [ ] **Step 2: Opret `src/lib/dashboard-helpers.ts`**

For hver ren helper, flyt den ud med en JSDoc-line. Eksempel struktur:

```ts
/**
 * Dashboard-specifikke pure helpers. Ingen DB-kald, ingen session-brug.
 */

export function filterLatestPerCompany<T extends { company_id: string; created_at: Date }>(
  items: T[]
): T[] {
  const map = new Map<string, T>()
  for (const item of items) {
    const existing = map.get(item.company_id)
    if (!existing || item.created_at > existing.created_at) {
      map.set(item.company_id, item)
    }
  }
  return Array.from(map.values())
}

// + andre helpers...
```

Bevar præcist samme signatur og opførsel som i dashboard.ts.

- [ ] **Step 3: Opret test-fil**

```ts
import { describe, it, expect } from 'vitest'
import { filterLatestPerCompany } from '@/lib/dashboard-helpers'

describe('filterLatestPerCompany', () => {
  it('returnerer nyeste item pr. company_id', () => {
    const items = [
      { company_id: 'a', created_at: new Date('2026-01-01') },
      { company_id: 'a', created_at: new Date('2026-02-01') },
      { company_id: 'b', created_at: new Date('2026-01-15') },
    ]
    const result = filterLatestPerCompany(items)
    expect(result).toHaveLength(2)
    expect(result.find((i) => i.company_id === 'a')?.created_at).toEqual(new Date('2026-02-01'))
  })

  it('returnerer tom array for tom input', () => {
    expect(filterLatestPerCompany([])).toEqual([])
  })

  it('håndterer single-item', () => {
    const items = [{ company_id: 'a', created_at: new Date('2026-01-01') }]
    expect(filterLatestPerCompany(items)).toEqual(items)
  })
})

// + tests for andre helpers...
```

Mindst 3 tests pr. ekstraheret helper.

- [ ] **Step 4: Opdatér `src/actions/dashboard.ts`**

- Slet de flyttede helper-funktioner
- Tilføj import øverst: `import { filterLatestPerCompany, ...andre } from '@/lib/dashboard-helpers'`
- Kald-site ændres ikke (samme funktionsnavn)

- [ ] **Step 5: Verificér**

```bash
npx vitest run src/__tests__/dashboard-helpers.test.ts
npx tsc --noEmit
npm test 2>&1 | tail -3
```

Og test i browser: `/dashboard` skal fortsat rendere korrekt.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard-helpers.ts src/__tests__/dashboard-helpers.test.ts src/actions/dashboard.ts
git commit -m "refactor(dashboard): ekstrahér pure helpers til lib/dashboard-helpers"
```

---

### Task 5: Zod-Prisma enum bridge (eliminate `as never` casts)

**Files:**

- Create `src/lib/zod-enums.ts`
- Create `src/__tests__/zod-enums.test.ts`
- Modify `src/actions/cases.ts`, `contracts.ts`, `finance.ts`, `tasks.ts`, `visits.ts`
- Modify `src/app/(dashboard)/cases/page.tsx`, `tasks/page.tsx`
- Modify `src/lib/validations/*.ts` hvis relevant

- [ ] **Step 1: Find alle `as never` call-sites**

```bash
grep -rn "as never" src/ --include="*.ts" --include="*.tsx" > /tmp/as-never.log
cat /tmp/as-never.log
wc -l /tmp/as-never.log
```

Audit siger 31 stk. Noter hvilke der er:

- Zod → Prisma enum casts (dem vi løser)
- Mock-prisma casts i tests (behold dem — de er tilsigtede for Prisma-typerne)
- Andre (analyse pr. fil)

- [ ] **Step 2: Opret `src/lib/zod-enums.ts`**

```ts
import { z } from 'zod'
import type {
  CaseType,
  CaseStatus,
  ContractStatus,
  ContractSystemType,
  TaskStatus,
  TaskPriority,
  VisitType,
  VisitStatus,
  SensitivityLevel,
  FinanceMetricType,
  FinancePeriodType,
} from '@prisma/client'

/**
 * Type-safe Zod-enum-factory. Returnerer et Zod-schema hvis output er
 * type-compatible med Prisma-enum'et.
 */

// Eksempel-pattern — tilpas til de faktiske Prisma-enum-navne i schema.prisma
export const zodCaseType = z.enum([
  'TRANSAKTION',
  'TVIST',
  'COMPLIANCE',
  'KONTRAKT',
  'GOVERNANCE',
  'ANDET',
]) satisfies z.ZodType<CaseType>

export const zodCaseStatus = z.enum([
  'NY',
  'AKTIV',
  'AFVENTER_EKSTERN',
  'AFVENTER_KLIENT',
  'LUKKET',
  'ARKIVERET',
]) satisfies z.ZodType<CaseStatus>

export const zodTaskStatus = z.enum([
  'NY',
  'AKTIV_TASK',
  'AFVENTER',
  'LUKKET',
]) satisfies z.ZodType<TaskStatus>

export const zodTaskPriority = z.enum([
  'LAV',
  'MELLEM',
  'HOEJ',
  'KRITISK',
]) satisfies z.ZodType<TaskPriority>

export const zodVisitType = z.enum([
  'KVARTALSBESOEG',
  'OPFOELGNING',
  'AD_HOC',
  'AUDIT',
  'ONBOARDING',
  'OVERDRAGELSE',
]) satisfies z.ZodType<VisitType>

export const zodVisitStatus = z.enum([
  'PLANLAGT',
  'GENNEMFOERT',
  'AFLYST',
]) satisfies z.ZodType<VisitStatus>

export const zodSensitivity = z.enum([
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]) satisfies z.ZodType<SensitivityLevel>

// + finance/contract enums...
```

**Vigtigt:** Hent de faktiske enum-værdier fra `prisma/schema.prisma` — det er source of truth. Hvis der er mismatch med en eksisterende Zod-schema (fx `src/lib/validations/case.ts` har `z.enum([...])`-inline), ryd inline op og importér den nye fælles schema.

- [ ] **Step 3: Opret tests**

```ts
import { describe, it, expect } from 'vitest'
import {
  zodCaseStatus,
  zodTaskStatus,
  zodTaskPriority,
  zodVisitType,
  zodSensitivity,
} from '@/lib/zod-enums'

describe('zodCaseStatus', () => {
  it('accepterer valid status', () => {
    expect(zodCaseStatus.parse('NY')).toBe('NY')
  })
  it('afviser invalid status', () => {
    expect(() => zodCaseStatus.parse('UGYLDIG')).toThrow()
  })
})

// + tests pr. enum...
```

- [ ] **Step 4: Refaktor action-filer**

For hver action-fil (cases, contracts, finance, tasks, visits):

1. Læs filen
2. Erstat inline `z.enum([...])` med importeret schema fra zod-enums
3. Fjern `as never`-casts på parsed data — TypeScript vil acceptere de nu-type-safe enum-strings direkte i Prisma-kald
4. Eksempel (cases.ts):

**Før:**

```ts
const createCaseSchema = z.object({
  caseType: z.string().min(1),
  // ...
})

const parsed = createCaseSchema.safeParse(input)
await prisma.case.create({
  data: {
    case_type: parsed.data.caseType as never, // cast
    // ...
  },
})
```

**Efter:**

```ts
import { zodCaseType } from '@/lib/zod-enums'

const createCaseSchema = z.object({
  caseType: zodCaseType,
  // ...
})

const parsed = createCaseSchema.safeParse(input)
await prisma.case.create({
  data: {
    case_type: parsed.data.caseType, // ingen cast
    // ...
  },
})
```

5. Samme pattern for filter-page-parametre (cases/page.tsx, tasks/page.tsx):

**Før:**

```ts
const statusFilter = searchParams.status as never
```

**Efter:**

```ts
import { zodCaseStatus } from '@/lib/zod-enums'
const parsed = zodCaseStatus.safeParse(searchParams.status)
const statusFilter = parsed.success ? parsed.data : undefined
```

6. Behold `as never` i test-mocks — de er der tilsigtet.

- [ ] **Step 5: Commit pr. fil**

Commit separat for hver action-fil så det er let at rollback:

```bash
git add src/actions/cases.ts
git commit -m "refactor(cases): brug zod-enums, fjern as never casts"
```

Gentag for contracts, finance, tasks, visits. Så page-filerne:

```bash
git add src/app/(dashboard)/cases/page.tsx src/app/(dashboard)/tasks/page.tsx
git commit -m "refactor(filters): brug zod-enums i status/priority-filter"
```

- [ ] **Step 6: Endelig verifikation**

```bash
grep -rn "as never" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
# Forventet: 0 eller nær 0 linjer. Ekskluder test-mocks.

npx tsc --noEmit
npm test 2>&1 | tail -3
rm -rf .next && npx next build 2>&1 | tail -5
```

Tests: 550 → ~560 passed (inkl. zod-enums-tests).

---

### Task 6: Shared nav-config

**Files:**

- Create `src/lib/nav-config.ts`
- Modify `src/components/layout/mobile-nav.tsx`
- Modify `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Læs begge filer**

```bash
cat src/components/layout/mobile-nav.tsx
cat src/components/layout/app-sidebar.tsx
```

Identificér:

- Fælles nav-items (label, href, icon)
- Mobile-only items (Search?)
- Sidebar-only grupperings (Overblik / Portefølje / Ressourcer)

- [ ] **Step 2: Opret `src/lib/nav-config.ts`**

```ts
import {
  LayoutDashboard,
  Building2,
  FileText,
  // ...alle ikoner
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  mobileOnly?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

/** Flat liste til mobile-nav. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  // ...
]

/** Grupperet til app-sidebar (mobile nav ignorerer grouping). */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overblik',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      // ...
    ],
  },
  // ...
]
```

**Vigtigt:** Bevar eksisterende forskelle intentionelt:

- Hvis mobile-nav har Search og sidebar ikke har, dokumentér det med en kommentar
- Hvis sidebar ikke har Settings og mobile-nav har, også dokumentér

- [ ] **Step 3: Refaktor mobile-nav.tsx**

- Fjern inline `NAV_ITEMS`-array
- Importér fra `@/lib/nav-config`
- Bevar alt andet (styling, onClick-handlers, Sheet-wrapper)

- [ ] **Step 4: Refaktor app-sidebar.tsx**

- Fjern inline `SECTIONS`-array
- Importér `NAV_SECTIONS`
- Rename loop-var hvis nødvendigt

- [ ] **Step 5: Verificér**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -3
```

Kør dev-server og tjek `/dashboard` i både desktop og mobil-viewport — nav skal se uændret ud.

- [ ] **Step 6: Commit**

```bash
git add src/lib/nav-config.ts src/components/layout/mobile-nav.tsx src/components/layout/app-sidebar.tsx
git commit -m "refactor(nav): ekstrahér fælles nav-config (flat + sections)"
```

---

### Task 7: Verifikation + PROGRESS.md

- [ ] **Step 1: Full gate**

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npm test
rm -rf .next && npx next build
```

Forventet:

- format: clean
- lint: 0 errors (kun de 2 autofocus-warnings fra a11y-sessionen)
- tsc: 0 errors
- tests: ~560 passed (+ ~10 fra nye lib-moduler)
- build: grøn

- [ ] **Step 2: Tæl `as never` efter cleanup**

```bash
grep -rn "as never" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | wc -l
# Forventet: 0
```

Hvis > 0, review de tilbageværende og beslut: legitimt (lad stå) eller refactor (yderligere task).

- [ ] **Step 3: Smoke-test UI**

Kør `npm run dev` og klik rundt:

- `/dashboard` — kalender + KPI'er + urgency-listen viser korrekt
- `/companies` — portfolio-listen virker
- `/tasks?view=kanban` — kanban virker
- `/cases` + `/tasks` med status-filter i URL — filteret virker uden type-fejl
- Mobile viewport — mobile-nav åbner og nav-items ser korrekte ud

- [ ] **Step 4: Opdatér PROGRESS.md**

Tilføj efter a11y-afsnittet:

```markdown
## Tech-debt cleanup — 2026-04-18 ✅

6 ekstraherede lib-moduler + eliminated type-safety gaps:

- [x] **Fjernet ubrugt dep** — `fastest-levenshtein` (0 usages)
- [x] **`src/lib/calendar-constants.ts`** — danske måneds- og ugedags-arrays, erstattet i full-calendar + calendar-widget
- [x] **`src/lib/date-helpers.ts`** — `formatDanishDate`, `formatDanishDateTime`, `formatShortDate`, `formatRelativeDate` + tests (+ call-site-refactor i ~6 filer)
- [x] **`src/lib/dashboard-helpers.ts`** — `filterLatestPerCompany` + 6 andre pure helpers, ekstraheret fra dashboard.ts (740 → ~500 linjer) + tests
- [x] **`src/lib/zod-enums.ts`** — type-safe Zod-Prisma-enum-bro med `satisfies z.ZodType<T>`-pattern. Eliminerede 31 `as never`-casts fra 5 action-filer + 2 page-filer
- [x] **`src/lib/nav-config.ts`** — delt nav-data mellem mobile-nav og app-sidebar, intentionelle forskelle bevaret med kommentarer
- [x] **Tests**: 550 → ~560 passed
- [x] **Gate**: format ✅, lint ✅, tsc ✅, build ✅

Tech-debt-track lukket. Produktions-modenhed: foundation + schema/audit + E2E/CI/coverage + a11y + tech-debt. Resterende: Vercel deploy når produktion bliver aktuel.
```

- [ ] **Step 5: Commit**

```bash
git add docs/status/PROGRESS.md
git commit -m "docs(status): tech-debt cleanup complete — 6 lib-moduler + 0 as-never casts"
```

---

## Kritiske filer (quick reference)

**Nye lib-moduler:**

- `src/lib/calendar-constants.ts`
- `src/lib/date-helpers.ts`
- `src/lib/dashboard-helpers.ts`
- `src/lib/zod-enums.ts`
- `src/lib/nav-config.ts`

**Test-filer:**

- `src/__tests__/date-helpers.test.ts`
- `src/__tests__/dashboard-helpers.test.ts`
- `src/__tests__/zod-enums.test.ts`

**Ikke at tage på nu (separate sessions):**

- Split af `contracts-client.tsx` (913 linjer), `review-client.tsx` (810 linjer), `portfolio-client.tsx` (685 linjer) — page-komponent-splits er UI-arbejde med højere risiko
- Videre dashboard.ts-splitting udover pure-helper-ekstraktion (orchestrator-roll er OK i én fil)

---

## Verification

**Teknisk gate:**

```bash
npm run format:check       # clean
npm run lint               # 0 errors
npx tsc --noEmit           # 0 errors
npm test                   # ~560 passed
npx next build             # grøn
```

**Metrics:**

```bash
grep -rn "as never" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | wc -l
# Forventet: 0

wc -l src/actions/dashboard.ts
# Forventet: < 600 (fra 740)

grep -c "fastest-levenshtein" package.json
# Forventet: 0
```

**Acceptance:**

- ✅ 5 nye lib-moduler
- ✅ 3 nye test-filer med min. 3 tests hver
- ✅ 0 `as never`-casts i src/ (udenfor `__tests__/`)
- ✅ `dashboard.ts` < 600 linjer
- ✅ `fastest-levenshtein` ikke i package.json
- ✅ Tests: 550 → ~560 passed
- ✅ UI smoke-test passed
- ✅ PROGRESS.md opdateret

**Ikke-mål (egne sprints):**

- Split af store client-komponenter (contracts-client, review-client, portfolio-client)
- Videre dashboard.ts-split udover pure helpers
- Replace `date-fns` helt (stadig installed men underbrugt)
- Nye features eller UI-ændringer
- Database-schema-ændringer
- Vercel deploy
