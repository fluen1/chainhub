# Stream C — RBAC & Tenant-Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Hver task er bite-sized og TDD-drevet: skriv testen der BEVISER lækagen (RED), luk lækagen (GREEN), verificér. Steps bruger checkbox (`- [ ]`) til tracking.

**Goal:** Lukke alle RBAC- og tenant-lækager auditen fandt, så ChainHubs ikke-forhandlingsbare 3-lags permission-løfte (company-scope + sensitivity + modul) holder i ALLE data-veje — også AI-chat, CSV-eksport og dokumenter — og så enhver mutation håndhæves af DB-laget (`organization_id` i WHERE), ikke kun af et app-lags pre-check. Succeskriterie: nye tests beviser at en COMPANY_READONLY-bruger ikke kan læse/eksportere/kommentere på STRENGT_FORTROLIG via nogen kanal, og at et cross-tenant update rammer 0 rows.

**Architecture:** Rene "kopiér det eksisterende, korrekte mønster ind"-fixes. De tre permission-helpers (`canAccessCompany`/`canAccessCompanies`, `canAccessSensitivity`/`getAllowedSensitivityLevels`, `canAccessModule`) findes allerede og er testede i read-paths (`src/lib/permissions/index.ts`). Vi anvender dem i de fem steder hvor de mangler, tilføjer `organization_id` til de ~19 mutation-WHERE-klausuler, og injicerer scope+sensitivity-filtre i AI-tools og CSV-eksport. Ingen ny infrastruktur; ingen schema-ændringer (P2 JWT-fix er ren kode i auth-callback).

**Tech Stack:** Next.js 16 Server Actions + API routes, Prisma 6 (Supabase Postgres), NextAuth 5 (JWT, 8h), Zod, Vitest. Permission-helpers i `@/lib/permissions`. Test-mønster: mock `@/lib/auth`, `@/lib/db`, `@/lib/permissions`, `@/lib/rate-limit` via `vi.hoisted` + `vi.mock` (se `src/__tests__/tenant-isolation.test.ts` og `src/__tests__/lib/ai/assistant/tools/search-contracts.test.ts`).

---

## Vigtigt før start — verificerede fakta (afviger fra auditens ordlyd)

Disse er bekræftet mod faktisk kode 2026-06-16 og styrer planen:

1. **`ToolContext` har ALLEREDE `userId`.** `src/lib/ai/assistant/tools/types.ts:9-12` indeholder både `organizationId` og `userId`, og `orchestrator.ts:169,182` sender begge. Auditens "inject userId i ToolContext" er allerede gjort — Task 1 tilføjer KUN filtrene i de tre search-tools.
2. **Kun `Contract`, `Case` og `Document` har et `sensitivity`-felt.** `Person` og `Company` har INTET sensitivity-felt (verificeret mod `prisma/schema.prisma`: Contract:552, Case:686, Document:869; Person/Company: ingen). Derfor får `search_companies` og `search_persons` KUN company-scope-filter, ikke sensitivity-filter. `search_contracts` får begge.
3. **`ExportScope.maxSensitivity` anvendes ALDRIG i nogen fetch-funktion** (kun `visibleCompanyIds`, og kun i companies/contracts/visits — ikke cases/tasks/persons). Se `src/lib/export/entities.ts`. Vi vælger derfor en gate-strategi (Task 2 — to konkret-kodede optioner).
4. **To forskellige modul-gates på eksport allerede:** API-route gater på `'settings'` (GROUP_OWNER/ADMIN) — `route.ts:30`; `prepareExport`/`getExportPreview` gater på `'export'` (GROUP_OWNER/ADMIN/LEGAL/FINANCE) — `export.ts:49,88`. Dette er en eksisterende inkonsistens Task 2 skal samle.
5. **Eksisterende tests der skal udvides (ikke duplikeres):** `src/__tests__/lib/ai/assistant/tools/search-contracts.test.ts`, `src/__tests__/export/entities.test.ts`, `src/__tests__/sensitivity-access-control.test.ts`, `src/__tests__/rbac-scope-fixes.test.ts`, `src/__tests__/permissions-hardening.test.ts`, `src/__tests__/documents-actions.test.ts`, `src/__tests__/tenant-isolation.test.ts`.
6. **Commit-stil:** `[type]: beskrivelse på dansk`. Én commit pr. task (feat/fix/test/refactor). Ingen deploy — Philip ejer go-live-knappen.

**Kør hele Vitest-suiten grøn (`npm test`) efter hver task før commit.**

---

## Task 1: AI-assistent search-tools — company-scope + sensitivity (P0)

**Files:**

- Modify: `src/lib/ai/assistant/tools/search-contracts.ts:32-60` (execute: company-scope + sensitivity)
- Modify: `src/lib/ai/assistant/tools/search-companies.ts:23-44` (execute: company-scope, id-filter)
- Modify: `src/lib/ai/assistant/tools/search-persons.ts:19-46` (execute: company-scope via company_persons)
- Modify (test): `src/__tests__/lib/ai/assistant/tools/search-contracts.test.ts` (tilføj `@/lib/permissions`-mock + lækage-tests)
- Create (test): `src/__tests__/lib/ai/assistant/tools/search-companies.test.ts`
- Create (test): `src/__tests__/lib/ai/assistant/tools/search-persons.test.ts`

- [ ] **Step 1 (RED): Skriv lækage-test for search_contracts.** Udvid den eksisterende test. Tilføj permissions-mock i hoisted-blokken og to nye tests der beviser scope+sensitivity havner i WHERE.

I `src/__tests__/lib/ai/assistant/tools/search-contracts.test.ts`, tilføj efter `vi.mock('@/lib/db', ...)` (linje 13):

```ts
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['co-1', 'co-2']),
  getAllowedSensitivityLevels: vi.fn().mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN']),
}))

import * as perms from '@/lib/permissions'
```

Tilføj disse tests i `describe('searchContractsTool', ...)`:

```ts
it('begrænser til accessible companies og tilladte sensitivity-niveauer (RBAC)', async () => {
  prismaMock.contract.findMany.mockResolvedValue([])

  await searchContractsTool.execute({ query: 'x' }, context)

  const where = prismaMock.contract.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
  expect(where.company_id).toEqual({ in: ['co-1', 'co-2'] })
  expect(where.sensitivity).toEqual({ in: ['PUBLIC', 'STANDARD', 'INTERN'] })
  expect(perms.getAccessibleCompanies).toHaveBeenCalledWith('user-1', 'org-1')
  expect(perms.getAllowedSensitivityLevels).toHaveBeenCalledWith('user-1', 'org-1')
})

it('COMPANY_READONLY uden adgang til selskaber får tomt resultat (ingen lækage)', async () => {
  vi.mocked(perms.getAccessibleCompanies).mockResolvedValueOnce([])
  prismaMock.contract.findMany.mockResolvedValue([])

  const result = await searchContractsTool.execute({}, context)

  const where = prismaMock.contract.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
  expect(where.company_id).toEqual({ in: [] })
  expect(result.data).toEqual([])
})
```

Forventet output: `FAIL` — de nye assertions fejler fordi `where.company_id` og `where.sensitivity` er `undefined` i nuværende kode.

- [ ] **Step 2 (GREEN): Tilføj filtre i search-contracts.ts.** Erstat starten af `execute` (linje 32-33) og WHERE-objektet (linje 46-54):

```ts
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { organizationId, userId } = context
```

og tilføj efter `expiryBefore`-beregningen (efter linje 44), før `prisma.contract.findMany`:

```ts
const [accessibleCompanyIds, allowedSensitivity] = await Promise.all([
  getAccessibleCompanies(userId, organizationId),
  getAllowedSensitivityLevels(userId, organizationId),
])
```

og i WHERE (linje 47-54) tilføj de to filtre:

```ts
      where: {
        organization_id: organizationId,
        deleted_at: null,
        company_id: { in: accessibleCompanyIds },
        sensitivity: { in: allowedSensitivity },
        ...(query ? { display_name: { contains: query, mode: 'insensitive' } } : {}),
        ...(status ? { status: status as never } : {}),
        ...(contractType ? { system_type: contractType as never } : {}),
        ...(expiryBefore ? { expiry_date: { lte: expiryBefore, gte: now } } : {}),
      },
```

Tilføj importen øverst (linje 2):

```ts
import { getAccessibleCompanies, getAllowedSensitivityLevels } from '@/lib/permissions'
```

Forventet output: `PASS` for search-contracts-testen.

- [ ] **Step 3 (RED): Opret test for search_companies** (`src/__tests__/lib/ai/assistant/tools/search-companies.test.ts`). Companies har INGEN sensitivity — kun company-scope via `id: { in }`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { company: { findMany: vi.fn() } },
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['co-1', 'co-2']),
}))

import * as perms from '@/lib/permissions'
import { searchCompaniesTool } from '@/lib/ai/assistant/tools/search-companies'

const context = { organizationId: 'org-1', userId: 'user-1' }

describe('searchCompaniesTool — RBAC company-scope', () => {
  beforeEach(() => vi.clearAllMocks())

  it('begrænser til id: { in: accessibleCompanyIds }', async () => {
    prismaMock.company.findMany.mockResolvedValue([])
    await searchCompaniesTool.execute({}, context)
    const where = prismaMock.company.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
    expect(where.id).toEqual({ in: ['co-1', 'co-2'] })
    expect(perms.getAccessibleCompanies).toHaveBeenCalledWith('user-1', 'org-1')
  })

  it('bruger uden company-adgang får tomt id-filter (ingen lækage)', async () => {
    vi.mocked(perms.getAccessibleCompanies).mockResolvedValueOnce([])
    prismaMock.company.findMany.mockResolvedValue([])
    await searchCompaniesTool.execute({ query: 'klinik' }, context)
    const where = prismaMock.company.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
    expect(where.id).toEqual({ in: [] })
  })
})
```

Forventet output: `FAIL` (kompilerer, men `where.id` er `undefined`).

- [ ] **Step 4 (GREEN): Tilføj scope i search-companies.ts.** Importer (linje 2): `import { getAccessibleCompanies } from '@/lib/permissions'`. Skift `const { organizationId } = context` (linje 24) til `const { organizationId, userId } = context`. Indsæt før `prisma.company.findMany`:

```ts
const accessibleCompanyIds = await getAccessibleCompanies(userId, organizationId)
```

og i WHERE (linje 29-31) tilføj:

```ts
      where: {
        organization_id: organizationId,
        deleted_at: null,
        id: { in: accessibleCompanyIds },
        ...(query
```

Forventet output: `PASS`.

- [ ] **Step 5 (RED): Opret test for search_persons** (`src/__tests__/lib/ai/assistant/tools/search-persons.test.ts`). Persons har ingen sensitivity; scope sker via `company_persons`-relationen. Personer UDEN nogen selskabstilknytning er org-niveau-personer og forbliver synlige (samme princip som `getDocumentsPageData`s `OR: [{ company_id: null }, ...]`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { person: { findMany: vi.fn() } },
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['co-1']),
}))

import { searchPersonsTool } from '@/lib/ai/assistant/tools/search-persons'

const context = { organizationId: 'org-1', userId: 'user-1' }

describe('searchPersonsTool — RBAC company-scope', () => {
  beforeEach(() => vi.clearAllMocks())

  it('begrænser til personer uden tilknytning ELLER tilknyttet accessible companies', async () => {
    prismaMock.person.findMany.mockResolvedValue([])
    await searchPersonsTool.execute({}, context)
    const where = prismaMock.person.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
    expect(where.AND).toEqual([
      {
        OR: [
          { company_persons: { none: {} } },
          { company_persons: { some: { company_id: { in: ['co-1'] }, deleted_at: null } } },
        ],
      },
    ])
  })
})
```

Forventet output: `FAIL`.

- [ ] **Step 6 (GREEN): Tilføj scope i search-persons.ts.** Importer (linje 2): `import { getAccessibleCompanies } from '@/lib/permissions'`. Skift `const { organizationId } = context` (linje 20) til `const { organizationId, userId } = context`. Indsæt før `prisma.person.findMany`:

```ts
const accessibleCompanyIds = await getAccessibleCompanies(userId, organizationId)
```

I WHERE (linje 24-35): bevar `organization_id`/`deleted_at`, læg fritekst-OR og scope-OR i en `AND` så de to OR'er ikke kolliderer:

```ts
      where: {
        organization_id: organizationId,
        deleted_at: null,
        AND: [
          {
            OR: [
              { company_persons: { none: {} } },
              { company_persons: { some: { company_id: { in: accessibleCompanyIds }, deleted_at: null } } },
            ],
          },
          ...(query
            ? [
                {
                  OR: [
                    { first_name: { contains: query, mode: 'insensitive' as const } },
                    { last_name: { contains: query, mode: 'insensitive' as const } },
                    { email: { contains: query, mode: 'insensitive' as const } },
                  ],
                },
              ]
            : []),
        ],
      },
```

Forventet output: `PASS`. (Hvis fritekst-test fra eksisterende suite asserter den gamle top-level `OR`-form, opdatér den til at læse `where.AND[1].OR` — mønstret er nu nestet.)

- [ ] **Step 7: Kør alle tre tool-tests + typecheck.**

```bash
npx vitest run src/__tests__/lib/ai/assistant/tools/ && npx tsc --noEmit
```

Forventet: alle grønne, 0 type-fejl.

- [ ] **Step 8: Commit.**

```bash
git add src/lib/ai/assistant/tools/search-contracts.ts src/lib/ai/assistant/tools/search-companies.ts src/lib/ai/assistant/tools/search-persons.ts "src/__tests__/lib/ai/assistant/tools/"
git commit -m "fix(ai): company-scope + sensitivity-filter i alle AI-search-tools (RBAC-bypass lukket)"
```

---

## Task 2: CSV-eksport — luk company-scope/sensitivity-lækagen (P0)

**Files:**

- Modify: `src/app/api/export/[entity]/route.ts:30,52-54`
- Modify: `src/actions/export.ts:49,88-94`
- Evt. modify: `src/lib/export/entities.ts` (kun ved Option A — sensitivity-filter i cases/contracts)
- Modify (test): `src/__tests__/export/entities.test.ts` + `src/__tests__/export-actions.test.ts`

**ÅBEN BESLUTNING — vælg Option A eller B (begge fuldt kodet nedenfor). Default-anbefaling: Option B.**

Auditen tilbyder eksplicit to veje: (A) injicér scope, eller (B) gate eksport til admin-roller med ALL-scope. Verificeret kontekst: `maxSensitivity` anvendes aldrig i `entities.ts`, og `visibleCompanyIds` anvendes kun i companies/contracts/visits (ikke cases/tasks/persons). Option A kræver derfor reelt nyt filter-arbejde i `entities.ts` for at være vandtæt; Option B er den mindste, mest revisionssikre ændring og matcher at eksport allerede er en compliance/admin-funktion.

> **Anbefaling: Option B.** Mindst kode, fail-closed, og eliminerer den eksisterende dobbelt-gate-inkonsistens (route='settings' vs. action='export'). En GROUP_LEGAL/FINANCE-bruger der reelt skal kunne eksportere et begrænset scope er ikke et bekræftet krav — surface det til Philip frem for at bygge partial-scope-eksport spekulativt (Rule 2). Hvis Philip bekræfter at LEGAL/FINANCE SKAL kunne eksportere deres delmængde, så vælg Option A.

### Option A — Injicér scope + sensitivity i ExportScope (fuld scope-respekt)

- [ ] **A1 (RED):** I `src/__tests__/export/entities.test.ts`, tilføj test der beviser at `cases`/`tasks`/`persons` respekterer `visibleCompanyIds` og at contracts/cases respekterer `maxSensitivity`:

```ts
it('fetchContractsForExport filtrerer på maxSensitivity', async () => {
  prismaMock.contract.findMany.mockResolvedValue([])
  await fetchContractsForExport({
    organizationId: 'org-1',
    visibleCompanyIds: ['co-1'],
    allowedSensitivity: ['PUBLIC', 'STANDARD', 'INTERN'],
  })
  const where = prismaMock.contract.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
  expect(where.company_id).toEqual({ in: ['co-1'] })
  expect(where.sensitivity).toEqual({ in: ['PUBLIC', 'STANDARD', 'INTERN'] })
})
```

(Bemærk: skift `maxSensitivity?: string` til `allowedSensitivity?: SensitivityLevel[]` — et liste-filter matcher `getAllowedSensitivityLevels` og er entydigt. Tilsvarende test for `fetchCasesForExport` og `visibleCompanyIds` i cases/tasks/persons.)

- [ ] **A2 (GREEN):** I `src/lib/export/entities.ts`:
  - Udskift `maxSensitivity?: string` i `ExportScope` (linje 21) med `allowedSensitivity?: SensitivityLevel[]` (importér `SensitivityLevel` fra `@prisma/client`).
  - I `fetchContractsForExport` WHERE (linje 151-155) og `fetchCasesForExport` WHERE (linje 185): tilføj `...(scope.allowedSensitivity ? { sensitivity: { in: scope.allowedSensitivity } } : {})`.
  - I `fetchCasesForExport` (linje 184-185): tilføj company-scope via relationen — `...(scope.visibleCompanyIds ? { case_companies: { some: { company_id: { in: scope.visibleCompanyIds } } } } : {})`.
  - I `fetchTasksForExport` (linje 227) og `fetchPersonsForExport` (linje 275): persons har ingen company_id-kolonne på selve rækken — persons-eksport scopes via `company_persons`-relationen som i Task 1 Step 6; tasks via `company_id: { in }`.

- [ ] **A3 (GREEN):** I `src/actions/export.ts` (`getExportPreview`, linje 92) og `src/app/api/export/[entity]/route.ts` (linje 52): hent og indsæt scope:

```ts
import { getAccessibleCompanies, getAllowedSensitivityLevels } from '@/lib/permissions'
// ...
const [visibleCompanyIds, allowedSensitivity] = await Promise.all([
  getAccessibleCompanies(session.user.id, session.user.organizationId),
  getAllowedSensitivityLevels(session.user.id, session.user.organizationId),
])
const { columns, rows } = await fetchEntityForExport(input.entity, {
  organizationId: session.user.organizationId,
  visibleCompanyIds,
  allowedSensitivity,
})
```

og afstem modul-gaten: brug `'export'` begge steder (route bruger pt. `'settings'` — ret linje 30 til `'export'` så route og action er konsistente).

### Option B (ANBEFALET) — Gate eksport til ALL-scope-admins

- [ ] **B1 (RED):** Opret `src/__tests__/export/export-rbac-gate.test.ts` der beviser at en bruger uden ALL-scope afvises, og at en COMPANY_READONLY ikke kan downloade:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
const { permsMock } = vi.hoisted(() => ({
  permsMock: { canExportAllScope: vi.fn() },
}))
vi.mock('@/lib/permissions', () => permsMock)
vi.mock('@/lib/export/entities', () => ({
  fetchEntityForExport: vi.fn().mockResolvedValue({ filename: 'x', rows: [], columns: [] }),
}))
vi.mock('@/lib/export/csv', () => ({ toCsvBuffer: vi.fn().mockResolvedValue(Buffer.from('')) }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))

import { auth } from '@/lib/auth'
import { GET } from '@/app/api/export/[entity]/route'

const session = { user: { id: 'u1', organizationId: 'org-1' }, expires: '2099-01-01' }

describe('export-route — kun ALL-scope-admins', () => {
  beforeEach(() => vi.clearAllMocks())

  it('COMPANY_READONLY (ingen ALL-scope) → 403', async () => {
    vi.mocked(auth).mockResolvedValue(session as never)
    permsMock.canExportAllScope.mockResolvedValue(false)
    const res = await GET(new Request('http://x'), {
      params: Promise.resolve({ entity: 'contracts' }),
    })
    expect(res.status).toBe(403)
  })

  it('GROUP_OWNER (ALL-scope) → 200', async () => {
    vi.mocked(auth).mockResolvedValue(session as never)
    permsMock.canExportAllScope.mockResolvedValue(true)
    const res = await GET(new Request('http://x'), {
      params: Promise.resolve({ entity: 'contracts' }),
    })
    expect(res.status).toBe(200)
  })
})
```

Forventet: `FAIL` (`canExportAllScope` findes ikke endnu).

- [ ] **B2 (GREEN):** Tilføj helper i `src/lib/permissions/index.ts` (genbruger `getUserRoles` + `GROUP_ROLES`):

```ts
/**
 * Eksport leverer hele datasæt på tværs af selskaber og er en compliance/admin-funktion.
 * Kræv en gruppe-rolle med ALL-scope (kan se alle selskaber) OG STRENGT_FORTROLIG-adgang,
 * så delvist-scopede brugere ikke kan exfiltrere data de ikke må se række-for-række.
 */
export async function canExportAllScope(userId: string, organizationId: string): Promise<boolean> {
  const roles = await getUserRoles(userId, organizationId)
  const hasAllScope = roles.some((a) => GROUP_ROLES.includes(a.role) && a.scope === 'ALL')
  const canSeeTopSensitivity = roles.some((a) => STRENGT_FORTROLIG_ROLES.includes(a.role))
  return hasAllScope && canSeeTopSensitivity
}
```

- [ ] **B3 (GREEN):** I `src/app/api/export/[entity]/route.ts` erstat linje 30-33:

```ts
const canExport = await canExportAllScope(session.user.id, session.user.organizationId)
if (!canExport) {
  return Response.json(
    { error: 'Kun gruppe-administratorer med fuld adgang kan eksportere data' },
    { status: 403 }
  )
}
```

og tilsvarende i `src/actions/export.ts` (`prepareExport` linje 49 + `getExportPreview` linje 88): erstat `canAccessModule(..., 'export', ...)` med `canExportAllScope(session.user.id, session.user.organizationId)`. Importér helperen begge steder.

- [ ] **B4:** Opdatér evt. eksisterende `export-actions.test.ts`/`module-access-permissions.test.ts` der asserter den gamle `'export'`/`'settings'`-gate til at mocke `canExportAllScope`.

### Fælles afslutning (begge optioner)

- [ ] **Step Z: Kør eksport-tests + typecheck + commit.**

```bash
npx vitest run src/__tests__/export src/__tests__/export-actions.test.ts && npx tsc --noEmit
git add src/app/api/export src/actions/export.ts src/lib/export/entities.ts src/lib/permissions/index.ts src/__tests__/export
git commit -m "fix(export): luk CSV company-scope/sensitivity-lækage (Option <A|B>)"
```

---

## Task 3: Dokument-sensitivity i alle document-actions (P0)

**Files:**

- Modify: `src/actions/documents.ts:8` (import), `:137-143` (list-WHERE), `:317-334` (deleteDocument), `:356-374` (submitDocumentForReview), `:392-410` (reviewDocument), `:255-269` (getDocumentReviewPageData)
- Modify: `src/actions/document-enrichment.ts:6` (import), `:46-64` (getDocumentEnrichment)
- Modify (test): `src/__tests__/documents-actions.test.ts` + `src/__tests__/document-review-actions.test.ts`

`Document.sensitivity` findes (schema:869). Mønster: list-query bruger `sensitivity: { in: allowedLevels }`; mutationer/detalje henter `doc.sensitivity` og kalder `canAccessSensitivity` FØR mutation/return.

- [ ] **Step 1 (RED): Test for getDocumentsPageData sensitivity-filter.** I `src/__tests__/documents-actions.test.ts`, sørg for `@/lib/permissions`-mock inkluderer `getAllowedSensitivityLevels` og `canAccessSensitivity`, og tilføj:

```ts
it('getDocumentsPageData begrænser WHERE til allowedSensitivity', async () => {
  vi.mocked(perms.getAllowedSensitivityLevels).mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN'])
  vi.mocked(perms.getAccessibleCompanies).mockResolvedValue(['co-1'])
  mockPrisma.document.findMany.mockResolvedValue([])
  mockPrisma.document.count.mockResolvedValue(0)

  await getDocumentsPageData(1, 25)

  const where = mockPrisma.document.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
  expect(where.sensitivity).toEqual({ in: ['PUBLIC', 'STANDARD', 'INTERN'] })
})
```

Forventet: `FAIL`.

- [ ] **Step 2 (GREEN): documents.ts list-query.** Skift import (linje 8):

```ts
import {
  canAccessCompany,
  canAccessModule,
  canAccessSensitivity,
  getAccessibleCompanies,
  getAllowedSensitivityLevels,
} from '@/lib/permissions'
```

I `getDocumentsPageData` efter `companyIds`-hentning (linje 131) tilføj:

```ts
const allowedLevels = await getAllowedSensitivityLevels(session.user.id, orgId)
```

og i `where` (linje 137-143) tilføj `sensitivity: { in: allowedLevels }`:

```ts
const where = {
  organization_id: orgId,
  deleted_at: null,
  sensitivity: { in: allowedLevels },
  OR: [{ company_id: null }, { company_id: { in: companyIds } }],
}
```

Forventet: `PASS`.

- [ ] **Step 3 (RED): Test for deleteDocument afviser for-høj sensitivity.** Tilføj:

```ts
it('deleteDocument afviser når brugeren ikke kan se dokumentets sensitivity', async () => {
  mockPrisma.document.findFirst.mockResolvedValue({
    id: 'd-1',
    company_id: null,
    sensitivity: 'STRENGT_FORTROLIG',
  })
  vi.mocked(perms.canAccessSensitivity).mockResolvedValue(false)

  const res = await deleteDocument('00000000-0000-0000-0000-000000000001')

  expect(res).toEqual({ error: 'Ingen adgang til dette dokument' })
  expect(mockPrisma.document.update).not.toHaveBeenCalled()
})
```

Forventet: `FAIL` (mutation kører i dag).

- [ ] **Step 4 (GREEN): Sensitivity-check i deleteDocument/submitDocumentForReview/reviewDocument.** I hver af de tre: tilføj `sensitivity: true` til `select` i deres `findFirst`, og indsæt umiddelbart efter det eksisterende `if (doc.company_id) { canAccessCompany ... }`-blok:

```ts
const canSens = await canAccessSensitivity(
  session.user.id,
  doc.sensitivity,
  session.user.organizationId
)
if (!canSens) return { error: 'Ingen adgang til dette dokument' }
```

(deleteDocument: efter linje 334; submitDocumentForReview: efter linje 374; reviewDocument: efter linje 410. Husk `sensitivity: true` i hvert `select` på hhv. linje 323, 362, 398.)

- [ ] **Step 5 (GREEN): getDocumentReviewPageData.** Tilføj `sensitivity: true` til `documentReviewInclude`s afledte select er ikke nødvendigt — `doc` er fuld række, så `doc.sensitivity` er allerede tilgængelig. Efter company-checket (linje 266-269) tilføj:

```ts
const canSens = await canAccessSensitivity(session.user.id, doc.sensitivity, orgId)
if (!canSens) return null
```

- [ ] **Step 6 (GREEN): getDocumentEnrichment.** I `src/actions/document-enrichment.ts`: udvid importen (linje 6) til `import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'`, tilføj `sensitivity: true` til `select` (linje 52), og efter company-checket (linje 57-64):

```ts
const canSens = await canAccessSensitivity(
  session.user.id,
  document.sensitivity,
  session.user.organizationId
)
if (!canSens) return { error: 'Ingen adgang til dette dokument' }
```

- [ ] **Step 7: Kør document-tests + typecheck + commit.**

```bash
npx vitest run src/__tests__/documents-actions.test.ts src/__tests__/document-review-actions.test.ts && npx tsc --noEmit
git add src/actions/documents.ts src/actions/document-enrichment.ts src/__tests__/documents-actions.test.ts src/__tests__/document-review-actions.test.ts
git commit -m "fix(documents): canAccessSensitivity i list/delete/review/enrichment (sensitivity-lag lukket)"
```

---

## Task 4: `organization_id` på alle mutation-WHERE (~19 steder) (P1)

**Files (verificerede linjenumre):**

- Modify: `src/actions/contracts.ts:377,443,517,763` (4 update WHERE — `{ id }` → `{ id, organization_id }`)
- Modify: `src/actions/cases.ts:177,271,463,509` (4)
- Modify: `src/actions/tasks.ts:328,382,454,511,562` (5 — fire i `tx`, én direkte)
- Modify: `src/actions/persons.ts:238,310` (2)
- Modify: `src/actions/governance.ts:151` (1 — `companyPerson.update`)
- Modify: `src/actions/ownership.ts:184,251` (2)
- Modify (test): `src/__tests__/tenant-isolation.test.ts` (tilføj mutation-WHERE-assertions)

Mønster overalt: find pre-check verificerer tenant og laver early-exit; vi tilføjer `organization_id` til selve `update`-WHERE så DB håndhæver det (defense-by-DB-constraint, ikke kun convention). `session.user.organizationId` er allerede i scope i hver action. I `getContractDetailPageData` (contracts.ts:763) hedder variablen `orgId`.

- [ ] **Step 1 (RED): Skriv mutation-WHERE-test for ét repræsentativt update pr. model.** I `src/__tests__/tenant-isolation.test.ts`, tilføj mutation-mocks (`update`-fns) til de relevante modeller i `mockPrisma` og en `describe`-blok. Eksempel for contracts (gentag mønster for case/task/person/companyPerson/ownership):

```ts
it('updateContractStatus inkluderer organization_id i update-WHERE (cross-tenant → 0 rows)', async () => {
  vi.mocked(auth).mockResolvedValue(mockSession as never)
  mockPrisma.contract.findFirst.mockResolvedValue({
    id: 'c-1',
    status: 'UDKAST',
    sensitivity: 'STANDARD',
    company_id: 'co-1',
    organization_id: ORG_ID,
  })
  mockPrisma.contract.update.mockResolvedValue({ id: 'c-1' })

  await updateContractStatus({ contractId: 'c-1', status: 'AKTIV' })

  expect(mockPrisma.contract.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ id: 'c-1', organization_id: ORG_ID }),
    })
  )
})
```

(Tilføj `update: vi.fn()` til `contract`, `case`, `task`, `person`, og nye `companyPerson`/`ownership`-objekter i mockPrisma. Importér `updateContractStatus`, `updateCaseStatus`, `updateTaskStatus`, `updatePerson`, `endCompanyPerson`, `updateOwnership` øverst. For task-transaktioner: mock `mockPrisma.$transaction = vi.fn(async (cb) => cb(mockPrisma))` så `tx.task.update` rammer den samme mock.)

Forventet: `FAIL` på alle nye mutation-assertions.

- [ ] **Step 2 (GREEN): contracts.ts.** Ret de fire WHERE:

```ts
// :376-377
where: { id: parsed.data.contractId, organization_id: session.user.organizationId },
// :442-443
where: { id: contractId, organization_id: session.user.organizationId },
// :516-517
where: { id: parsed.data.contractId, organization_id: session.user.organizationId },
// :762-763 (variablen hedder orgId her)
where: { id: contract.id, organization_id: orgId },
```

- [ ] **Step 3 (GREEN): cases.ts.** På linje 177, 271, 463, 509 — tilføj `, organization_id: session.user.organizationId` i hver `where: { id: ... }`.

- [ ] **Step 4 (GREEN): tasks.ts.** På linje 328, 382, 454, 511 (i `tx.task.update`) og 562 (`prisma.task.update`): tilføj `organization_id: session.user.organizationId` til WHERE. For tx-varianterne: `tx.task.update({ where: { id: task.id, organization_id: session.user.organizationId }, ... })`.

- [ ] **Step 5 (GREEN): persons.ts.** Linje 238: `where: { id: parsed.data.personId, organization_id: session.user.organizationId }`. Linje 310: `where: { id: personId, organization_id: session.user.organizationId }`.

- [ ] **Step 6 (GREEN): governance.ts:151** og **ownership.ts:184,251.** Tilføj `organization_id: session.user.organizationId` til hver `update`-WHERE.

- [ ] **Step 7: Kør tenant-isolation-test + fuld suite + typecheck.**

```bash
npx vitest run src/__tests__/tenant-isolation.test.ts && npx tsc --noEmit && npm test
```

Forventet: alle grønne (de øvrige action-tests må ikke regredere — update-mock returnerer fortsat success).

- [ ] **Step 8: Commit.**

```bash
git add src/actions/contracts.ts src/actions/cases.ts src/actions/tasks.ts src/actions/persons.ts src/actions/governance.ts src/actions/ownership.ts src/__tests__/tenant-isolation.test.ts
git commit -m "fix(tenant): organization_id i alle mutation-WHERE — DB-håndhævet tenant-isolation"
```

---

## Task 5: Manglende permission-checks (updateCaseStatus / createCaseComment / createComment / createPerson / updatePerson) (P1)

**Files:**

- Modify: `src/actions/cases.ts:150-218` (updateCaseStatus → company + sensitivity)
- Modify: `src/actions/comments.ts:63-126` (createCaseComment → sensitivity) og `:23-61` (createComment → company)
- Modify: `src/actions/persons.ts:165-213` (createPerson), `:215-266` (updatePerson) → `canAccessModule('persons')`
- Modify (test): `src/__tests__/sensitivity-access-control.test.ts` + `src/__tests__/permissions-hardening.test.ts`

- [ ] **Step 1 (RED): updateCaseStatus afviser uden adgang.** I `sensitivity-access-control.test.ts` (eller `permissions-hardening.test.ts`), tilføj:

```ts
it('updateCaseStatus afviser når brugeren mangler company-adgang', async () => {
  mockPrisma.case.findFirst.mockResolvedValue({
    id: 'case-1',
    status: 'AABEN',
    sensitivity: 'STRENGT_FORTROLIG',
    case_companies: [{ company_id: 'co-1' }],
  })
  vi.mocked(perms.canAccessCompany).mockResolvedValue(false)

  const res = await updateCaseStatus({ caseId: 'case-1', status: 'UNDER_BEHANDLING' })

  expect(res).toEqual({ error: 'Ingen adgang til denne sag' })
  expect(mockPrisma.case.update).not.toHaveBeenCalled()
})

it('updateCaseStatus afviser når sensitivity er for høj', async () => {
  mockPrisma.case.findFirst.mockResolvedValue({
    id: 'case-1',
    status: 'AABEN',
    sensitivity: 'STRENGT_FORTROLIG',
    case_companies: [{ company_id: 'co-1' }],
  })
  vi.mocked(perms.canAccessCompany).mockResolvedValue(true)
  vi.mocked(perms.canAccessSensitivity).mockResolvedValue(false)

  const res = await updateCaseStatus({ caseId: 'case-1', status: 'UNDER_BEHANDLING' })

  expect(res).toEqual({ error: 'Ingen adgang til denne sag' })
})
```

Forventet: `FAIL`.

- [ ] **Step 2 (GREEN): updateCaseStatus.** Udvid `select` på linje 163 til at inkludere `case_companies: { select: { company_id: true } }`. Efter status-transition-checket (linje 170), før rate-limit, indsæt company+sensitivity-blokken kopieret fra `closeCase` (linje 255-264) plus sensitivity:

```ts
let hasAccess = false
for (const cc of existingCase.case_companies) {
  if (await canAccessCompany(session.user.id, cc.company_id, session.user.organizationId)) {
    hasAccess = true
    break
  }
}
if (!hasAccess) return { error: 'Ingen adgang til denne sag' }

const canSens = await canAccessSensitivity(
  session.user.id,
  existingCase.sensitivity,
  session.user.organizationId
)
if (!canSens) return { error: 'Ingen adgang til denne sag' }
```

(Bekræft at `canAccessCompany`, `canAccessSensitivity` importeres i cases.ts — `canAccessCompany`/`canAccessModule` er der; tilføj `canAccessSensitivity` hvis den mangler.)

- [ ] **Step 3 (RED): createCaseComment sensitivity.** Tilføj test:

```ts
it('createCaseComment afviser når sensitivity for høj selvom company-adgang findes', async () => {
  mockPrisma.case.findFirst.mockResolvedValue({
    id: 'case-1',
    sensitivity: 'STRENGT_FORTROLIG',
    case_companies: [{ company_id: 'co-1' }],
  })
  vi.mocked(perms.canAccessCompany).mockResolvedValue(true)
  vi.mocked(perms.canAccessSensitivity).mockResolvedValue(false)

  const res = await createCaseComment({ content: 'x', caseId: 'case-1' })
  expect(res).toEqual({ error: 'Ingen adgang til denne sag' })
  expect(mockPrisma.comment.create).not.toHaveBeenCalled()
})
```

- [ ] **Step 4 (GREEN): createCaseComment.** I `comments.ts`, udvid import (linje 9) til `import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'`. Efter company-loop-checket (linje 95), indsæt:

```ts
const canSens = await canAccessSensitivity(
  session.user.id,
  caseItem.sensitivity,
  session.user.organizationId
)
if (!canSens) return { error: 'Ingen adgang til denne sag' }
```

(`caseItem.sensitivity` er allerede i scope — bruges på linje 117.)

- [ ] **Step 5 (GREEN): createComment (task) company-check.** I `createComment` (linje 33-40), udvid `findFirst`-resultatet (det er allerede fuld task-række, så `task.company_id` er tilgængelig). Efter `if (!task) return ...` (linje 40), indsæt:

```ts
if (task.company_id) {
  const hasAccess = await canAccessCompany(
    session.user.id,
    task.company_id,
    session.user.organizationId
  )
  if (!hasAccess) return { error: 'Ingen adgang til denne opgave' }
}
```

- [ ] **Step 6 (RED): createPerson/updatePerson modul-check.** Tilføj:

```ts
it('createPerson afviser uden persons-modul-adgang', async () => {
  vi.mocked(perms.canAccessModule).mockResolvedValue(false)
  const res = await createPerson({ firstName: 'A', lastName: 'B' })
  expect(res).toEqual({ error: 'Du har ikke adgang til persondatabasen' })
  expect(mockPrisma.person.create).not.toHaveBeenCalled()
})
```

- [ ] **Step 7 (GREEN): createPerson/updatePerson.** Bekræft `canAccessModule` importeres i persons.ts (det gør det — bruges i deletePerson:272). I `createPerson` umiddelbart efter `if (!session) ...` (linje 167), og i `updatePerson` efter samme (linje 217), indsæt:

```ts
const hasModule = await canAccessModule(session.user.id, 'persons', session.user.organizationId)
if (!hasModule) return { error: 'Du har ikke adgang til persondatabasen' }
```

- [ ] **Step 8: Kør tests + typecheck + commit.**

```bash
npx vitest run src/__tests__/sensitivity-access-control.test.ts src/__tests__/permissions-hardening.test.ts && npx tsc --noEmit
git add src/actions/cases.ts src/actions/comments.ts src/actions/persons.ts src/__tests__/sensitivity-access-control.test.ts src/__tests__/permissions-hardening.test.ts
git commit -m "fix(rbac): manglende permission-checks i updateCaseStatus/createCaseComment/createComment/createPerson/updatePerson"
```

---

## Task 6: `deleted_at: null` i deletePerson pre-check (P2)

**Files:**

- Modify: `src/actions/persons.ts:302-305`
- Modify (test): `src/__tests__/permissions-hardening.test.ts` eller persons-action-test

- [ ] **Step 1 (RED): Test at allerede-soft-slettet person ikke kan slettes igen.** Mock `person.findFirst` til at modtage et WHERE med `deleted_at: null` (assert på call-args):

```ts
it('deletePerson pre-check inkluderer deleted_at: null', async () => {
  vi.mocked(perms.canAccessModule).mockResolvedValue(true)
  mockPrisma.companyPerson.count.mockResolvedValue(0)
  mockPrisma.ownership.count.mockResolvedValue(0)
  mockPrisma.person.findFirst.mockResolvedValue(null)

  await deletePerson('00000000-0000-0000-0000-000000000001')

  expect(mockPrisma.person.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ deleted_at: null }),
    })
  )
})
```

Forventet: `FAIL`.

- [ ] **Step 2 (GREEN):** Ret linje 302-305:

```ts
const person = await prisma.person.findFirst({
  where: { id: personId, organization_id: session.user.organizationId, deleted_at: null },
  select: { id: true },
})
```

- [ ] **Step 3: Kør + commit.**

```bash
npx vitest run src/__tests__/permissions-hardening.test.ts && npx tsc --noEmit
git add src/actions/persons.ts src/__tests__/permissions-hardening.test.ts
git commit -m "fix(persons): deleted_at:null i deletePerson pre-check"
```

---

## Task 7: JWT active-check — deaktiverede brugere mister adgang (P2)

**Files:**

- Modify: `src/lib/auth/index.ts:192-213` (jwt-callback)
- Modify (test): `src/__tests__/auth/` (ny test-fil `jwt-active-check.test.ts`)

I dag (linje 193-211): `if (user)`-guarden gør at DB kun læses ved første login. NextAuth kører `jwt`-callbacken på HVERT request, men `user` er kun sat ved login → en deaktiveret bruger beholder et gyldigt token i op til 8h (`maxAge`, linje 225). Fix: tilføj et DB-tjek UDEN for `if (user)`-guarden, der invaliderer tokenet (returnér token uden `id`/`organizationId`, så `session`-callbacken og downstream `auth()`-guards fejler) hvis brugeren er deaktiveret/slettet.

**ÅBEN BESLUTNING — vælg Option A (DB-check pr. request) eller Option B (kortere maxAge). Default-anbefaling: Option A med let throttling.**

> **Anbefaling: Option A.** Et DB-check pr. token-refresh lukker hullet reelt (deaktivering virker inden for sekunder). Bekymringen er én ekstra `user.findUnique` pr. request; det er en indekseret PK-opslag og acceptabelt. Option B (sænk maxAge til 1-2h) reducerer kun vinduet, lukker det ikke — vælg kun B hvis DB-last ved login-flow er en bekræftet bekymring.

### Option A (ANBEFALET) — DB-check i jwt-callback

- [ ] **Step 1 (RED): Test.** Opret `src/__tests__/auth/jwt-active-check.test.ts`. Importér jwt-callbacken (eksponér den hvis nødvendigt, ellers test via en lille refaktorering der trækker callbacken ud i en navngiven `export const jwtCallback`). Test:

```ts
it('jwt-callback nulstiller token-id når brugeren er deaktiveret', async () => {
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'u1',
    organization_id: 'org-1',
    active: false,
    deleted_at: null,
  })
  const token = await jwtCallback({
    token: { id: 'u1', organizationId: 'org-1', email: 'a@b.dk' },
    user: undefined,
    account: null,
  })
  expect(token.id).toBeUndefined()
})

it('jwt-callback bevarer token når brugeren er aktiv', async () => {
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'u1',
    organization_id: 'org-1',
    active: true,
    deleted_at: null,
  })
  const token = await jwtCallback({
    token: { id: 'u1', organizationId: 'org-1', email: 'a@b.dk' },
    user: undefined,
    account: null,
  })
  expect(token.id).toBe('u1')
})
```

Forventet: `FAIL`.

- [ ] **Step 2 (GREEN): jwt-callback.** Tilføj efter `if (user) { ... }`-blokken (efter linje 211), før `return token`:

```ts
// Revaliderér på hvert request: deaktiverede/slettede brugere mister adgang straks.
if (token.id) {
  const dbUser = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { active: true, deleted_at: true },
  })
  if (!dbUser || !dbUser.active || dbUser.deleted_at) {
    // Invalidér token — session-callback og auth()-guards fejler herefter.
    delete (token as Record<string, unknown>).id
    delete (token as Record<string, unknown>).organizationId
  }
}
```

(Refaktorér de to inline-callbacks til navngivne `export const jwtCallback`/brug i `callbacks: { jwt: jwtCallback }` så testen kan importere dem direkte. Hold `session`-callbacken som den er — den læser blot fra token.)

### Option B — Sænk maxAge

- [ ] **Step B1:** Ændr `maxAge` (linje 225) til `2 * 60 * 60` og tilføj kommentar der dokumenterer at dette er en mitigering, ikke en fuld lukning. (Ingen DB-test; surface i self-review at hullet kun reduceres.)

- [ ] **Step 3: Kør auth-test + commit.**

```bash
npx vitest run src/__tests__/auth && npx tsc --noEmit
git add src/lib/auth/index.ts src/__tests__/auth/jwt-active-check.test.ts
git commit -m "fix(auth): jwt-callback DB-check — deaktiverede brugere mister adgang (Option <A|B>)"
```

---

## Stream C exit-gate

- [ ] AI-chat: `search_contracts/companies/persons` returnerer KUN data inden for brugerens company-scope; `search_contracts` desuden inden for sensitivity (Task 1-tests grønne).
- [ ] CSV-eksport: COMPANY_READONLY kan ikke downloade STRENGT_FORTROLIG (Task 2 — Option A scope-filter ELLER Option B 403-gate bevist).
- [ ] Dokumenter: `canAccessSensitivity` håndhævet i list/delete/review/enrichment (Task 3-tests grønne).
- [ ] Alle ~19 mutation-WHERE har `organization_id` (Task 4 — cross-tenant update → 0 rows bevist).
- [ ] `updateCaseStatus`/`createCaseComment`/`createComment`/`createPerson`/`updatePerson` har deres manglende permission-lag (Task 5).
- [ ] `deletePerson` pre-check har `deleted_at: null` (Task 6).
- [ ] Deaktiveret bruger mister adgang (Task 7 — Option A DB-check ELLER B kortere maxAge).
- [ ] `npm test` + `npx tsc --noEmit` grønne; ingen `any` indført; alle nye queries har `organization_id` + `deleted_at: null` hvor relevant.

---

## Self-review-noter

- **Spec-dækning:** Dækker alle Stream C-items i roadmappen (a–g). Scope (a)/(b)/(c) er P0; (d)/(e) P1; (f) P2; (g) P2. ✅
- **Afvigelser fra auditens ordlyd (bevidste, verificerede):**
  1. `ToolContext.userId` findes allerede — Task 1 tilføjer ikke feltet, kun filtrene.
  2. `search_companies`/`search_persons` får KUN company-scope (Person/Company har intet `sensitivity`-felt i schema). Kun `search_contracts` får sensitivity-filter. Auditens "getAllowedSensitivityLevels i alle 3 tools" er forkert for to af dem.
  3. `search_persons`-scope: org-niveau-personer (uden `company_persons`) forbliver synlige — matcher `getDocumentsPageData`s `company_id: null`-undtagelse. Hvis dette IKKE er ønsket (strengere: kun personer i accessible companies), så fjern `{ company_persons: { none: {} } }`-grenen. **Flag til review.**
- **Åbne beslutninger til Philip/review:**
  - **Task 2 (eksport):** Option A (scope-respekt, kræver nyt filter-arbejde i `entities.ts` for cases/tasks/persons + `maxSensitivity→allowedSensitivity[]`) vs. Option B (gate til ALL-scope-admins, mindst kode, anbefalet). Spørgsmål: SKAL GROUP_LEGAL/FINANCE kunne eksportere deres delmængde? Hvis ja → A; ellers → B.
  - **Task 7 (JWT):** Option A (DB-check pr. request, lukker hullet, anbefalet) vs. Option B (maxAge 2h, mitigerer kun). Kræver navngivet-callback-refaktorering for testbarhed under A.
  - **Eksisterende gate-inkonsistens:** route bruger `'settings'`, action bruger `'export'` — Task 2 samler dem uanset option. Bekræft at det ikke brækker en UI-knap der allerede antager `'export'`-rollesættet.
- **Test-strategi:** Hver fix har en test der BEVISER lækagen er lukket (negativ-sti: access-denied / 0-row-WHERE), ikke kun happy-path. Følger Rule 9 (test encoder HVORFOR). Eksisterende tests udvides frem for at duplikeres (Task 1/3/5 peger på konkrete eksisterende filer).
- **Risiko:** Task 4 rører 6 filer × ~19 steder mekanisk; primær risiko er at en eksisterende action-test mocker `update` uden at returnere et objekt → tilføj `update: vi.fn().mockResolvedValue({...})` hvor de fejler. `npm test` efter Task 4 fanger regressioner.
- **Ikke-forhandlingsbare regler overholdt:** org_id+deleted_at på queries, auth() internt (aldrig parameter), 3-lag FØR data, soft-delete bevaret, Zod uændret, ingen `any` (kun `as Record<string,unknown>` i test-assertions, som er eksisterende mønster), danske commits.

```

```
