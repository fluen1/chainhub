# ChainHub — Coverage uplift session: unit tests for 11 action-filer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skrive unit-tests for de 11 manglende action-filer så test-coverage stiger fra ~50% til ~80%+ på actions-laget. Mock-baserede tests (ingen DB-afhængighed) så CI kører hurtigt og deterministisk.

**Architecture:** Pure mock-baseret pattern fra session 3 (lessons learned: `mockImplementation((() => Promise.resolve(X)) as never)` for type-kompatibilitet med Prisma-typer, mock `@/lib/audit` + `@/lib/logger` + `next/cache`, valide UUIDs `a1b2c3d4-e5f6-4789-9abc-def012345678`-format).

**Tech Stack:** Vitest + vi.mock + bcrypt (for users.ts hash assertions), eksisterende mock-patterns.

---

## Kontekst

Session 3 leverede E2E + CI + 4 action-test-filer (calendar, finance, governance, persons). Tests: 394 → 428 passed.

Tilbage er **11 action-filer uden tests** — alle CRUD-tunge, alle med permissions-logik, mange med transactions og recordAuditEvent-kald. Aktuel coverage:

- ✅ Tested: dashboard, company-detail, organizations, search, calendar, finance, governance, persons, audit
- ❌ Untested: cases, comments, contracts, contract-versions, document-review, documents, ownership, task-detail, tasks, users, visits

Hver utestet action er en regression-risiko: en udvikler kan ændre permissions-logik eller validation uden at noget fanger det. Med tests fanger CI det automatisk.

**Eksplorationsfund:**

- `users.ts:166` har `catch (err)` (ikke `catch {}`) — allerede session-2-retrofit. Skal stadig testes.
- `task-detail.ts` returnerer `null` ikke `ActionResult` — special case.
- `contracts.getContractList` har sensitivity-filter post-fetch — kompleks at mocke.
- `tasks.ts` har 6 transactions (status, priority, assignee, dueDate alle bruger `prisma.$transaction`).
- `users.ts` har 3 specielle regler: kan ikke deaktivere sig selv, kan ikke deaktivere sidste GROUP_OWNER, password skal hashes med bcrypt(12).
- `contract-versions.createContractVersion` bruger transaction til at unmarke gammel `is_current`.

**Udfald:** ~126 nye tests, alle mock-baseret. Test-suite: 428 → ~554 passed. CI fortsat under 10 min for lint-test job.

---

## File Structure

**Nye filer (11 stk):**

- `src/__tests__/cases-actions.test.ts` (~11 tests)
- `src/__tests__/comments-actions.test.ts` (~8 tests)
- `src/__tests__/contracts-actions.test.ts` (~14 tests)
- `src/__tests__/contract-versions-actions.test.ts` (~6 tests)
- `src/__tests__/document-review-actions.test.ts` (~8 tests)
- `src/__tests__/documents-actions.test.ts` (~4 tests)
- `src/__tests__/ownership-actions.test.ts` (~14 tests)
- `src/__tests__/task-detail-action.test.ts` (~5 tests)
- `src/__tests__/tasks-actions.test.ts` (~22 tests)
- `src/__tests__/users-actions.test.ts` (~16 tests)
- `src/__tests__/visits-actions.test.ts` (~9 tests)

**Ændrede filer:** Ingen action-filer ændres — kun tests.

**Genbrug:**

- Mock-pattern fra `src/__tests__/governance-actions.test.ts` (session 3)
- Mock-pattern fra `src/__tests__/persons-actions.test.ts` (session 3)
- Eksisterende `vi.mock`-stubs af `@/lib/auth`, `@/lib/db`, `@/lib/permissions`, `@/lib/audit`, `@/lib/logger`, `next/cache`

---

## Plan

### Task 0: Kopiér plan til docs

- [ ] **Step 1: Kopiér plan**

```bash
cp ~/.claude/plans/jeg-t-nker-vi-skal-elegant-marble.md docs/superpowers/plans/2026-04-18-coverage-uplift-11-actions.md
git add docs/superpowers/plans/2026-04-18-coverage-uplift-11-actions.md
git commit -m "docs(plan): coverage uplift for 11 untested action files"
```

---

### Task 1: cases-actions.test.ts

**Files:** Create `src/__tests__/cases-actions.test.ts`

- [ ] **Step 1: Skriv tests** (komplet kode)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    case: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'case-1', status: 'NY' }),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'case-1' }),
    },
    caseCompany: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createCase, updateCaseStatus, deleteCase } from '@/actions/cases'

const UUID_1 = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('createCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opretter sag', async () => {
    const result = await createCase({
      title: 'Test sag',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser uden module-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await createCase({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await createCase({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await createCase({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser tom titel', async () => {
    const result = await createCase({
      title: '',
      caseType: 'TVIST',
      companyIds: [UUID_1],
      sensitivity: 'INTERN',
    } as never)
    expect('error' in result).toBe(true)
  })
})

describe('updateCaseStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: NY → AKTIV opdaterer status og logger audit', async () => {
    const { prisma } = await import('@/lib/db')
    const audit = await import('@/lib/audit')
    vi.mocked(prisma.case.findFirst).mockImplementation((() =>
      Promise.resolve({ status: 'NY', sensitivity: 'INTERN' })) as never)
    const result = await updateCaseStatus({ caseId: UUID_1, status: 'AKTIV' } as never)
    expect('data' in result).toBe(true)
    expect(audit.recordAuditEvent).toHaveBeenCalled()
  })

  it('afviser ugyldig transition (NY → LUKKET)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() =>
      Promise.resolve({ status: 'NY', sensitivity: 'INTERN' })) as never)
    const result = await updateCaseStatus({ caseId: UUID_1, status: 'LUKKET' } as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis sag ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateCaseStatus({ caseId: UUID_1, status: 'AKTIV' } as never)
    expect('error' in result).toBe(true)
  })
})

describe('deleteCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path soft-sletter med settings-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID_1 })) as never)
    const result = await deleteCase(UUID_1)
    expect('data' in result).toBe(true)
  })

  it('afviser uden settings-modul-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await deleteCase(UUID_1)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis sag ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await deleteCase(UUID_1)
    expect('error' in result).toBe(true)
  })
})
```

- [ ] **Step 2: Kør tests + commit**

```bash
npx vitest run src/__tests__/cases-actions.test.ts
git add src/__tests__/cases-actions.test.ts
git commit -m "test(cases): unit tests for createCase + updateCaseStatus + deleteCase (11 tests)"
```

---

### Task 2: comments-actions.test.ts

Følg pattern fra Task 1. Læs `src/actions/comments.ts` for præcise signaturer. Tests:

**createComment** (5):

- Happy path: valid content + taskId → comment created
- Tom content → validation error
- Content > 2000 chars → validation error
- Task ikke fundet → error
- Revalidates `/tasks/{taskId}` path

**deleteComment** (3):

- Owner sletter own comment → success
- Non-owner forsøger → error
- Comment ikke fundet → error

- [ ] **Kør + commit**

```bash
git add src/__tests__/comments-actions.test.ts
git commit -m "test(comments): unit tests for createComment + deleteComment (8 tests)"
```

---

### Task 3: contracts-actions.test.ts

`src/actions/contracts.ts` har 4 funktioner. Følg Task 1-pattern.

**createContract** (5): happy + no company-access + no sensitivity-access + SENSITIVITY_MINIMUM violation + auditLog for FORTROLIG
**updateContractStatus** (4): valid transition + invalid transition + no sensitivity + OPSAGT sets termination_date
**deleteContract** (3): UDKAST → soft-delete + AKTIV → error + no settings-access
**getContractList** (2): pagination/sensitivity-filter + page-size cap

- [ ] **Kør + commit**

```bash
git add src/__tests__/contracts-actions.test.ts
git commit -m "test(contracts): unit tests for 4 functions (14 tests)"
```

---

### Task 4: contract-versions-actions.test.ts

`createContractVersion` bruger `prisma.$transaction`. Mock pattern:

```typescript
vi.mocked(prisma.$transaction).mockImplementation((async (fn: any) => {
  return await fn(prisma) // pass mocked prisma som tx
}) as never)
```

Tests (6):

- Happy path → version created, marked is_current
- Contract ikke fundet → error
- No company access → error
- No sensitivity access → error
- Transaction: gammel is_current=true unmarkes
- AuditLog logger changeType + versionNumber

- [ ] **Kør + commit**

```bash
git add src/__tests__/contract-versions-actions.test.ts
git commit -m "test(contract-versions): unit tests for createContractVersion (6 tests)"
```

---

### Task 5: document-review-actions.test.ts

Mock også `@/lib/ai/feedback` (`logFieldCorrection`):

```typescript
vi.mock('@/lib/ai/feedback', () => ({
  logFieldCorrection: vi.fn().mockResolvedValue({ id: 'corr-1' }),
}))
```

`approveDocumentReview` (4): valid + no access + extraction not found + document deleted
`saveFieldDecision` (4): use_ai + keep_existing + manual + no access

- [ ] **Kør + commit**

```bash
git add src/__tests__/document-review-actions.test.ts
git commit -m "test(document-review): unit tests for approve + saveFieldDecision (8 tests)"
```

---

### Task 6: documents-actions.test.ts

Kun `deleteDocument`. 4 tests:

- Doc med company_id, access granted → soft-delete
- No company access → error
- Doc ikke fundet → error
- Doc uden company_id → soft-delete uden permission-check

- [ ] **Kør + commit**

```bash
git add src/__tests__/documents-actions.test.ts
git commit -m "test(documents): unit tests for deleteDocument (4 tests)"
```

---

### Task 7: ownership-actions.test.ts

3 funktioner, alle har sensitivity-gate på STRENGT_FORTROLIG. Følg pattern fra `governance-actions.test.ts`.

**addOwner** (6): existing personId / new person via firstName+lastName / new person uden navn → error / no company-access / no sensitivity-access / audit log med ownership_pct
**updateOwnership** (5): update pct → audit logger old/new / update acquiredAt / no sensitivity / not found / audit fanger alle ændringer
**endOwnership** (3): set end_date / no sensitivity / audit action='END'

- [ ] **Kør + commit**

```bash
git add src/__tests__/ownership-actions.test.ts
git commit -m "test(ownership): unit tests for 3 functions med sensitivity-gate (14 tests)"
```

---

### Task 8: task-detail-action.test.ts

`getTaskDetailData` returnerer `TaskDetailData | null`, ikke `ActionResult`. Tests (5):

- Happy path: task findes, company access → returnerer fuld objekt
- Task ikke fundet → null
- No company access → null
- Parallel batch henter alle 5 typer (company, contract, comments, history, assignees)
- Comments + history capped ved 50

- [ ] **Kør + commit**

```bash
git add src/__tests__/task-detail-action.test.ts
git commit -m "test(task-detail): unit tests for getTaskDetailData (5 tests)"
```

---

### Task 9: tasks-actions.test.ts

Største task — 6 funktioner, 4 med transactions. Brug $transaction-mock-pattern fra Task 4.

**createTask** (4): happy + no auth + no company-access + invalid schema
**updateTaskStatus** (4): valid change + same-status no-op + not found + transaction (status + history atomic)
**updateTaskPriority** (3): change + same + not found
**updateTaskAssignee** (4): assign + same + null/unassign + target user not found
**updateTaskDueDate** (4): new date + clear + same + not found
**deleteTask** (3): creator / non-creator-with-access / non-creator-no-access

22 tests total.

- [ ] **Kør + commit**

```bash
git add src/__tests__/tasks-actions.test.ts
git commit -m "test(tasks): unit tests for 6 functions inkl. transactions (22 tests)"
```

---

### Task 10: users-actions.test.ts

Mock `bcryptjs`:

```typescript
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}))
```

**getOrganizationUsers** (3): happy + no module-access + ekskluderer deleted
**createUser** (5): GROUP-role (scope=ALL) + ASSIGNED-role (scope=ASSIGNED) + duplicate email + no module-access + bcrypt(12) called
**updateUserRole** (4): GROUP-update + ASSIGNED-update + user not found + transaction atomic (deleteMany + create)
**toggleUserActive** (4): deactivate other + cannot deactivate self → error + cannot deactivate last GROUP_OWNER → error + reactivate

16 tests.

- [ ] **Kør + commit**

```bash
git add src/__tests__/users-actions.test.ts
git commit -m "test(users): unit tests for 4 functions inkl. bcrypt + business rules (16 tests)"
```

---

### Task 11: visits-actions.test.ts

**createVisit** (3): happy + no company-access + invalid schema
**updateVisit** (4): update status til GENNEMFOERT + update notes + visit ikke fundet + no company-access
**deleteVisit** (2): happy + no access

9 tests.

- [ ] **Kør + commit**

```bash
git add src/__tests__/visits-actions.test.ts
git commit -m "test(visits): unit tests for createVisit + updateVisit + deleteVisit (9 tests)"
```

---

### Task 12: Verifikation + PROGRESS.md

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
- lint: 0 warnings
- tsc: 0 errors
- tests: ~554 passed (428 + ~126 nye)
- build: grøn

- [ ] **Step 2: Coverage rapport (valgfri)**

```bash
npm run test:coverage 2>&1 | tail -20
```

Verificér at coverage på `src/actions/` er omkring 80%+.

- [ ] **Step 3: Opdater PROGRESS.md**

Tilføj efter session 3-afsnittet:

```markdown
## Coverage uplift — 2026-04-18 ✅

11 nye unit-test filer for tidligere utestede action-filer:

- cases (11 tests), comments (8), contracts (14), contract-versions (6),
  document-review (8), documents (4), ownership (14), task-detail (5),
  tasks (22), users (16), visits (9)

Tests: 428 → ~554 passed (~126 nye, 0 failed). Coverage på src/actions/
omkring 80%.

Mock-baseret pattern fra session 3 brugt konsistent: vi.mock af
@/lib/auth, @/lib/db, @/lib/permissions, @/lib/audit, @/lib/logger,
next/cache. Valid UUIDs for Zod-validering. bcryptjs mocket i users.ts.
```

- [ ] **Step 4: Commit**

```bash
git add docs/status/PROGRESS.md
git commit -m "docs(status): coverage uplift complete — 11 action files tested"
```

---

## Kritiske filer (quick reference)

**Test pattern template:** `src/__tests__/governance-actions.test.ts` (session 3)
**Action source filer at læse:** `src/actions/*.ts` (alle 11)

**Mocks at standardisere:**

- `@/lib/auth` → `auth: vi.fn().mockResolvedValue({ user: { id, organizationId }})`
- `@/lib/db` → `prisma: { ...alle nødvendige modeller med stub-functions }`
- `@/lib/permissions` → alle 3 helpers mocked til `mockResolvedValue(true)`
- `@/lib/audit` → `recordAuditEvent: vi.fn().mockResolvedValue(undefined)`
- `@/lib/logger` → `captureError: vi.fn()`, `createLogger: vi.fn(() => stubLogger)`
- `next/cache` → `revalidatePath: vi.fn()`
- `bcryptjs` (kun users.ts) → `default: { hash: vi.fn().mockResolvedValue('hash') }`
- `@/lib/ai/feedback` (kun document-review.ts) → `logFieldCorrection: vi.fn()`

**Transaction-mock pattern (tasks.ts, contract-versions.ts):**

```typescript
vi.mocked(prisma.$transaction).mockImplementation((async (fn: any) => {
  return await fn(prisma) // pass mocked prisma som tx-object
}) as never)
```

---

## Verification

**Teknisk gate (alle skal være grønne):**

```bash
npm run format:check                             # clean
npm run lint                                     # 0 warnings
npx tsc --noEmit                                 # 0 fejl
npm test                                         # ~554 passed, 0 failed
npx next build                                   # grøn
npm run test:coverage                            # actions/ ~80%+
```

**Acceptance:**

- ✅ 11 nye test-filer i `src/__tests__/`
- ✅ Tests: 428 → ~554 passed (mindst +120, op til +126)
- ✅ 0 fejl i hele test-suiten
- ✅ Format/lint/tsc/build alle grønne
- ✅ PROGRESS.md opdateret

**Ikke-mål (egne sprints):**

- A11y-sweep
- Kanban drag-drop E2E (kræver custom HTML5-helper)
- Bredere E2E-dækning (visits, contracts CRUD, user management)
- Vercel-deploy
- Nye actions/features
- Refactor af action-implementeringer
