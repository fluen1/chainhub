# Goal 4: Skalerbarhed — UI Cleanup + Test Quality

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ryd op i forældet UI-kode, erstat falsk-tryghed-tests med reelle tests, og fjern død kode.

**Architecture:** Slet ubrugte komponenter, omskriv 2 meta-tests til Prisma-mock-baserede tests. NextAuth v5 migration udskydes — det er et non-trivielt multi-file refactor (84 filer) med lav ROI da v4 stadig er vedligeholdt og funktionelt.

**Tech Stack:** Vitest, Prisma mocks, component cleanup

**Revideret scope:** NextAuth v5 migration er fjernet fra scope — v4 er stabil, og 84-fil migration er disproportionalt risikabelt ift. gevinst. Fokus er i stedet på UI-oprydning og test-kvalitet, som giver umiddelbar værdi.

---

### Task 1: Slet ubrugte UI-komponenter

**Files:**

- Delete: `src/components/ui/CollapsibleSection.tsx`
- Delete: `src/components/ui/GroupToggle.tsx`
- Delete: `src/components/ui/Pagination.tsx`

- [ ] **Step 1: Verificér ingen imports**

Run: `grep -r "CollapsibleSection" src/ --include="*.tsx" --include="*.ts"`
Run: `grep -r "GroupToggle" src/ --include="*.tsx" --include="*.ts"`
Run: `grep -r "Pagination" src/ --include="*.tsx" --include="*.ts"` (NB: Pager.tsx er B-stil erstatning — verificér at `Pagination` ikke bruges)

Expected: Ingen hits i produktionskode.

- [ ] **Step 2: Slet filerne**

```bash
rm src/components/ui/CollapsibleSection.tsx
rm src/components/ui/GroupToggle.tsx
rm src/components/ui/Pagination.tsx
```

- [ ] **Step 3: Kør build**

Run: `npx next build`
Expected: Success — ingen broken imports.

- [ ] **Step 4: Commit**

```bash
git add -u src/components/ui/
git commit -m "chore: slet ubrugte UI-komponenter (CollapsibleSection, GroupToggle, Pagination)"
```

---

### Task 2: Slet test-only komponenter og deres tests

**Files (kandidater — verificér først):**

- Delete: `src/components/ui/fin-row.tsx` + tilhørende test
- Delete: `src/components/ui/coverage-bar.tsx` + tilhørende test
- Delete: `src/components/ui/insight-card.tsx` + tilhørende test
- Delete: `src/components/ui/company-row.tsx` + tilhørende test
- Delete: `src/components/ui/health-bar.tsx` + tilhørende test
- Delete: `src/components/ui/section-header.tsx` + tilhørende test
- Delete: `src/components/ui/kpi-card.tsx` + tilhørende test
- Delete: `src/components/ui/urgency-list.tsx` + tilhørende test
- Delete: `src/components/ui/calendar-widget.tsx` + tilhørende test

- [ ] **Step 1: For HVER komponent, verificér**

For hver fil:

1. Grep for imports i `src/app/` og `src/components/` (ekskl. `__tests__/`)
2. Hvis KUN brugt i tests → slet komponent + test
3. Hvis brugt i produktionskode → behold

- [ ] **Step 2: Slet bekræftede ubrugte filer**

Slet komponent + matchende testfil for hver.

- [ ] **Step 3: Kør tests**

Run: `npx vitest run`
Expected: PASS (færre tests, men ingen broken)

- [ ] **Step 4: Kør build**

Run: `npx next build`
Expected: Success

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "chore: slet test-only UI-komponenter uden produktionsbrug"
```

---

### Task 3: Erstat security.test.ts med reelle tests

**Files:**

- Rewrite: `src/__tests__/security.test.ts`

- [ ] **Step 1: Læs nuværende security.test.ts**

Forstå hvad den "tester" (stringsøgning i kildefiler).

- [ ] **Step 2: Omskriv til reelle permission-tests**

I stedet for at scanne kildefiler som tekst, test at actions rent faktisk afviser uautoriserede kald:

```typescript
// src/__tests__/security.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    company: { findMany: vi.fn(), create: vi.fn() },
    contract: { findMany: vi.fn(), create: vi.fn() },
    case: { findMany: vi.fn(), create: vi.fn() },
    person: { findMany: vi.fn(), create: vi.fn() },
    task: { findMany: vi.fn(), create: vi.fn() },
    document: { findMany: vi.fn(), create: vi.fn() },
  },
}))

import { auth } from '@/lib/auth'

describe('security: alle actions kræver authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(null)
  })

  const actionModules = [
    { name: 'companies', path: '@/actions/companies' },
    { name: 'contracts', path: '@/actions/contracts' },
    { name: 'cases', path: '@/actions/cases' },
    { name: 'persons', path: '@/actions/persons' },
    { name: 'tasks', path: '@/actions/tasks' },
    { name: 'documents', path: '@/actions/documents' },
  ]

  for (const mod of actionModules) {
    it(`${mod.name}: alle exports returnerer fejl uden session`, async () => {
      const module = await import(mod.path)
      const exports = Object.entries(module).filter(([, v]) => typeof v === 'function')

      for (const [name, fn] of exports) {
        const result = await (fn as Function)({})
        expect(result, `${mod.name}.${name} should reject without session`).toMatchObject({
          error: expect.any(String),
        })
      }
    })
  }
})
```

- [ ] **Step 3: Kør test**

Run: `npx vitest run src/__tests__/security.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/security.test.ts
git commit -m "test: erstat stringsøgning security-test med reel auth-verificering"
```

---

### Task 4: Erstat tenant-isolation.test.ts med reelle tests

**Files:**

- Rewrite: `src/__tests__/tenant-isolation.test.ts`

- [ ] **Step 1: Læs nuværende tenant-isolation.test.ts**

- [ ] **Step 2: Omskriv til Prisma-mock-baserede tests**

Test at actions sender korrekt `organization_id` til Prisma:

```typescript
// src/__tests__/tenant-isolation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const mockPrisma = {
  company: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  contract: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  case: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  person: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  task: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { auth } from '@/lib/auth'

const ORG_ID = 'org-test-123'

describe('tenant isolation: queries filtrerer på organization_id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', organizationId: ORG_ID, email: 'a@b.dk', name: 'Test' },
      expires: '',
    } as any)
  })

  it('getCompanies sender organization_id til Prisma', async () => {
    const { getCompanies } = await import('@/actions/companies')
    await getCompanies({ page: 1, pageSize: 25 })

    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG_ID,
        }),
      })
    )
  })

  // Gentag for contracts, cases, persons, tasks...
})
```

- [ ] **Step 3: Kør test**

Run: `npx vitest run src/__tests__/tenant-isolation.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/tenant-isolation.test.ts
git commit -m "test: erstat array-filter isolation-test med Prisma-mock verificering"
```

---

### Task 5: Final verificering

- [ ] **Step 1: Kør fuld test suite**

Run: `npx vitest run`
Expected: Alle tests passer

- [ ] **Step 2: Kør build**

Run: `npx next build`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: Goal 4 skalerbarhed færdig — cleanup + test quality"
```
