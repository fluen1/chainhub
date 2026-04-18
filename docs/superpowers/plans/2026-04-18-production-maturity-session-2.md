# ChainHub — Produktions-modenhed session 2: schema-modenhed + audit-udvidelse + silent-catch retrofit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lukke ChainHubs to centrale schema-huller (Contract↔Document, Company-hierarki), gøre AuditLog systematisk brugbar, og retrofitte 32 silent-catch-blocks med Sentry-capture.

**Architecture:** Prisma `db push` for schema-ændringer (ingen migration-fil pga. Supabase pooler shadow-DB-issue). Ny `recordAuditEvent()`-helper i `src/lib/audit.ts` der standardiserer alle AuditLog-skriv. `captureError()`-kald tilføjes til hver catch uden at ændre action-signatur.

**Tech Stack:** Prisma 5, PostgreSQL (Supabase), Pino, Sentry, existing `withActionLogging` + `captureError` helpers.

---

## Kontekst

Session 1 (2026-04-18) etablerede observability-foundation: Pino logger, Sentry-integration, withActionLogging wrapper, error boundaries, Prettier/Husky, README. Produktions-modenhed 6/10 → 8/10.

Session 2 lukker de resterende datamodel- og observability-huller:

1. **`Document` mangler `contract_id`** — blokerer DocumentExtraction-data på persons (flagged i memory). Tilføj nullable felt + relation.
2. **`Company` mangler `parent_company_id`** — holding-hierarki er implicit via Ownership-graf. Tilføj self-relation for effektive roll-ups.
3. **`AuditLog` bruges sporadisk** — kun 5 callsites (kontrakter + ownership). Mangler audit for Case-status, Ownership-updates, CompanyPerson-role-skift. Tilføj `recordAuditEvent()`-helper + 3 nye wire-ins.
4. **32 silent-catch-blocks** — alle `catch {}` der sluger fejl. Retrofit med `captureError()` så Sentry ser dem.

Ikke i scope (→ session 3): E2E Playwright, test-coverage op på 80%, a11y-sweep.

---

## File Structure

**Nye filer:**

- `src/lib/audit.ts` — `recordAuditEvent()` helper der skriver til AuditLog med strukturerede felter
- `src/__tests__/audit.test.ts` — unit tests for helper
- `docs/superpowers/plans/2026-04-18-production-maturity-session-2.md` — kopi af denne plan (Task 0 kopierer plan hertil)

**Ændrede filer:**

- `prisma/schema.prisma` — Document (tilføj `contract_id`), Company (tilføj `parent_company_id` + self-relation), Contract (tilføj `documents` reverse-relation)
- `prisma/seed.ts` — backfill `parent_company_id` på 6 klinikker til Holding-selskabet
- `src/actions/cases.ts` — tilføj audit på `updateCaseStatus`, captureError på 2 catches
- `src/actions/ownership.ts` — tilføj audit på `updateOwnership`, captureError på 3 catches
- `src/actions/governance.ts` — tilføj audit på `endCompanyPerson`, captureError på 2 catches
- `src/actions/contracts.ts` — captureError på 4 catches (audit findes allerede på status)
- `src/actions/contract-versions.ts` — captureError på 1 catch
- `src/actions/finance.ts` — captureError på 2 catches
- `src/actions/persons.ts` — captureError på 4 catches
- `src/actions/companies.ts` — captureError på 4 catches
- `src/actions/tasks.ts` — captureError på 5 catches
- `src/actions/users.ts` — captureError på 3 catches (1 har console.error, skal skiftes til captureError)
- `src/actions/visits.ts` — captureError på 2 catches

---

## Task 0: Kopiér plan til docs

**Files:**

- Create: `docs/superpowers/plans/2026-04-18-production-maturity-session-2.md`

- [ ] **Step 1: Kopiér plan-filen**

```bash
mkdir -p docs/superpowers/plans
cp ~/.claude/plans/jeg-t-nker-vi-skal-elegant-marble.md docs/superpowers/plans/2026-04-18-production-maturity-session-2.md
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-04-18-production-maturity-session-2.md
git commit -m "docs(plan): session 2 production maturity — schema + audit + retrofit"
```

---

## Task 1: Schema — Document.contract_id

**Files:**

- Modify: `prisma/schema.prisma` (Document-model linje 751-777, Contract-model linje 455)

- [ ] **Step 1: Tilføj contract_id-felt på Document**

I `prisma/schema.prisma` linje 754 (efter `case_id`), tilføj:

```prisma
model Document {
  id              String           @id @default(uuid())
  organization_id String
  company_id      String?
  case_id         String?
  contract_id     String?
  title           String
  // ... resten uændret ...
  organization Organization        @relation(fields: [organization_id], references: [id])
  company      Company?            @relation(fields: [company_id], references: [id])
  case         Case?               @relation(fields: [case_id], references: [id])
  contract     Contract?           @relation(fields: [contract_id], references: [id])
  extraction   DocumentExtraction?

  @@index([organization_id, deleted_at])
  @@index([organization_id, company_id, deleted_at])
  @@index([organization_id, contract_id])
}
```

- [ ] **Step 2: Tilføj reverse-relation på Contract**

I Contract-modellen (omkring linje 493, i relations-sektionen) tilføj:

```prisma
  documents Document[]
```

- [ ] **Step 3: Push schema til DB**

```bash
npx prisma db push --skip-generate
```

Forventet: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Regenerér client**

Hvis Next.js dev-server kører, stop den først. Så:

```bash
rm -f node_modules/.prisma/client/query_engine-windows.dll.node*
npx prisma generate
```

- [ ] **Step 5: TypeScript-check**

```bash
npx tsc --noEmit
```

Forventet: 0 fejl.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add Document.contract_id relation

Lukker Contract↔Document-gap flagged i arkitektur-review. Nu kan en
kontrakt linke til det Document den blev uploadet fra, og dermed
nå DocumentExtraction-data (AI-udlæste løn, opsigelsesvarsel m.fl.).

Nullable — eksisterende dokumenter uden kontrakt-tilknytning er uberørt.
Indeks på (organization_id, contract_id) til effektiv \"find documents
for contract\"-lookup."
```

---

## Task 2: Schema — Company.parent_company_id

**Files:**

- Modify: `prisma/schema.prisma` (Company-model linje 357-387)

- [ ] **Step 1: Tilføj parent_company_id + self-relation**

I `prisma/schema.prisma` Company-modellen, tilføj efter `status`-felt (omkring linje 370):

```prisma
model Company {
  id                String    @id @default(uuid())
  organization_id   String
  name              String
  cvr               String?
  company_type      String?
  address           String?
  city              String?
  postal_code       String?
  latitude          Float?
  longitude         Float?
  founded_date      DateTime?
  status            String    @default("aktiv")
  parent_company_id String?
  notes             String?
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  created_by        String
  deleted_at        DateTime?

  organization    Organization    @relation(fields: [organization_id], references: [id])
  parent_company  Company?        @relation("CompanyHierarchy", fields: [parent_company_id], references: [id])
  subsidiaries    Company[]       @relation("CompanyHierarchy")
  ownerships      Ownership[]
  company_persons CompanyPerson[]
  contracts       Contract[]
  cases           CaseCompany[]
  documents       Document[]
  visits          Visit[]
  insights_cache  CompanyInsightsCache?

  @@index([organization_id, deleted_at])
  @@index([organization_id, status])
  @@index([organization_id, parent_company_id])
}
```

- [ ] **Step 2: Push schema**

```bash
npx prisma db push --skip-generate
```

- [ ] **Step 3: Regenerér client**

```bash
rm -f node_modules/.prisma/client/query_engine-windows.dll.node*
npx prisma generate
```

- [ ] **Step 4: TypeScript-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add Company.parent_company_id self-relation

Lukker implicit-hierarki-gap flagged i arkitektur-review. Holding-
selskaber kan nu linke deres datterselskaber eksplicit via
parent_company_id, og roll-up-queries (\"alle datterselskaber\")
bliver effektive i stedet for at kræve traversal af Ownership-grafen.

Nullable — eksisterende selskaber er uberørt indtil backfill (Task 3)."
```

---

## Task 3: Seed backfill — parent_company_id på klinikker

**Files:**

- Modify: `prisma/seed.ts` (companyData-array, omkring linje 95-103)

- [ ] **Step 1: Læs nuværende seed.ts struktur**

Åbn `prisma/seed.ts` og find `companyData`-array. Holding-selskabet har `id: uid(1000)` (TandlægeGruppen Holding ApS). De 6 klinikker er uid(1001) til uid(1006).

- [ ] **Step 2: Tilføj parent_company_id på klinikker**

I `companyData`-array, tilføj `parent_company_id: uid(1000)` på alle 6 klinik-entries (uid(1001) til uid(1006)). Holding-selskabet (uid(1000)) har IKKE `parent_company_id` sat.

Eksempel:

```typescript
{ id: uid(1001), name: 'Tandlæge Østerbro ApS', cvr: '87654321', company_type: 'ApS', address: 'Østerbrogade 123', city: 'København Ø', postal_code: '2100', status: 'aktiv', parent_company_id: uid(1000), latitude: 55.7065, longitude: 12.5773 },
```

Gentag for uid(1002), uid(1003), uid(1004), uid(1005), uid(1006).

- [ ] **Step 3: Kør seed**

```bash
npx prisma db seed
```

Forventet: "Seed completed successfully" (eller lignende).

- [ ] **Step 4: Verificér i DB**

```bash
cat <<'EOF' > verify-parent.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const holding = await prisma.company.findFirst({
  where: { name: { contains: 'Holding' } },
  include: { subsidiaries: { select: { name: true } } },
})
console.log('Holding:', holding?.name)
console.log('Subsidiaries:', holding?.subsidiaries.map(s => s.name))
await prisma.$disconnect()
EOF
node verify-parent.mjs && rm -f verify-parent.mjs
```

Forventet: Holding vises med 6 subsidiaries (alle 6 klinikker).

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): backfill parent_company_id for 6 klinikker

Demonstrerer kæde-struktur: TandlægeGruppen Holding ApS (uid 1000) er
parent for de 6 kliniker (uid 1001-1006). Giver seed-data til at teste
roll-up-queries på /companies og fremtidige hierarki-UI."
```

---

## Task 4: Audit-helper (`src/lib/audit.ts`)

**Files:**

- Create: `src/lib/audit.ts`
- Create: `src/__tests__/audit.test.ts`

- [ ] **Step 1: Skriv failing test**

Opret `src/__tests__/audit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordAuditEvent } from '@/lib/audit'

vi.mock('@/lib/db', () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    },
  },
}))

describe('recordAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes audit entry with required fields', async () => {
    const { prisma } = await import('@/lib/db')
    await recordAuditEvent({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'UPDATE',
      resourceType: 'contract',
      resourceId: 'contract-1',
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'user-1',
        action: 'UPDATE',
        resource_type: 'contract',
        resource_id: 'contract-1',
      }),
    })
  })

  it('includes sensitivity when provided', async () => {
    const { prisma } = await import('@/lib/db')
    await recordAuditEvent({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'CREATE',
      resourceType: 'contract',
      resourceId: 'contract-1',
      sensitivity: 'FORTROLIG',
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sensitivity: 'FORTROLIG' }),
    })
  })

  it('includes changes JSON when provided', async () => {
    const { prisma } = await import('@/lib/db')
    await recordAuditEvent({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'UPDATE',
      resourceType: 'case',
      resourceId: 'case-1',
      changes: { oldStatus: 'NY', newStatus: 'AKTIV' },
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: { oldStatus: 'NY', newStatus: 'AKTIV' },
      }),
    })
  })

  it('swallows DB errors silently (logs via captureError, does not throw)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.auditLog.create).mockRejectedValueOnce(new Error('DB down'))
    await expect(
      recordAuditEvent({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'CREATE',
        resourceType: 'task',
        resourceId: 'task-1',
      })
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Kør test — verificér fail**

```bash
npx vitest run src/__tests__/audit.test.ts
```

Forventet: FAIL med `Cannot find module '@/lib/audit'`.

- [ ] **Step 3: Implementér `src/lib/audit.ts`**

Opret `src/lib/audit.ts`:

```typescript
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import type { SensitivityLevel } from '@prisma/client'

export interface AuditEventInput {
  organizationId: string
  userId: string
  action: string
  resourceType: string
  resourceId: string
  sensitivity?: SensitivityLevel
  changes?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Skriv en AuditLog-entry. Fejl her må ALDRIG blokere den primære
 * operation — logges til Sentry og fortsætter. Brug i enhver action
 * der laver state-ændring på følsomme entiteter (Contract, Case,
 * Ownership, CompanyPerson m.fl.).
 *
 * @example
 * await recordAuditEvent({
 *   organizationId: session.user.organizationId,
 *   userId: session.user.id,
 *   action: 'UPDATE',
 *   resourceType: 'case',
 *   resourceId: caseId,
 *   changes: { oldStatus: 'NY', newStatus: 'AKTIV' },
 * })
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organization_id: input.organizationId,
        user_id: input.userId,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId,
        sensitivity: input.sensitivity,
        changes: input.changes as never,
        ip_address: input.ipAddress,
      },
    })
  } catch (err) {
    captureError(err, {
      namespace: 'audit',
      extra: {
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    })
  }
}
```

- [ ] **Step 4: Kør test — verificér pass**

```bash
npx vitest run src/__tests__/audit.test.ts
```

Forventet: 4 tests passed.

- [ ] **Step 5: TypeScript-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit.ts src/__tests__/audit.test.ts
git commit -m "feat(audit): add recordAuditEvent helper

Standardiserer AuditLog-skriv på tværs af actions. Bruges til
state-ændringer på følsomme entiteter (Contract, Case, Ownership,
CompanyPerson). Helper sluger DB-fejl stille og logger via
captureError — audit-skriv må ALDRIG blokere den primære operation.

4 unit tests: required fields, sensitivity, changes JSON,
error-swallow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Audit wire-in — Case.status

**Files:**

- Modify: `src/actions/cases.ts` (updateCaseStatus, linje 105-136)

- [ ] **Step 1: Læs eksisterende updateCaseStatus**

```bash
grep -n "updateCaseStatus" src/actions/cases.ts
```

Identificér linje 123 hvor `prisma.case.update` sker, og linje 134 hvor catch returnerer fejl.

- [ ] **Step 2: Tilføj recordAuditEvent efter update**

I `src/actions/cases.ts` efter `prisma.case.update(...)` men før `revalidatePath`:

```typescript
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/logger'

// ... inde i updateCaseStatus ...

const existing = await prisma.case.findFirst({
  where: {
    id: parsed.data.caseId,
    organization_id: session.user.organizationId,
    deleted_at: null,
  },
  select: { status: true, sensitivity: true },
})
if (!existing) return { error: 'Sag ikke fundet' }
if (existing.status === parsed.data.status) {
  return { data: null as never } // no-op
}

try {
  const updated = await prisma.case.update({
    where: { id: parsed.data.caseId },
    data: {
      status: parsed.data.status,
      closed_at:
        parsed.data.status === 'LUKKET' || parsed.data.status === 'ARKIVERET' ? new Date() : null,
    },
  })

  await recordAuditEvent({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: 'STATUS_CHANGE',
    resourceType: 'case',
    resourceId: updated.id,
    sensitivity: existing.sensitivity,
    changes: { oldStatus: existing.status, newStatus: parsed.data.status },
  })

  revalidatePath('/cases')
  revalidatePath(`/cases/${updated.id}`)
  return { data: updated }
} catch (err) {
  captureError(err, {
    namespace: 'action:updateCaseStatus',
    extra: { caseId: parsed.data.caseId },
  })
  return { error: 'Status kunne ikke opdateres — prøv igen' }
}
```

(Detaljeret diff afhænger af eksisterende struktur — de to relevante tilføjelser er: `recordAuditEvent()`-kald og `captureError()` i catch.)

- [ ] **Step 3: TypeScript-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/cases.ts
git commit -m "feat(audit): log case status changes + captureError on failures

updateCaseStatus skriver nu AuditLog-entry med oldStatus/newStatus for
alle case-status-ændringer. Case-sensitivity cascades til audit-entry.
Catch retrofittet med captureError så DB-fejl sendes til Sentry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Audit wire-in — Ownership.update

**Files:**

- Modify: `src/actions/ownership.ts` (updateOwnership, linje 100-120)

- [ ] **Step 1: Tilføj recordAuditEvent i updateOwnership**

Pattern identisk til Task 5. Læs før-værdier af ownership_pct, effective_date, contract_id; efter update, kald `recordAuditEvent` med `action: 'UPDATE'`, `resourceType: 'ownership'`, `sensitivity: 'STRENGT_FORTROLIG'`, og `changes` med diff af ændrede felter.

Eksempel `changes`-struktur:

```typescript
changes: {
  oldOwnershipPct: Number(existing.ownership_pct),
  newOwnershipPct: Number(updated.ownership_pct),
  oldEffectiveDate: existing.effective_date?.toISOString() ?? null,
  newEffectiveDate: updated.effective_date?.toISOString() ?? null,
}
```

Pas på: Prisma `Decimal` skal konverteres til `Number` før JSON-serialisering.

- [ ] **Step 2: Retrofit 3 catches i samme fil**

`addOwner` (linje 78), `updateOwnership` (linje 118), `endOwnership` (linje 161). Alle tre får:

```typescript
} catch (err) {
  captureError(err, {
    namespace: 'action:<navn>',
    extra: { /* relevant kontekst */ },
  })
  return { error: '<eksisterende besked>' }
}
```

- [ ] **Step 3: TypeScript-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/ownership.ts
git commit -m "feat(audit): log ownership updates + retrofit 3 catches

updateOwnership skriver nu AuditLog for alle ownership_pct/effective_date/
contract_id-ændringer med STRENGT_FORTROLIG sensitivity. Alle 3 catches
i filen (addOwner, updateOwnership, endOwnership) retrofittet med
captureError.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Audit wire-in — CompanyPerson (HR-skift)

**Files:**

- Modify: `src/actions/governance.ts` (addCompanyPerson linje 65+, endCompanyPerson linje 90+)

- [ ] **Step 1: Tilføj recordAuditEvent på begge actions**

`addCompanyPerson`: audit med `action: 'CREATE'`, `resourceType: 'company_person'`, `changes: { personId, companyId, role, startDate }`.

`endCompanyPerson`: audit med `action: 'END'`, `resourceType: 'company_person'`, `changes: { personId, companyId, endDate }`. Især vigtigt for direktør-roller (check `role` — hvis inkluderer 'DIRECT' eller 'CEO' brug sensitivity INTERN).

- [ ] **Step 2: Retrofit 2 catches i filen**

`addCompanyPerson` (linje 80), `endCompanyPerson` (linje 114). Samme pattern.

- [ ] **Step 3: TypeScript-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/governance.ts
git commit -m "feat(audit): log CompanyPerson add/end + retrofit 2 catches

HR-skift (tilknytning + afregistrering af personer på selskaber)
er nu fuldt audit-sporet. Særligt relevant for direktør-rolle-skift
pga. governance-forpligtelser.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Silent-catch retrofit — contracts.ts

**Files:**

- Modify: `src/actions/contracts.ts` (linjer 98, 161, 196, 250)

- [ ] **Step 1: Tilføj captureError-import**

Top af filen:

```typescript
import { captureError } from '@/lib/logger'
```

- [ ] **Step 2: Retrofit 4 catches**

Hver af de 4 catches (linje 98, 161, 196, 250) ændres fra:

```typescript
} catch {
  return { error: '...' }
}
```

til:

```typescript
} catch (err) {
  captureError(err, {
    namespace: 'action:<funktionsnavn>',
    extra: { /* 1-2 relevante kontekst-felter som input IDs */ },
  })
  return { error: '...' }
}
```

Eksempel for `createContract` (linje 98):

```typescript
} catch (err) {
  captureError(err, {
    namespace: 'action:createContract',
    extra: { companyId: parsed.data.companyId, systemType: parsed.data.systemType },
  })
  return { error: 'Kontrakten kunne ikke oprettes — prøv igen' }
}
```

- [ ] **Step 3: TypeScript-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/contracts.ts
git commit -m "chore(logging): retrofit 4 silent catches in contracts.ts

captureError sender nu alle DB-fejl i createContract/updateContractStatus/
deleteContract/getContractList til Sentry med action-namespace + input-
context. Ingen adfærdsændring for brugeren — kun synlighed for udviklere."
```

---

## Task 9: Silent-catch retrofit — tasks.ts

**Files:**

- Modify: `src/actions/tasks.ts` (linjer 53, 101, 146, 207, 256)

- [ ] **Step 1: Import + retrofit 5 catches**

Samme pattern som Task 8. Funktioner: `createTask`, `updateTaskStatus`, `updateTaskPriority`, `updateTaskAssignee`, `updateTaskDueDate`.

Eksempel for `updateTaskStatus` (linje 101):

```typescript
} catch (err) {
  captureError(err, {
    namespace: 'action:updateTaskStatus',
    extra: { taskId: parsed.data.taskId, newStatus: parsed.data.status },
  })
  return { error: 'Status kunne ikke opdateres' }
}
```

- [ ] **Step 2: TypeScript-check + commit**

```bash
npx tsc --noEmit
git add src/actions/tasks.ts
git commit -m "chore(logging): retrofit 5 silent catches in tasks.ts"
```

---

## Task 10: Silent-catch retrofit — resten (9 filer)

**Files:**

- Modify: `src/actions/persons.ts` (4 catches: linjer 54, 91, 139, 170)
- Modify: `src/actions/companies.ts` (4 catches: linjer 88, 130, 154, 203)
- Modify: `src/actions/cases.ts` (1 resterende catch: linje 96 — linje 134 blev fixet i Task 5)
- Modify: `src/actions/users.ts` (3 catches: linjer 41, 104, 227 + erstat console.error på linje 166 med captureError)
- Modify: `src/actions/visits.ts` (2 catches: linjer 62, 101)
- Modify: `src/actions/finance.ts` (2 catches: linjer 68, 117)
- Modify: `src/actions/contract-versions.ts` (1 catch: linje 91)

- [ ] **Step 1-7: Per fil — import + retrofit**

Gå én fil ad gangen. For hver fil:

1. Tilføj `import { captureError } from '@/lib/logger'` hvis ikke allerede til stede
2. Ændr hver `catch {` til `catch (err)` + tilføj `captureError(err, { namespace: 'action:<navn>', extra: { ... } })` før return
3. TypeScript-check efter hver fil

Batch-commit for effektivitet — én commit pr. fil ELLER én commit for alle 7 filer hvis man er tryg.

- [ ] **Step 8: TypeScript-check efter alle retrofits**

```bash
npx tsc --noEmit
```

Forventet: 0 fejl.

- [ ] **Step 9: Commit (samlet eller split)**

Samlet-variant:

```bash
git add src/actions/persons.ts src/actions/companies.ts src/actions/cases.ts src/actions/users.ts src/actions/visits.ts src/actions/finance.ts src/actions/contract-versions.ts
git commit -m "chore(logging): retrofit 17 silent catches across 7 action files

Fuldfører silent-catch-retrofit sweep der startede i contracts.ts (Task 8)
og tasks.ts (Task 9). Total: 32 catches migreret fra silent til Sentry-
synlige via captureError-kald med action-namespace og kontekst-felter.

users.ts:166 havde console.error — erstattet med captureError for
konsistens.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Verifikation + Playwright smoke

**Files:** Ingen ændringer — verificerer de foregående tasks holder sammen.

- [ ] **Step 1: Full verification gate**

```bash
npm run format:check      # Prettier clean
npm run lint              # ESLint 0 warnings
npx tsc --noEmit          # 0 TS-fejl
npm test                  # 390+ tests grønne
rm -rf .next && npx next build   # Grøn build
```

Forventet: alle gates grønne. Tests mindst 394 nu (4 nye audit-tests).

- [ ] **Step 2: Start dev-server**

```bash
rm -rf .next
npm run dev
```

- [ ] **Step 3: Playwright smoke — audit trail**

Login philip@chainhub.dk / password123. Verificér:

1. Navigér til `/cases/<seed-case-id>` og ændr status (fx NY → AKTIV)
2. Åbn en SQL-klient og query:

   ```sql
   SELECT action, resource_type, changes, created_at
   FROM "AuditLog"
   WHERE resource_type = 'case'
   ORDER BY created_at DESC LIMIT 1;
   ```

   Forventet: nyeste entry har `action: 'STATUS_CHANGE'` og `changes: { oldStatus: 'NY', newStatus: 'AKTIV' }`.

3. Triggér en captureError ved midlertidig throw i fx `updateTaskStatus`: `throw new Error('test')`. Refresh en task-side og forsøg status-ændring. Verificér:
   - Toast viser dansk fejlbesked
   - Terminal viser Pino `ERROR` med namespace og stack
   - (Hvis Sentry DSN er sat i `.env.local`) Sentry-event kommer frem

4. Rul throw tilbage og verificér normal flow virker igen.

- [ ] **Step 4: Commit verifikations-note i PROGRESS.md**

Opdater `docs/status/PROGRESS.md` "Udskudte features"-sektion — fjern DocumentExtraction-udsættelse (nu muligt via Document.contract_id). Tilføj nyt afsnit "Produktions-modenhed session 2 — 2026-04-18".

- [ ] **Step 5: Final commit**

```bash
git add docs/status/PROGRESS.md
git commit -m "docs(status): session 2 schema+audit+retrofit complete

Session 2 af produktions-modenhed leveret: Document.contract_id,
Company.parent_company_id, recordAuditEvent helper, audit wire-in
på Case/Ownership/CompanyPerson, 32 silent-catches retrofittet
med captureError.

DocumentExtraction-på-persons-feature er nu teknisk muliggjort
(Contract→Document-relation til stede) og kan planlægges som egen
feature-session.

Produktions-modenhed: 8/10 → ~9/10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Kritiske filer (quick reference)

**Schema-ændringer:**

- `prisma/schema.prisma` — Document model linje 751-777, Company model linje 357-387, Contract-relation omkring linje 493
- `prisma/seed.ts` — companyData-array linje 95-103

**Nye filer:**

- `src/lib/audit.ts` — recordAuditEvent helper
- `src/__tests__/audit.test.ts` — 4 unit tests

**Audit wire-ins:**

- `src/actions/cases.ts` — updateCaseStatus (linje 123)
- `src/actions/ownership.ts` — updateOwnership (linje 105)
- `src/actions/governance.ts` — addCompanyPerson, endCompanyPerson (linje 65-110)

**Silent-catch retrofits (32 sites):**

- `src/actions/contracts.ts` (4), `tasks.ts` (5), `persons.ts` (4), `companies.ts` (4), `cases.ts` (1), `users.ts` (3 + 1 replace), `visits.ts` (2), `finance.ts` (2), `contract-versions.ts` (1), `ownership.ts` (3 — dækket i Task 6), `governance.ts` (2 — dækket i Task 7)

**Genbrug (ingen ændring):**

- `src/lib/logger.ts` — `captureError` + `createLogger`
- `src/lib/action-helpers.ts` — `withActionLogging` (ikke brugt i session 2, men tilgængelig til nye actions)
- `src/types/actions.ts` — `ActionResult<T>`

---

## Verification

**Teknisk gate (grøn før commits):**

```bash
npm run format:check                             # Prettier clean
npm run lint                                     # ESLint 0 warnings
npx tsc --noEmit                                 # 0 TS-fejl
npx prisma validate                              # Schema valid
npm test                                         # 394+ passed (4 nye audit-tests)
rm -rf .next && npx next build                   # Grøn, 35 routes
```

**Runtime-gate (Playwright):**

1. `/cases/<id>` → ændr status → verificér AuditLog-entry i DB med oldStatus/newStatus
2. Ownership-ændring på `/companies/<id>` → verificér AuditLog-entry med STRENGT_FORTROLIG
3. HR-skift (endCompanyPerson) → verificér AuditLog-entry
4. Midlertidig `throw new Error('test')` i updateTaskStatus → verificér Sentry-event + Pino-log + dansk toast til bruger
5. Query: `SELECT COUNT(*) FROM "AuditLog" GROUP BY action;` viser mindst STATUS_CHANGE, CREATE, UPDATE, END

**Commit-gate:**

- 11 tasks = 11-12 commits (Task 10 kan være split eller samlet)
- Hver commit står selvstændig kompilerbar
- Dansk commit-beskeder i `[type]: beskrivelse` format
- Husky pre-commit kører Prettier + ESLint (fra session 1) — verificér at den ikke afviser

**Acceptance:**

- ✅ `Document.contract_id` eksisterer og virker (kan linke dokumenter til kontrakter)
- ✅ `Company.parent_company_id` eksisterer og backfillet for 6 seed-klinikker
- ✅ `recordAuditEvent()` helper med 4 grønne unit-tests
- ✅ AuditLog skrives nu ved Case-status, Ownership-update, CompanyPerson-add/end (6 nye wire-ins)
- ✅ Alle 32 identificerede silent-catches har captureError
- ✅ Tests: 394+ passed, 0 failed
- ✅ Build: grøn
- ✅ Playwright verificerer audit-trail virker end-to-end

**Ikke-mål (må ikke snige sig ind):**

- DocumentExtraction-UI på persons (egen feature-session — nu muliggjort teknisk)
- TaskParticipant (watchers) — fortsat udskudt
- CompanyNote med sensitivity — egen feature-session
- E2E Playwright test-suite i CI (→ session 3)
- Test-dækning op på 80% (→ session 3)
- Accessibility-sweep (→ session 3)
