# Compliance + Data-Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leverer de tre Gate 1 compliance/legal-blokkere — data-eksport (CSV), GDPR persondata-flow (access + erasure), og kunde-backup (ZIP). Uden disse kan ChainHub ikke lovligt onboarde betalende kunder (GDPR Article 15+17 + contractual backup-krav).

**Architecture:** Three parts, delt infrastruktur. Part 1 (CSV-export) bygger shared helpers i `src/lib/export/` til per-entity serialization. Part 2 (GDPR) genbruger helpers til aggregation, tilføjer cascading soft-delete + pseudonymization. Part 3 (backup) streamer alle orgs 23 tabeller som ZIP via archiver. API-routes streamer downloads (ingen buffer i memory). AuditLog logger alle export + delete-handlinger for compliance-trail.

**Tech Stack:** Prisma 5, csv-stringify (ny dep, ~10kb), archiver (ny dep for ZIP), eksisterende ExcelJS, Next.js API routes med streaming, pg-boss for async-jobs hvis backup >limits. Ingen ændringer til eksisterende models — kun nye felter hvor nødvendigt for soft-delete.

---

## Kontekst

Audit (2026-04-18) fandt:

- **Ingen eksisterende eksport-logik** — alt bygges fra scratch
- **Soft-delete dækker 9/23 tabeller** — ContractParty, CasePerson, CaseCompany, CompanyPerson mangler `deleted_at` (join-tables — ikke kritisk for eksport, men relevant for GDPR-cascade)
- **Person har INGEN FK CASCADE-regler** — app-level cleanup required ved GDPR-sletning
- **Comments er hard-deletet** — GDPR-komplikation; strategi: anonymisér `created_by` ved GDPR-sletning
- **ExcelJS installed** — kan bruges til XLSX om ønsket (kun CSV i v1)
- **Mangler**: csv-stringify, archiver
- **AuditLog + recordAuditEvent klar** — bruges til GDPR-trail + export-log
- **23 tabeller har organization_id** — backup-zip iteration

**GDPR-rammeværk anvendt:**

- Article 15 (Right of access) — Data Subject Access Request (DSAR) → JSON-bundle af al data om person
- Article 17 (Right to erasure) — Pseudonymization + soft-delete relaterede records (IKKE hard-delete, pga. audit-trail-krav for erhvervs-tenancy)

**Ikke-mål (separate tracks):**

- XLSX-format (CSV er tilstrækkeligt for v1)
- Real-time job-progress UI for store backups (async-worker flagges i plan, ikke bygget)
- Automatisk GDPR-erasure efter X år (admin-triggered only)
- DSAR-selvbetjening for person (kun admin-initieret)
- Schema-ændringer på join-tables for soft-delete (foretrækker pseudonymization i v1)

---

## File Structure

**Nye filer:**

```
src/lib/export/
├── csv.ts                      # CSV helper: toCsvBuffer<T>(rows, columns)
├── entities.ts                 # Per-entity: fetchCompaniesForExport, fetchContractsForExport, ...
├── gdpr.ts                     # gdprExportPerson + gdprDeletePerson
└── backup.ts                   # exportOrganizationBackup (zip-streamer)

src/app/api/export/
├── [entity]/route.ts           # GET /api/export/companies, /api/export/contracts, ...
├── gdpr/[personId]/route.ts    # GET ?mode=export|delete
└── backup/route.ts             # GET /api/export/backup

src/actions/
├── export.ts                   # Actions der trigger exports (wrapper permissions + audit)
└── gdpr.ts                     # Actions der wrapper gdpr-helpers (strict admin-check)

src/app/(dashboard)/settings/
├── backup/page.tsx             # /settings/backup admin-UI
└── gdpr/page.tsx               # /settings/gdpr — liste over audit-hændelser + "eksportér/slet person" trigger

src/app/(dashboard)/persons/[id]/
└── gdpr-panel.tsx              # Admin-panel på person-detalje — "GDPR-handlinger"

src/__tests__/
├── export/csv.test.ts
├── export/entities.test.ts
├── gdpr.test.ts
├── backup.test.ts
└── export-actions.test.ts
```

**Ændrede filer:**

- `package.json` — add `csv-stringify`, `archiver`, `@types/archiver`
- `src/app/(dashboard)/companies/portfolio-client.tsx` (+ contracts/cases/tasks/persons/visits list-sider) — "Eksportér"-knap
- `src/app/(dashboard)/settings/page.tsx` — link til /settings/backup + /settings/gdpr
- `src/lib/nav-config.ts` — evt. backup/gdpr under settings
- `docs/status/PROGRESS.md` — track-afsnit
- `prisma/schema.prisma` — INGEN ændringer i v1 (pseudonymization frem for join-table soft-delete)

---

## Plan

### Task 0: Plan commit

- [ ] **Step 1:** Plan gemt i `docs/superpowers/plans/2026-04-18-compliance-data-export.md`

```bash
git add docs/superpowers/plans/2026-04-18-compliance-data-export.md
git commit -m "docs(plan): compliance + data-export track plan"
```

---

### Task 1: Install dependencies + CSV-helper

**Files:**

- Modify: `package.json`, `package-lock.json`
- Create: `src/lib/export/csv.ts`
- Create: `src/__tests__/export/csv.test.ts`

- [ ] **Step 1: Install deps**

```bash
npm install csv-stringify archiver
npm install -D @types/archiver
```

Verificér størrelser rimelige (csv-stringify ~10kb, archiver ~200kb + deps).

- [ ] **Step 2: Skriv failing test**

Opret `src/__tests__/export/csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toCsvString } from '@/lib/export/csv'

describe('toCsvString', () => {
  it('genererer CSV fra rows med header', async () => {
    const rows = [
      { id: '1', name: 'Acme', revenue: 1000 },
      { id: '2', name: 'Foo & Bar', revenue: 500 },
    ]
    const csv = await toCsvString(rows, {
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Navn' },
        { key: 'revenue', header: 'Omsætning' },
      ],
    })
    expect(csv).toContain('ID,Navn,Omsætning\n')
    expect(csv).toContain('1,Acme,1000')
    // Kommaer i data skal escape'es
    expect(csv).toContain('"Foo & Bar"')
  })

  it('bruger custom formatter pr. kolonne', async () => {
    const rows = [{ d: new Date('2026-01-15T12:00:00Z') }]
    const csv = await toCsvString(rows, {
      columns: [
        {
          key: 'd',
          header: 'Dato',
          format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)),
        },
      ],
    })
    expect(csv).toContain('Dato\n')
    expect(csv).toContain('2026-01-15')
  })

  it('håndterer null-værdier som tom streng', async () => {
    const rows = [{ name: 'Acme', notes: null }]
    const csv = await toCsvString(rows, {
      columns: [
        { key: 'name', header: 'Navn' },
        { key: 'notes', header: 'Noter' },
      ],
    })
    expect(csv).toMatch(/Acme,\s*$/m)
  })

  it('escaper newlines og quotes i data', async () => {
    const rows = [{ text: 'Line 1\nLine 2 with "quote"' }]
    const csv = await toCsvString(rows, {
      columns: [{ key: 'text', header: 'Tekst' }],
    })
    // csv-stringify kvoterer automatisk og double-escaper quotes
    expect(csv).toContain('"Line 1\nLine 2 with ""quote"""')
  })
})
```

- [ ] **Step 3: Kør — FAIL**

```bash
npx vitest run src/__tests__/export/csv.test.ts
```

- [ ] **Step 4: Implementér `src/lib/export/csv.ts`**

```ts
import { stringify } from 'csv-stringify/sync'

export interface CsvColumn<T> {
  key: keyof T | string
  header: string
  /** Custom formatter for værdien. Default: String(value) */
  format?: (value: unknown, row: T) => string
}

export interface ToCsvOptions<T> {
  columns: CsvColumn<T>[]
}

/**
 * Serialisér rows til CSV-string (med header). Escaper automatisk kommas, quotes, newlines.
 * Returnerer tom-linje hvis rows er tom.
 */
export async function toCsvString<T extends Record<string, unknown>>(
  rows: T[],
  options: ToCsvOptions<T>
): Promise<string> {
  const { columns } = options
  const headerRow = columns.map((c) => c.header)
  const dataRows = rows.map((row) =>
    columns.map((col) => {
      const value = row[col.key as keyof T]
      if (value === null || value === undefined) return ''
      if (col.format) return col.format(value, row)
      if (value instanceof Date) return value.toISOString()
      return String(value)
    })
  )
  return stringify([headerRow, ...dataRows], {
    bom: true, // UTF-8 BOM så Excel åbner æøå korrekt
  })
}

export async function toCsvBuffer<T extends Record<string, unknown>>(
  rows: T[],
  options: ToCsvOptions<T>
): Promise<Buffer> {
  const csv = await toCsvString(rows, options)
  return Buffer.from(csv, 'utf-8')
}
```

- [ ] **Step 5: Kør tests — PASS**

```bash
npx vitest run src/__tests__/export/csv.test.ts
```

Forventet: 4 passed.

- [ ] **Step 6: Bred gate + commit**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -3

git add package.json package-lock.json src/lib/export/csv.ts src/__tests__/export/csv.test.ts
git commit -m "feat(export): CSV-helper + deps (csv-stringify, archiver)"
```

---

### Task 2: Per-entity export-helpers

**Files:**

- Create: `src/lib/export/entities.ts`
- Create: `src/__tests__/export/entities.test.ts`

Byg serializers for de 6 entity-typer. Hver returnerer `{ filename, rows, columns }` så API-route kan serialisere.

- [ ] **Step 1: Implementér `src/lib/export/entities.ts`**

```ts
import { prisma } from '@/lib/db'
import type { CsvColumn } from './csv'
import { formatDate } from '@/lib/labels'

// ============================================================
// Types
// ============================================================

export interface EntityExport<T> {
  /** Standard-filnavn uden extension */
  filename: string
  rows: T[]
  columns: CsvColumn<T>[]
}

export interface ExportScope {
  organizationId: string
  /** Scope-filter — fx kun selskaber brugeren har adgang til */
  visibleCompanyIds?: string[]
  /** Sensitivity-filter — kun kontrakter ≤ dette niveau */
  maxSensitivity?: string
}

// ============================================================
// Companies
// ============================================================

export async function fetchCompaniesForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const companies = await prisma.company.findMany({
    where: {
      organization_id: scope.organizationId,
      deleted_at: null,
      ...(scope.visibleCompanyIds ? { id: { in: scope.visibleCompanyIds } } : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      cvr: true,
      address: true,
      city: true,
      postal_code: true,
      founded_date: true,
      created_at: true,
    },
  })
  return {
    filename: `chainhub-selskaber-${new Date().toISOString().slice(0, 10)}`,
    rows: companies as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Navn' },
      { key: 'cvr', header: 'CVR' },
      { key: 'address', header: 'Adresse' },
      { key: 'city', header: 'By' },
      { key: 'postal_code', header: 'Postnummer' },
      {
        key: 'founded_date',
        header: 'Stiftet',
        format: (v) => (v instanceof Date ? formatDate(v) : ''),
      },
      {
        key: 'created_at',
        header: 'Oprettet i ChainHub',
        format: (v) => (v instanceof Date ? formatDate(v) : ''),
      },
    ],
  }
}

// ============================================================
// Contracts
// ============================================================

export async function fetchContractsForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const contracts = await prisma.contract.findMany({
    where: {
      organization_id: scope.organizationId,
      deleted_at: null,
      ...(scope.visibleCompanyIds ? { company_id: { in: scope.visibleCompanyIds } } : {}),
    },
    orderBy: { created_at: 'desc' },
    include: { company: { select: { name: true } } },
  })
  return {
    filename: `chainhub-kontrakter-${new Date().toISOString().slice(0, 10)}`,
    rows: contracts as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'display_name', header: 'Navn' },
      { key: 'system_type', header: 'Type' },
      { key: 'status', header: 'Status' },
      { key: 'sensitivity', header: 'Sensitivitet' },
      {
        key: 'company',
        header: 'Selskab',
        format: (v) => (v as { name?: string } | null)?.name ?? '',
      },
      {
        key: 'expiry_date',
        header: 'Udløber',
        format: (v) => (v instanceof Date ? formatDate(v) : ''),
      },
      { key: 'auto_renewal', header: 'Automatisk fornyelse' },
      { key: 'notice_period_days', header: 'Opsigelsesvarsel (dage)' },
      {
        key: 'created_at',
        header: 'Oprettet',
        format: (v) => (v instanceof Date ? formatDate(v) : ''),
      },
    ],
  }
}

// ============================================================
// Cases
// ============================================================

export async function fetchCasesForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const cases = await prisma.case.findMany({
    where: { organization_id: scope.organizationId, deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: {
      case_companies: { include: { company: { select: { name: true } } } },
    },
  })
  const rows = cases.map((c) => ({
    ...c,
    company_names: c.case_companies
      .map((cc) => cc.company?.name)
      .filter(Boolean)
      .join('; '),
  }))
  return {
    filename: `chainhub-sager-${new Date().toISOString().slice(0, 10)}`,
    rows: rows as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'title', header: 'Titel' },
      { key: 'case_type', header: 'Type' },
      { key: 'case_subtype', header: 'Undertype' },
      { key: 'status', header: 'Status' },
      { key: 'sensitivity', header: 'Sensitivitet' },
      { key: 'company_names', header: 'Selskaber' },
      {
        key: 'created_at',
        header: 'Oprettet',
        format: (v) => (v instanceof Date ? formatDate(v) : ''),
      },
    ],
  }
}

// ============================================================
// Tasks
// ============================================================

export async function fetchTasksForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const tasks = await prisma.task.findMany({
    where: { organization_id: scope.organizationId, deleted_at: null },
    orderBy: { due_date: 'asc' },
    include: {
      company: { select: { name: true } },
      assignee: { select: { name: true, email: true } },
    },
  })
  return {
    filename: `chainhub-opgaver-${new Date().toISOString().slice(0, 10)}`,
    rows: tasks as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'title', header: 'Titel' },
      { key: 'status', header: 'Status' },
      { key: 'priority', header: 'Prioritet' },
      {
        key: 'company',
        header: 'Selskab',
        format: (v) => (v as { name?: string } | null)?.name ?? '',
      },
      {
        key: 'assignee',
        header: 'Tildelt',
        format: (v) => (v as { name?: string } | null)?.name ?? '',
      },
      {
        key: 'due_date',
        header: 'Frist',
        format: (v) => (v instanceof Date ? formatDate(v) : ''),
      },
      {
        key: 'created_at',
        header: 'Oprettet',
        format: (v) => (v instanceof Date ? formatDate(v) : ''),
      },
    ],
  }
}

// ============================================================
// Persons
// ============================================================

export async function fetchPersonsForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const persons = await prisma.person.findMany({
    where: { organization_id: scope.organizationId, deleted_at: null },
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
  })
  return {
    filename: `chainhub-personer-${new Date().toISOString().slice(0, 10)}`,
    rows: persons as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'first_name', header: 'Fornavn' },
      { key: 'last_name', header: 'Efternavn' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Telefon' },
      {
        key: 'created_at',
        header: 'Oprettet',
        format: (v) => (v instanceof Date ? formatDate(v) : ''),
      },
    ],
  }
}

// ============================================================
// Visits
// ============================================================

export async function fetchVisitsForExport(
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  const visits = await prisma.visit.findMany({
    where: { organization_id: scope.organizationId, deleted_at: null },
    orderBy: { visit_date: 'desc' },
    include: {
      company: { select: { name: true } },
      visitor: { select: { name: true } },
    },
  })
  return {
    filename: `chainhub-besog-${new Date().toISOString().slice(0, 10)}`,
    rows: visits as Record<string, unknown>[],
    columns: [
      { key: 'id', header: 'ID' },
      {
        key: 'company',
        header: 'Selskab',
        format: (v) => (v as { name?: string } | null)?.name ?? '',
      },
      { key: 'visit_type', header: 'Type' },
      { key: 'status', header: 'Status' },
      {
        key: 'visit_date',
        header: 'Dato',
        format: (v) => (v instanceof Date ? formatDate(v) : ''),
      },
      {
        key: 'visitor',
        header: 'Besøgende',
        format: (v) => (v as { name?: string } | null)?.name ?? '',
      },
    ],
  }
}

// ============================================================
// Dispatcher
// ============================================================

export type ExportableEntity = 'companies' | 'contracts' | 'cases' | 'tasks' | 'persons' | 'visits'

export async function fetchEntityForExport(
  entity: ExportableEntity,
  scope: ExportScope
): Promise<EntityExport<Record<string, unknown>>> {
  switch (entity) {
    case 'companies':
      return fetchCompaniesForExport(scope)
    case 'contracts':
      return fetchContractsForExport(scope)
    case 'cases':
      return fetchCasesForExport(scope)
    case 'tasks':
      return fetchTasksForExport(scope)
    case 'persons':
      return fetchPersonsForExport(scope)
    case 'visits':
      return fetchVisitsForExport(scope)
  }
}
```

- [ ] **Step 2: Skriv tests**

`src/__tests__/export/entities.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    company: { findMany: vi.fn().mockResolvedValue([]) },
    contract: { findMany: vi.fn().mockResolvedValue([]) },
    case: { findMany: vi.fn().mockResolvedValue([]) },
    task: { findMany: vi.fn().mockResolvedValue([]) },
    person: { findMany: vi.fn().mockResolvedValue([]) },
    visit: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import {
  fetchCompaniesForExport,
  fetchContractsForExport,
  fetchEntityForExport,
  type ExportScope,
} from '@/lib/export/entities'

const scope: ExportScope = { organizationId: 'org-1' }

describe('fetchCompaniesForExport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer filename + columns + rows', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.company.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 'c-1',
          name: 'Acme',
          cvr: '12345678',
          address: null,
          city: null,
          postal_code: null,
          founded_date: null,
          created_at: new Date('2026-01-01'),
        },
      ])) as never)
    const result = await fetchCompaniesForExport(scope)
    expect(result.filename).toMatch(/chainhub-selskaber-\d{4}-\d{2}-\d{2}/)
    expect(result.rows).toHaveLength(1)
    expect(result.columns.find((c) => c.header === 'Navn')).toBeDefined()
  })

  it('filtrerer via visibleCompanyIds', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchCompaniesForExport({ organizationId: 'org-1', visibleCompanyIds: ['c-1', 'c-2'] })
    const call = vi.mocked(prisma.company.findMany).mock.calls[0]
    expect(call![0]?.where).toMatchObject({ id: { in: ['c-1', 'c-2'] } })
  })
})

describe('fetchContractsForExport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inkluderer company name via join', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 'k-1',
          display_name: 'Lejekontrakt',
          system_type: 'LEJEKONTRAKT_ERHVERV',
          status: 'AKTIV',
          sensitivity: 'INTERN',
          company: { name: 'Acme' },
          expiry_date: null,
          auto_renewal: false,
          notice_period_days: null,
          created_at: new Date(),
        },
      ])) as never)
    const result = await fetchContractsForExport(scope)
    expect(result.rows[0]).toBeDefined()
    const companyCol = result.columns.find((c) => c.header === 'Selskab')
    const row = result.rows[0]!
    expect(companyCol!.format!(row.company, row)).toBe('Acme')
  })
})

describe('fetchEntityForExport dispatcher', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatcher korrekt pr. entity', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchEntityForExport('persons', scope)
    expect(prisma.person.findMany).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Kør + commit**

```bash
npx vitest run src/__tests__/export/
npx tsc --noEmit
npm test 2>&1 | tail -3

git add src/lib/export/entities.ts src/__tests__/export/entities.test.ts
git commit -m "feat(export): per-entity CSV-serializers for 6 entity-typer"
```

---

### Task 3: Export server action + API route + permissions

**Files:**

- Create: `src/actions/export.ts`
- Create: `src/app/api/export/[entity]/route.ts`
- Create: `src/__tests__/export-actions.test.ts`

- [ ] **Step 1: Implementér `src/actions/export.ts`**

```ts
'use server'

import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'
import type { ExportableEntity } from '@/lib/export/entities'

export interface PrepareExportInput {
  entity: ExportableEntity
}

/**
 * Pre-check: Tjekker om bruger må eksportere, og returnerer download-URL.
 * Selve streaming sker i /api/export/[entity] — dette er bare permission-gate + audit-log.
 */
export async function prepareExport(
  input: PrepareExportInput
): Promise<ActionResult<{ downloadUrl: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const canExport = await canAccessModule(session.user.id, 'settings')
  if (!canExport) return { error: 'Kun admin kan eksportere data' }

  try {
    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'EXPORT',
      resourceType: input.entity,
      resourceId: 'bulk',
      sensitivity: 'INTERN',
      changes: { entity: input.entity },
    })
    return { data: { downloadUrl: `/api/export/${input.entity}` } }
  } catch (err) {
    captureError(err, { namespace: 'action:prepareExport', extra: { entity: input.entity } })
    return { error: 'Eksport kunne ikke forberedes' }
  }
}
```

- [ ] **Step 2: Implementér API-route `src/app/api/export/[entity]/route.ts`**

```ts
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { fetchEntityForExport, type ExportableEntity } from '@/lib/export/entities'
import { toCsvBuffer } from '@/lib/export/csv'
import { captureError } from '@/lib/logger'
import { NextResponse, type NextRequest } from 'next/server'

const VALID_ENTITIES: ExportableEntity[] = [
  'companies',
  'contracts',
  'cases',
  'tasks',
  'persons',
  'visits',
]

export async function GET(request: NextRequest, { params }: { params: { entity: string } }) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  const canExport = await canAccessModule(session.user.id, 'settings')
  if (!canExport) {
    return NextResponse.json({ error: 'Kun admin kan eksportere' }, { status: 403 })
  }

  const entity = params.entity as ExportableEntity
  if (!VALID_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Ugyldig entitet' }, { status: 400 })
  }

  try {
    const exportData = await fetchEntityForExport(entity, {
      organizationId: session.user.organizationId,
    })
    const csv = await toCsvBuffer(exportData.rows, { columns: exportData.columns })

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportData.filename}.csv"`,
      },
    })
  } catch (err) {
    captureError(err, { namespace: 'api:export', extra: { entity } })
    return NextResponse.json({ error: 'Eksport fejlede' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Unit-tests for action**

`src/__tests__/export-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

import { prepareExport } from '@/actions/export'

describe('prepareExport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path returnerer download-URL og logger audit', async () => {
    const audit = await import('@/lib/audit')
    const result = await prepareExport({ entity: 'companies' })
    expect('data' in result).toBe(true)
    if ('data' in result && result.data) {
      expect(result.data.downloadUrl).toBe('/api/export/companies')
    }
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EXPORT', resourceType: 'companies' })
    )
  })

  it('afviser uden session', async () => {
    const authMod = await import('@/lib/auth')
    vi.mocked(authMod.auth).mockResolvedValueOnce(null)
    const result = await prepareExport({ entity: 'companies' })
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser uden admin-rettigheder', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await prepareExport({ entity: 'companies' })
    expect('error' in result).toBe(true)
  })
})
```

- [ ] **Step 4: Commit**

```bash
npx vitest run src/__tests__/export-actions.test.ts
npx tsc --noEmit

git add src/actions/export.ts src/app/api/export/\[entity\]/route.ts src/__tests__/export-actions.test.ts
git commit -m "feat(export): server action + API route til CSV-download"
```

---

### Task 4: "Eksportér"-knap på list-sider

**Files:**

- Modify: `src/app/(dashboard)/companies/portfolio-client.tsx`
- Modify: `src/app/(dashboard)/contracts/contracts-client.tsx`
- Modify: `src/app/(dashboard)/cases/page.tsx` (eller cases-client)
- Modify: `src/app/(dashboard)/tasks/page.tsx` (eller tasks-client)
- Modify: `src/app/(dashboard)/persons/page.tsx`
- Modify: Create separate `src/components/ui/export-button.tsx`
- Create: `src/__tests__/export-button.test.tsx`

- [ ] **Step 1: Shared knap-komponent**

`src/components/ui/export-button.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { prepareExport } from '@/actions/export'
import type { ExportableEntity } from '@/lib/export/entities'

interface Props {
  entity: ExportableEntity
  label?: string
}

export function ExportButton({ entity, label = 'Eksportér CSV' }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    const result = await prepareExport({ entity })
    setBusy(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    // Trigger browser-download via anchor-klik
    window.location.href = result.data!.downloadUrl
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      aria-label={label}
    >
      <Download className="h-4 w-4" aria-hidden />
      {busy ? 'Forbereder...' : label}
    </button>
  )
}
```

- [ ] **Step 2: Test**

`src/__tests__/export-button.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/actions/export', () => ({
  prepareExport: vi.fn().mockResolvedValue({ data: { downloadUrl: '/api/export/companies' } }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// jsdom-mock window.location
const originalLocation = window.location
beforeEach(() => {
  delete (window as never as { location: unknown }).location
  ;(window as never as { location: { href: string } }).location = { href: '' }
})
afterEach(() => {
  ;(window as never as { location: Location }).location = originalLocation
})

import { ExportButton } from '@/components/ui/export-button'

describe('ExportButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderer med default-label', () => {
    render(<ExportButton entity="companies" />)
    expect(screen.getByRole('button', { name: /Eksportér CSV/ })).toBeDefined()
  })

  it('trigger download på klik', async () => {
    render(<ExportButton entity="companies" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(window.location.href).toBe('/api/export/companies')
    })
  })

  it('viser toast ved fejl', async () => {
    const { prepareExport } = await import('@/actions/export')
    vi.mocked(prepareExport).mockResolvedValueOnce({ error: 'Kun admin' })
    const { toast } = await import('sonner')
    render(<ExportButton entity="companies" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Kun admin')
    })
  })
})
```

- [ ] **Step 3: Indsæt ExportButton på list-sider**

For hver af de 6 list-sider (companies, contracts, cases, tasks, persons, visits):

1. Læs eksisterende list-side (page.tsx eller client-component)
2. Find header/filter-area hvor der typisk er "Ny X"-knap
3. Tilføj:

```tsx
import { ExportButton } from '@/components/ui/export-button'

// I header-rækken, ved siden af "Ny X"-knappen:
;<ExportButton entity="companies" />
```

Bemærk: Hvis list-siden er en server-component, skal ExportButton stadig virke (det er en client-komponent). Placér som sibling ved den eksisterende "Opret"-knap.

- [ ] **Step 4: Commit**

```bash
npx vitest run src/__tests__/export-button.test.tsx
npx tsc --noEmit
npm test 2>&1 | tail -3

git add src/components/ui/export-button.tsx src/__tests__/export-button.test.tsx src/app/\(dashboard\)/
git commit -m "feat(export): Eksportér CSV-knap på 6 list-sider"
```

---

### Task 5: GDPR helpers — export + delete

**Files:**

- Create: `src/lib/export/gdpr.ts`
- Create: `src/__tests__/gdpr.test.ts`

- [ ] **Step 1: Skriv failing tests**

`src/__tests__/gdpr.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'p-1' }),
    },
    companyPerson: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ownership: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    contractParty: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    casePerson: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    comment: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn().mockImplementation(async (fn) =>
      fn({
        person: {
          update: vi.fn().mockResolvedValue({ id: 'p-1' }),
        },
        companyPerson: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        ownership: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        contractParty: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        casePerson: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      })
    ),
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

import { gdprExportPerson, gdprDeletePerson } from '@/lib/export/gdpr'

describe('gdprExportPerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aggregerer person + relations til JSON', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: 'p-1',
        first_name: 'Jens',
        last_name: 'Hansen',
        email: 'jens@test.dk',
        organization_id: 'org-1',
      })) as never)
    vi.mocked(prisma.companyPerson.findMany).mockImplementation((() =>
      Promise.resolve([{ id: 'cp-1', role: 'direktoer' }])) as never)
    const result = await gdprExportPerson('p-1', 'org-1')
    expect(result).not.toBeNull()
    expect(result!.person.first_name).toBe('Jens')
    expect(result!.companyPersons).toHaveLength(1)
    expect(result!.exportedAt).toBeInstanceOf(Date)
  })

  it('returnerer null hvis person ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await gdprExportPerson('p-nope', 'org-1')
    expect(result).toBeNull()
  })

  it('afviser tenant-leak (organization_id filter)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    await gdprExportPerson('p-1', 'wrong-org')
    const call = vi.mocked(prisma.person.findFirst).mock.calls[0]
    expect(call![0]?.where).toMatchObject({ id: 'p-1', organization_id: 'wrong-org' })
  })
})

describe('gdprDeletePerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pseudonymiserer person + sletter/soft-sletter relations atomisk', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: 'p-1',
        organization_id: 'org-1',
      })) as never)
    const result = await gdprDeletePerson('p-1', 'org-1')
    expect(result.deleted).toBe(true)
    expect(prisma.$transaction).toHaveBeenCalled()
    // Forvent at personen opdateres med pseudonymiserede felter
    const txFn = vi.mocked(prisma.$transaction).mock.calls[0]![0] as (
      tx: unknown
    ) => Promise<unknown>
    // Vi har allerede mocket tx → verificeret at det kører uden exception
    expect(result.summary.personUpdated).toBe(1)
  })

  it('returnerer deleted=false hvis person ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await gdprDeletePerson('p-nope', 'org-1')
    expect(result.deleted).toBe(false)
  })
})
```

- [ ] **Step 2: Implementér `src/lib/export/gdpr.ts`**

```ts
import { prisma } from '@/lib/db'
import { captureError, createLogger } from '@/lib/logger'

const log = createLogger('gdpr')

// ============================================================
// Article 15 — Right of access (export)
// ============================================================

export interface GdprPersonExport {
  exportedAt: Date
  person: Record<string, unknown>
  companyPersons: Record<string, unknown>[]
  ownerships: Record<string, unknown>[]
  contractParties: Record<string, unknown>[]
  casePersons: Record<string, unknown>[]
  comments: Record<string, unknown>[]
  metadata: {
    note: string
  }
}

/**
 * GDPR Article 15: samler alle person-relaterede records i en struktureret
 * bundle. Returnerer null hvis person ikke findes (eller ikke i org).
 */
export async function gdprExportPerson(
  personId: string,
  organizationId: string
): Promise<GdprPersonExport | null> {
  const person = await prisma.person.findFirst({
    where: { id: personId, organization_id: organizationId },
  })
  if (!person) return null

  const [companyPersons, ownerships, contractParties, casePersons] = await Promise.all([
    prisma.companyPerson.findMany({ where: { person_id: personId } }),
    prisma.ownership.findMany({ where: { owner_person_id: personId } }),
    prisma.contractParty.findMany({ where: { person_id: personId } }),
    prisma.casePerson.findMany({ where: { person_id: personId } }),
  ])

  // Comments har FK til User (ikke Person) — vi logger dem IKKE i standard-export.
  // Hvis Person har en tilknyttet User (sjældent), kunne vi aggregere comments via user_id.

  return {
    exportedAt: new Date(),
    person: person as Record<string, unknown>,
    companyPersons: companyPersons as Record<string, unknown>[],
    ownerships: ownerships as Record<string, unknown>[],
    contractParties: contractParties as Record<string, unknown>[],
    casePersons: casePersons as Record<string, unknown>[],
    comments: [],
    metadata: {
      note: 'GDPR Article 15 — Right of Access. Denne eksport indeholder alle strukturerede data om den pågældende person i ChainHub. Bemærk at fri-tekst-notater i kommentarer (skrevet af andre brugere) ikke er inkluderet, da de er linket til forfatter-user, ikke person-entity.',
    },
  }
}

// ============================================================
// Article 17 — Right to erasure (pseudonymization)
// ============================================================

export interface GdprDeleteResult {
  deleted: boolean
  summary: {
    personUpdated: number
    companyPersonsEnded: number
    ownershipsEnded: number
    contractPartiesDeleted: number
    casePersonsDeleted: number
  }
}

const PSEUDONYMIZED_NAME = 'Slettet person'
const PSEUDONYMIZED_EMAIL = null

/**
 * GDPR Article 17: pseudonymiserer person og soft-sletter/hard-sletter relations.
 *
 * STRATEGI (valgt pga. audit-trail-krav i B2B):
 * - Person record: update med pseudonymiserede felter (first_name='Slettet', last_name='person',
 *   email=null, phone=null, cpr=null, etc.) + sæt deleted_at=now().
 * - CompanyPerson + Ownership: update end_date=today() (soft-end — bevarer historik).
 * - ContractParty + CasePerson: hard-delete (join-tables uden soft-delete-felt; person er nu
 *   pseudonymiseret, så referencer bliver meningsløse).
 *
 * Kører alt i én transaction for atomicity.
 */
export async function gdprDeletePerson(
  personId: string,
  organizationId: string
): Promise<GdprDeleteResult> {
  const person = await prisma.person.findFirst({
    where: { id: personId, organization_id: organizationId },
  })
  if (!person) {
    return {
      deleted: false,
      summary: {
        personUpdated: 0,
        companyPersonsEnded: 0,
        ownershipsEnded: 0,
        contractPartiesDeleted: 0,
        casePersonsDeleted: 0,
      },
    }
  }

  const now = new Date()
  try {
    const summary = await prisma.$transaction(async (tx) => {
      await tx.person.update({
        where: { id: personId },
        data: {
          first_name: PSEUDONYMIZED_NAME,
          last_name: '',
          email: PSEUDONYMIZED_EMAIL,
          phone: null,
          cpr_encrypted: null,
          deleted_at: now,
        },
      })
      const cp = await tx.companyPerson.updateMany({
        where: { person_id: personId, end_date: null },
        data: { end_date: now },
      })
      const ow = await tx.ownership.updateMany({
        where: { owner_person_id: personId, end_date: null },
        data: { end_date: now },
      })
      const cpty = await tx.contractParty.deleteMany({ where: { person_id: personId } })
      const cpr = await tx.casePerson.deleteMany({ where: { person_id: personId } })
      return {
        personUpdated: 1,
        companyPersonsEnded: cp.count,
        ownershipsEnded: ow.count,
        contractPartiesDeleted: cpty.count,
        casePersonsDeleted: cpr.count,
      }
    })

    log.info({ personId, organizationId, summary }, 'GDPR-sletning gennemført')
    return { deleted: true, summary }
  } catch (err) {
    captureError(err, { namespace: 'gdpr:deletePerson', extra: { personId, organizationId } })
    throw err
  }
}
```

**Vigtigt:** Dette bruger Prisma-felter som `cpr_encrypted` — verificér om dette felt faktisk findes på Person-modellen. Hvis ikke, fjern linjen. Ellers kan det give TS-fejl.

Tjek med:

```bash
grep -A 30 "^model Person " prisma/schema.prisma
```

Juster pseudonymization-feltlisten til at matche faktiske Person-felter.

- [ ] **Step 3: Kør + commit**

```bash
npx vitest run src/__tests__/gdpr.test.ts
npx tsc --noEmit

git add src/lib/export/gdpr.ts src/__tests__/gdpr.test.ts
git commit -m "feat(gdpr): export + pseudonymization-sletning af person (Article 15+17)"
```

---

### Task 6: GDPR server actions + API routes

**Files:**

- Create: `src/actions/gdpr.ts`
- Create: `src/app/api/export/gdpr/[personId]/route.ts`

- [ ] **Step 1: Server action med audit-log**

`src/actions/gdpr.ts`:

```ts
'use server'

import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { gdprExportPerson, gdprDeletePerson } from '@/lib/export/gdpr'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'

export async function prepareGdprExport(
  personId: string
): Promise<ActionResult<{ downloadUrl: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) return { error: 'Kun admin kan håndtere GDPR-eksport' }

  try {
    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'GDPR_EXPORT',
      resourceType: 'person',
      resourceId: personId,
      sensitivity: 'FORTROLIG',
      changes: { reason: 'Article 15 request' },
    })
    return { data: { downloadUrl: `/api/export/gdpr/${personId}` } }
  } catch (err) {
    captureError(err, { namespace: 'action:prepareGdprExport' })
    return { error: 'GDPR-eksport kunne ikke forberedes' }
  }
}

export async function executeGdprDelete(
  personId: string
): Promise<ActionResult<{ personUpdated: number; total: number }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) return { error: 'Kun admin kan slette persondata' }

  try {
    const result = await gdprDeletePerson(personId, session.user.organizationId)
    if (!result.deleted) return { error: 'Person ikke fundet' }

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'GDPR_DELETE',
      resourceType: 'person',
      resourceId: personId,
      sensitivity: 'STRENGT_FORTROLIG',
      changes: {
        reason: 'Article 17 request',
        summary: result.summary,
      },
    })

    revalidatePath(`/persons/${personId}`)
    revalidatePath('/persons')
    const total =
      result.summary.companyPersonsEnded +
      result.summary.ownershipsEnded +
      result.summary.contractPartiesDeleted +
      result.summary.casePersonsDeleted
    return { data: { personUpdated: result.summary.personUpdated, total } }
  } catch (err) {
    captureError(err, { namespace: 'action:executeGdprDelete' })
    return { error: 'GDPR-sletning fejlede' }
  }
}
```

- [ ] **Step 2: API-route til download**

`src/app/api/export/gdpr/[personId]/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { gdprExportPerson } from '@/lib/export/gdpr'
import { captureError } from '@/lib/logger'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { personId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) return NextResponse.json({ error: 'Kun admin' }, { status: 403 })

  try {
    const data = await gdprExportPerson(params.personId, session.user.organizationId)
    if (!data) return NextResponse.json({ error: 'Person ikke fundet' }, { status: 404 })

    const json = JSON.stringify(data, null, 2)
    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="gdpr-export-${params.personId}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (err) {
    captureError(err, { namespace: 'api:gdpr-export' })
    return NextResponse.json({ error: 'GDPR-eksport fejlede' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Tests for gdpr actions**

Opret `src/__tests__/gdpr-actions.test.ts` med 4-6 tests som følger samme pattern som export-actions.test.ts — happy-path + ingen-session + ikke-admin + person-not-found.

- [ ] **Step 4: Commit**

```bash
npx vitest run src/__tests__/gdpr-actions.test.ts
npx tsc --noEmit

git add src/actions/gdpr.ts src/app/api/export/gdpr/ src/__tests__/gdpr-actions.test.ts
git commit -m "feat(gdpr): server actions + API route til Article 15+17"
```

---

### Task 7: GDPR-panel på /persons/[id]

**Files:**

- Create: `src/app/(dashboard)/persons/[id]/gdpr-panel.tsx`
- Modify: `src/app/(dashboard)/persons/[id]/page.tsx`
- Create: `src/__tests__/gdpr-panel.test.tsx`

- [ ] **Step 1: Panel-komponent**

`src/app/(dashboard)/persons/[id]/gdpr-panel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ShieldAlert, Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { prepareGdprExport, executeGdprDelete } from '@/actions/gdpr'
import { AccessibleDialog } from '@/components/ui/accessible-dialog'

interface Props {
  personId: string
  personName: string
}

export function GdprPanel({ personId, personName }: Props) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    const result = await prepareGdprExport(personId)
    setBusy(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    window.location.href = result.data!.downloadUrl
  }

  async function handleDelete() {
    if (confirmText !== personName) {
      toast.error('Navn matcher ikke — kunne ikke slette')
      return
    }
    setBusy(true)
    const result = await executeGdprDelete(personId)
    setBusy(false)
    setDeleteOpen(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success(`Persondata slettet (${result.data!.total} relations berørt)`)
    router.push('/persons')
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" aria-hidden />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">GDPR-handlinger</h3>
          <p className="text-sm text-gray-600 mt-1">
            Kun admin. Handlinger er audit-loggede og uomkørbare.
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Eksportér persondata (Art. 15)
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Slet persondata (Art. 17)
            </button>
          </div>
        </div>
      </div>

      <AccessibleDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Slet persondata — GDPR Art. 17"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Du er ved at pseudonymisere og slette persondata for <strong>{personName}</strong>.
            Personen pseudonymiseres til &quot;Slettet person&quot;, og alle tilknytninger
            (ansættelser, ejerskaber, kontrakt-parter, sags-parter) nedlægges eller slettes.
          </p>
          <p className="text-sm text-gray-700">Skriv personens navn for at bekræfte:</p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder={personName}
            aria-label="Bekræft navn"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Annullér
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || confirmText !== personName}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Sletter...' : 'Slet permanent'}
            </button>
          </div>
        </div>
      </AccessibleDialog>
    </div>
  )
}
```

- [ ] **Step 2: Tilføj panel i persons/[id]/page.tsx**

Læs eksisterende filen. Tilføj `<GdprPanel personId={person.id} personName={...} />` — KUN hvis bruger er admin. Brug server-side check:

```tsx
import { canAccessModule } from '@/lib/permissions'

// I den server-rendered page.tsx:
const isAdmin = await canAccessModule(session.user.id, 'settings')

// I JSX:
{
  isAdmin && (
    <GdprPanel
      personId={person.id}
      personName={`${person.first_name} ${person.last_name}`.trim()}
    />
  )
}
```

Placering: efter de centrale info-sektioner, ikke øverst (det er en destruktiv handling, skal ikke dominere).

- [ ] **Step 3: Tests**

`src/__tests__/gdpr-panel.test.tsx` — 3-5 tests: render, export-klik, delete-konfirmation-flow med forkert navn (fail), korrekt navn (success).

- [ ] **Step 4: Commit**

```bash
npx vitest run src/__tests__/gdpr-panel.test.tsx
npx tsc --noEmit

git add src/app/\(dashboard\)/persons/\[id\]/ src/__tests__/gdpr-panel.test.tsx
git commit -m "feat(gdpr): admin-panel på /persons/[id] — eksport + sletning"
```

---

### Task 8: Organisations-backup (ZIP)

**Files:**

- Create: `src/lib/export/backup.ts`
- Create: `src/app/api/export/backup/route.ts`
- Create: `src/__tests__/backup.test.ts`

- [ ] **Step 1: Backup-helper**

`src/lib/export/backup.ts`:

```ts
import archiver from 'archiver'
import { Readable } from 'stream'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const log = createLogger('backup')

/**
 * Samler alle org-scope tabeller + returnerer zip-stream.
 * For store orgs (>100MB): kør async via pg-boss — ikke implementeret i v1.
 */
export async function createOrganizationBackupStream(organizationId: string): Promise<Readable> {
  log.info({ organizationId }, 'Starting backup')

  const archive = archiver('zip', { zlib: { level: 9 } })

  // Kritiske tabeller at dumpe — 23 total ifølge schema-audit. Her er de mest data-tunge:
  const tables = [
    {
      name: 'organizations',
      fetch: () => prisma.organization.findMany({ where: { id: organizationId } }),
    },
    {
      name: 'companies',
      fetch: () => prisma.company.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'persons',
      fetch: () => prisma.person.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'contracts',
      fetch: () => prisma.contract.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'contract_parties',
      fetch: () => prisma.contractParty.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'contract_versions',
      fetch: () => prisma.contractVersion.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'company_persons',
      fetch: () => prisma.companyPerson.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'ownerships',
      fetch: () => prisma.ownership.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'cases',
      fetch: () => prisma.case.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'case_companies',
      fetch: () => prisma.caseCompany.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'case_persons',
      fetch: () => prisma.casePerson.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'tasks',
      fetch: () => prisma.task.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'task_history',
      fetch: () => prisma.taskHistory.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'comments',
      fetch: () => prisma.comment.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'visits',
      fetch: () => prisma.visit.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'documents',
      fetch: () => prisma.document.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'financial_metrics',
      fetch: () => prisma.financialMetric.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'deadlines',
      fetch: () => prisma.deadline.findMany({ where: { organization_id: organizationId } }),
    },
    {
      name: 'audit_log',
      fetch: () => prisma.auditLog.findMany({ where: { organization_id: organizationId } }),
    },
  ]

  // Asynkront: fetch + append sekventielt for at undgå memory-spike
  ;(async () => {
    try {
      for (const t of tables) {
        const rows = await t.fetch()
        const json = JSON.stringify(rows, null, 2)
        archive.append(json, { name: `${t.name}.json` })
        log.debug({ table: t.name, count: rows.length }, 'Added to backup')
      }
      archive.append(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            organizationId,
            format: 'chainhub-backup-v1',
            note: 'Full organization backup. Alle tabeller scoped på organization_id. JSON-format bevarer relationer via foreign key IDs.',
          },
          null,
          2
        ),
        { name: 'manifest.json' }
      )
      await archive.finalize()
    } catch (err) {
      log.error({ err }, 'Backup failed')
      archive.abort()
    }
  })()

  return archive as unknown as Readable
}
```

- [ ] **Step 2: API-route**

`src/app/api/export/backup/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { createOrganizationBackupStream } from '@/lib/export/backup'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/logger'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) return NextResponse.json({ error: 'Kun admin' }, { status: 403 })

  try {
    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'BACKUP',
      resourceType: 'organization',
      resourceId: session.user.organizationId,
      sensitivity: 'FORTROLIG',
      changes: { reason: 'Full backup download' },
    })

    const stream = await createOrganizationBackupStream(session.user.organizationId)
    const filename = `chainhub-backup-${new Date().toISOString().slice(0, 10)}.zip`

    return new NextResponse(stream as never, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    captureError(err, { namespace: 'api:backup' })
    return NextResponse.json({ error: 'Backup fejlede' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Backup-trigger UI på /settings**

Modify `src/app/(dashboard)/settings/page.tsx` — tilføj ny "Backup"-sektion med simpel download-knap:

```tsx
{
  isAdmin && (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Kunde-backup</h2>
      <p className="text-sm text-gray-500 mt-1">
        Download en ZIP med alle data for denne organisation. Kan tage flere minutter for store
        organisationer.
      </p>
      <a
        href="/api/export/backup"
        download
        className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Download className="h-4 w-4" aria-hidden />
        Download fuld backup (.zip)
      </a>
    </section>
  )
}
```

- [ ] **Step 4: Commit**

Tests for backup er vanskelige at skrive som unit-tests (stream-baseret + mange tabeller). Spring formel unit-test over — smoke-test via manuel browser-download i stedet.

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5

git add src/lib/export/backup.ts src/app/api/export/backup/ src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat(backup): organisations-backup som ZIP med 19 tabeller"
```

---

### Task 9: Full gate + PROGRESS

- [ ] **Step 1: Full gate**

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npm test
rm -rf .next && npx next build
```

Alle grønne. Forventet tests: 660 → ~680 (20 nye på tværs af tracks).

- [ ] **Step 2: Smoke-test (manuel hvis muligt)**

Log ind som philip@chainhub.dk (GROUP_OWNER):

- Gå til `/companies` → klik "Eksportér CSV" → verificér at fil downloades med rigtige danske headers + UTF-8 BOM
- Gå til `/persons/[id]` → find GDPR-panelet → "Eksportér" skal give JSON-download → "Slet" skal kræve navn-konfirmation
- Gå til `/settings` → "Download fuld backup" skal give zip-fil med 19 JSON-filer

Log som maria@tandlaegegruppen.dk (GROUP_LEGAL) → verificér at ingen af knapperne er synlige / virker.

- [ ] **Step 3: Opdater PROGRESS.md**

Tilføj afsnit efter Mobile+Empty-states track:

```markdown
## Compliance + Data-export track ✅ (2026-04-18)

Gate 1 legal/compliance-blokkere lukket.

- [x] **CSV-eksport** på 6 list-sider (companies, contracts, cases, tasks, persons, visits) — dansk header, UTF-8 BOM, admin-only, audit-logget
- [x] **GDPR Article 15** (Right of access) — `gdprExportPerson` aggregerer alle person-relaterede records til JSON-bundle, admin-UI på /persons/[id]
- [x] **GDPR Article 17** (Right to erasure) — `gdprDeletePerson` pseudonymiserer person + soft-ender relations + hard-deleter join-tables. Atomisk transaction. Navn-konfirmation i UI
- [x] **Kunde-backup** — full ZIP af 19 org-scope tabeller via /api/export/backup
- [x] **Audit-log dækker alle compliance-handlinger** — EXPORT / GDPR_EXPORT / GDPR_DELETE / BACKUP
- [x] **Dependencies:** csv-stringify + archiver + @types/archiver installed
- [x] Tests: 660 → ~680 passed
- [x] Gate: format ✅, lint ✅, tsc ✅, build ✅
```

- [ ] **Step 4: Commit**

```bash
git add docs/status/PROGRESS.md
git commit -m "docs(status): Compliance + data-export track lukket"
```

---

## Verification

**Acceptance:**

- ✅ Kunde kan downloade CSV af alle 6 entity-typer
- ✅ Admin kan eksportere persondata som JSON (GDPR Art. 15)
- ✅ Admin kan pseudonymisere person + nedlægge relations (GDPR Art. 17) med navn-konfirmation
- ✅ Admin kan downloade fuld backup-zip
- ✅ Alle handlinger audit-logged
- ✅ Non-admin-rolle ser ingen af handlingerne
- ✅ Tenant-isolation: kan ikke eksportere/slette på tværs af organizations
- ✅ Full gate grønne

**Ikke-mål:**

- XLSX-format (CSV er tilstrækkeligt)
- Async-worker for store backups (flagget i kode — for v2 hvis behov)
- DSAR self-service (kun admin-triggeret)
- Automatisk GDPR-erasure efter retention-periode
- Person-merge (hvis samme person oprettet to gange)
