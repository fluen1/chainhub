# Fase 1: Konsolidering — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ryd teknisk gæld — centralisér labels, fix auth-checks, og ret Zod UUID-validering — så fase 2 (side-for-side gennemgang) har et rent fundament.

**Architecture:** Tre uafhængige opgaver: (A) migrér hardcoded labels til labels.ts, (B) tilføj auth-wrappers på 5 "opret ny"-sider, (C) erstat z.string().uuid() med z.string().min(1) i alle validerings-schemas.

**Tech Stack:** Next.js 14, TypeScript, Zod, Prisma, Tailwind

---

## Task 1: Tilføj manglende labels til labels.ts

**Files:**
- Modify: `src/lib/labels.ts`

- [ ] **Step 1: Tilføj CompanyPerson rolle-labels**

Tilføj i `src/lib/labels.ts` (efter VISIT-sektionen):

```typescript
// ─── CompanyPerson roller ────────────────────────────────────────────────────

export const COMPANY_PERSON_ROLE_LABELS: Record<string, string> = {
  direktoer: 'Direktør',
  bestyrelsesformand: 'Bestyrelsesformand',
  bestyrelsesmedlem: 'Bestyrelsesmedlem',
  tegningsberettiget: 'Tegningsberettiget',
  revisor: 'Revisor',
  ansat: 'Ansat',
  funktionaer: 'Funktionær',
  'ikke-funktionaer': 'Ikke-funktionær',
  vikar: 'Vikar',
  leder: 'Leder/nøglemedarbejder',
  ekstern_advokat: 'Ekstern advokat',
  ekstern_raadgiver: 'Ekstern rådgiver',
  bankkontakt: 'Bankkontakt',
  forsikringskontakt: 'Forsikringskontakt',
}

export const GOVERNANCE_ROLES = ['direktoer', 'bestyrelsesformand', 'bestyrelsesmedlem', 'tegningsberettiget', 'revisor'] as const

export const EMPLOYEE_ROLES = ['ansat', 'funktionaer', 'ikke-funktionaer', 'vikar', 'leder'] as const

export function getCompanyPersonRoleLabel(role: string): string {
  return COMPANY_PERSON_ROLE_LABELS[role] ?? role
}
```

- [ ] **Step 2: Tilføj MetricSource labels**

Tilføj i `src/lib/labels.ts`:

```typescript
// ─── Økonomi kilde ───────────────────────────────────────────────────────────

export const METRIC_SOURCE_LABELS: Record<string, string> = {
  REVIDERET: 'Revideret',
  UREVIDERET: 'Urevideret',
  ESTIMAT: 'Estimat',
}

export const METRIC_SOURCE_STYLES: Record<string, string> = {
  REVIDERET: 'text-green-700',
  UREVIDERET: 'text-gray-500',
  ESTIMAT: 'text-yellow-600',
}

export function getMetricSourceLabel(source: string): string {
  return METRIC_SOURCE_LABELS[source] ?? source
}

export function getMetricSourceStyle(source: string): string {
  return METRIC_SOURCE_STYLES[source] ?? 'text-gray-500'
}
```

- [ ] **Step 3: Kør tsc**

Run: `npx tsc --noEmit`
Expected: 0 fejl

- [ ] **Step 4: Commit**

```bash
git add src/lib/labels.ts
git commit -m "feat: tilføj CompanyPerson rolle-labels og MetricSource labels til labels.ts"
```

---

## Task 2: Migrér 10 sider fra lokale labels til labels.ts

**Files:**
- Modify: 10 page.tsx filer (se liste nedenfor)

Hver side skal:
1. Fjerne lokale `const STATUS_LABELS`, `ROLE_LABELS`, etc.
2. Importere getter-funktioner fra `@/lib/labels`
3. Erstatte `STATUS_LABELS[x]` med `getCaseStatusLabel(x)` etc.

- [ ] **Step 1: Migrér companies/[id]/cases/page.tsx**

Fjern lokale STATUS_LABELS/STATUS_STYLES (linje 12-28). Importér:
```typescript
import { getCaseStatusLabel, getCaseStatusStyle, getCaseTypeLabel } from '@/lib/labels'
```
Erstat: `STATUS_LABELS[x]` → `getCaseStatusLabel(x)`, `STATUS_STYLES[x]` → `getCaseStatusStyle(x)`, `TYPE_LABELS[x]` → `getCaseTypeLabel(x)`

- [ ] **Step 2: Migrér companies/[id]/contracts/page.tsx**

Fjern lokale STATUS_LABELS/SENSITIVITY_LABELS. Importér:
```typescript
import { getContractStatusLabel, getContractStatusStyle, getSensitivityLabel } from '@/lib/labels'
```

- [ ] **Step 3: Migrér companies/[id]/employees/page.tsx**

Fjern lokale ROLE_LABELS og GOVERNANCE_ROLES. Importér:
```typescript
import { COMPANY_PERSON_ROLE_LABELS, GOVERNANCE_ROLES, EMPLOYEE_ROLES } from '@/lib/labels'
```

- [ ] **Step 4: Migrér companies/[id]/governance/page.tsx**

Fjern lokale ROLE_LABELS og GOVERNANCE_ROLES. Importér fra labels.ts.

- [ ] **Step 5: Migrér companies/[id]/finance/page.tsx**

Fjern lokale METRIC_LABELS/SOURCE_LABELS. Importér:
```typescript
import { getMetricTypeLabel, getPeriodTypeLabel, getMetricSourceLabel, getMetricSourceStyle } from '@/lib/labels'
```

- [ ] **Step 6: Migrér cases/page.tsx**

Fjern lokale STATUS_LABELS/STATUS_STYLES/TYPE_LABELS. Importér:
```typescript
import { getCaseStatusLabel, getCaseStatusStyle, getCaseTypeLabel, CASE_STATUS_LABELS, CASE_TYPE_LABELS } from '@/lib/labels'
```
Brug CASE_STATUS_LABELS og CASE_TYPE_LABELS til at bygge filter-options arrays.

- [ ] **Step 7: Migrér cases/[id]/page.tsx**

Fjern alle lokale label-maps (STATUS_LABELS, TYPE_LABELS, PRIORITY_LABELS, TASK_STATUS_LABELS). Importér getter-funktioner fra labels.ts.

- [ ] **Step 8: Migrér contracts/[id]/page.tsx**

Fjern lokale STATUS_LABELS/STATUS_STYLES/SENSITIVITY_LABELS. Importér fra labels.ts. Behold NEXT_STATUSES (det er forretningslogik, ikke labels).

- [ ] **Step 9: Migrér tasks/page.tsx**

Fjern lokale PRIORITY_LABELS/PRIORITY_STYLES/STATUS_LABELS. Importér fra labels.ts. Brug TASK_STATUS_LABELS og PRIORITY_LABELS til filter-options.

- [ ] **Step 10: Migrér persons/[id]/page.tsx**

Fjern lokale ROLE_LABELS. Importér `getCompanyPersonRoleLabel` fra labels.ts.

- [ ] **Step 11: Kør tsc + build**

Run: `npx tsc --noEmit && npx next build`
Expected: 0 fejl, build GRØN

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: migrér alle hardcoded labels til centraliseret labels.ts (10 sider)"
```

---

## Task 3: Auth-check på 5 "opret ny"-sider

**Files:**
- Modify: `src/app/(dashboard)/companies/new/page.tsx`
- Modify: `src/app/(dashboard)/cases/new/page.tsx`
- Modify: `src/app/(dashboard)/contracts/new/page.tsx`
- Modify: `src/app/(dashboard)/tasks/new/page.tsx`
- Modify: `src/app/(dashboard)/persons/new/page.tsx`

Mønstret: Konvertér fra ren client-component til server-component wrapper + client-form.

- [ ] **Step 1: Fix companies/new/page.tsx**

Læs filen. Hvis den er en client component ('use client'), konvertér:
- Fjern 'use client' fra page.tsx
- Tilføj auth-check øverst: `const session = await auth(); if (!session) redirect('/login')`
- Flyt form-indhold til en separat client-komponent ELLER wrap i server-component
- Hent nødvendig server-data (selskaber, brugere) og send som props

Gentag for alle 5 sider. Læs HVER fil først — nogle er måske allerede korrekte (visits/new er allerede en server component).

- [ ] **Step 2: Fix cases/new/page.tsx**

Samme mønster. Hent selskaber og brugere server-side, send som props til client-form.

- [ ] **Step 3: Fix contracts/new/page.tsx**

Samme mønster. Hent selskaber server-side.

- [ ] **Step 4: Fix tasks/new/page.tsx**

Samme mønster.

- [ ] **Step 5: Fix persons/new/page.tsx**

Samme mønster.

- [ ] **Step 6: Kør tsc + build**

Run: `npx tsc --noEmit && npx next build`
Expected: 0 fejl

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: tilføj auth-check på alle opret-sider (5 sider)"
```

---

## Task 4: Fix Zod UUID-validering i alle schemas

**Files:**
- Modify: `src/lib/validations/case.ts`
- Modify: `src/lib/validations/company.ts`
- Modify: `src/lib/validations/contract.ts`
- Modify: `src/lib/validations/governance.ts`
- Modify: `src/lib/validations/ownership.ts`
- Modify: `src/lib/validations/person.ts`
- Modify: `src/lib/validations/user.ts` (allerede delvist rettet)

- [ ] **Step 1: Erstat z.string().uuid() i alle 7 filer**

I HVER fil: erstat `z.string().uuid()` med `z.string().min(1)`.
Bevar `.optional()` og `.or(z.literal(''))` modifiers.

Eksempel:
```typescript
// FØR:
companyId: z.string().uuid(),
personId: z.string().uuid().optional(),
contractId: z.string().uuid().optional().or(z.literal('')),

// EFTER:
companyId: z.string().min(1),
personId: z.string().min(1).optional(),
contractId: z.string().min(1).optional().or(z.literal('')),
```

For `z.array(z.string().uuid())`: erstat med `z.array(z.string().min(1))`.

- [ ] **Step 2: Kør tsc**

Run: `npx tsc --noEmit`
Expected: 0 fejl

- [ ] **Step 3: Kør tests**

Run: `npm test`
Expected: Alle tests grønne

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations/
git commit -m "fix: erstat z.string().uuid() med z.string().min(1) i alle Zod schemas"
```

---

## Task 5: Verificering

- [ ] **Step 1: Full build**

Run: `npx tsc --noEmit && npx next build`
Expected: 0 TS-fejl, build GRØN

- [ ] **Step 2: Playwright smoke-test**

Start dev-server og test at /settings rolle-ændring virker (den fejlede pga. UUID-validering).

- [ ] **Step 3: Opdater PROGRESS.md**

Tilføj under Sprint 8:
```
### Fase 1: Konsolidering ✅ (DATO)
- [x] Labels centraliseret i labels.ts (10 sider migreret)
- [x] Auth-check tilføjet på 5 "opret ny"-sider
- [x] Zod UUID-validering rettet i 7 validerings-schemas
- [x] Build: GRØN, alle tests grønne
```
