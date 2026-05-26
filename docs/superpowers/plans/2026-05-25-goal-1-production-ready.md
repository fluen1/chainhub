# Goal 1: Production-Ready Foundations — Tilgængelighed + Performance → 10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Løft Tilgængelighed (6→10) og Performance (6.5→10) ved at optimere Prisma-queries og tilføje keyboard-navigation E2E-tests.

**Architecture:** Mange items fra den oprindelige spec var allerede implementeret: mobilnavigation (b-shell.tsx drawer), skip-to-content (SkipToMain), Leaflet lazy-load (dynamic()), focus-trap (accessible-dialog.tsx), axe-core a11y tests (15 sider). Resterende arbejde: Prisma select-optimering (fjern N+1), keyboard E2E-tests, og SWR evaluering (afvist — Server Components-arkitektur gør SWR unødvendigt).

**Tech Stack:** Prisma 5, Playwright, @axe-core/playwright

**Allerede gjort (verificeret i codebase):**

- ✅ 1A Mobilnavigation — `src/components/layout/b-shell.tsx` (drawer, focus-trap, scroll-lock)
- ✅ 1B Skip-to-content — `SkipToMain` i dashboard layout, `id="main-content"` på main
- ✅ 1C Focus-trap — `src/components/ui/accessible-dialog.tsx` (Tab/Shift+Tab loop, Escape)
- ✅ 1D Farvekontrast — `tests/e2e/a11y.spec.ts` (axe-core WCAG 2.1 AA på 15 sider)
- ✅ 1F Leaflet lazy-load — `dynamic()` i `company-detail-b.tsx`
- ✅ 1G SWR — evalueret og afvist; Server Components + `unstable_cache` dækker behovet

---

### Task 1: Prisma select-optimering — contracts.ts

**Files:**

- Modify: `src/actions/contracts.ts`

- [ ] **Step 1: Kør eksisterende tests for baseline**

Run: `npx vitest run src/__tests__/actions/contracts.test.ts`
Expected: PASS

- [ ] **Step 2: Optimér getRawContractDetail (linje 650)**

Erstat:

```typescript
include: {
  company: { select: { id: true, name: true } },
  parties: {
    include: {
      person: { select: { id: true, first_name: true, last_name: true } },
    },
  },
  versions: { orderBy: { version_number: 'desc' }, take: 10 },
},
```

Med:

```typescript
include: {
  company: { select: { id: true, name: true } },
  parties: {
    select: {
      id: true,
      counterparty_name: true,
      role_in_contract: true,
      person: { select: { id: true, first_name: true, last_name: true } },
    },
  },
  versions: {
    orderBy: { version_number: 'desc' },
    take: 10,
    select: {
      id: true,
      version_number: true,
      uploaded_at: true,
      uploaded_by: true,
      change_type: true,
      file_url: true,
    },
  },
},
```

- [ ] **Step 3: Optimér eksistens-checks**

**updateContractStatus (linje 343)** — bruger `contract.sensitivity`:

```typescript
const contract = await prisma.contract.findFirst({
  where: {
    id: parsed.data.contractId,
    organization_id: session.user.organizationId,
    deleted_at: null,
  },
  select: { id: true, sensitivity: true },
})
```

**deleteContract (linje 421)** — bruger `contract.status`:

```typescript
const contract = await prisma.contract.findFirst({
  where: {
    id: contractId,
    organization_id: session.user.organizationId,
    deleted_at: null,
  },
  select: { id: true, status: true },
})
```

**updateContract (linje 477)** — bruger `contract.company_id`, `contract.sensitivity`:

```typescript
const contract = await prisma.contract.findFirst({
  where: {
    id: parsed.data.contractId,
    organization_id: session.user.organizationId,
    deleted_at: null,
  },
  select: { id: true, company_id: true, sensitivity: true },
})
```

**addContractParty (linje 583)** — bruger `contract.company_id`:

```typescript
const contract = await prisma.contract.findFirst({
  where: {
    id: parsed.data.contractId,
    organization_id: session.user.organizationId,
    deleted_at: null,
  },
  select: { id: true, company_id: true },
})
```

- [ ] **Step 4: Kør tests**

Run: `npx vitest run src/__tests__/actions/contracts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/contracts.ts
git commit -m "perf: Prisma select-optimering i contracts.ts"
```

---

### Task 2: Prisma select-optimering — cases.ts

**Files:**

- Modify: `src/actions/cases.ts`

- [ ] **Step 1: Kør eksisterende tests for baseline**

Run: `npx vitest run src/__tests__/actions/cases.test.ts`
Expected: PASS

- [ ] **Step 2: Optimér getRawCaseDetail (linje 635)**

Erstat `tasks` og `documents` include:

```typescript
include: {
  case_companies: {
    include: { company: { select: { id: true, name: true } } },
  },
  case_contracts: {
    include: {
      contract: {
        select: { id: true, display_name: true, system_type: true, status: true },
      },
    },
  },
  case_persons: {
    include: {
      person: { select: { id: true, first_name: true, last_name: true } },
    },
  },
  tasks: {
    where: { deleted_at: null },
    orderBy: { due_date: 'asc' },
    select: {
      id: true,
      title: true,
      assigned_to: true,
      due_date: true,
      status: true,
      created_at: true,
    },
  },
  documents: {
    where: { deleted_at: null },
    orderBy: { uploaded_at: 'desc' },
    take: 10,
    select: {
      id: true,
      file_name: true,
      uploaded_at: true,
      extraction: { select: { extraction_status: true } },
    },
  },
},
```

- [ ] **Step 3: Optimér eksistens-checks**

Find alle `case.findFirst` uden `select` i cases.ts og tilføj `select: { id: true, status: true }` (eller de felter der rent faktisk bruges efter queryen).

- [ ] **Step 4: Kør tests**

Run: `npx vitest run src/__tests__/actions/cases.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/cases.ts
git commit -m "perf: Prisma select-optimering i cases.ts"
```

---

### Task 3: Prisma select-optimering — documents.ts

**Files:**

- Modify: `src/actions/documents.ts`

- [ ] **Step 1: Kør eksisterende tests for baseline**

Run: `npx vitest run src/__tests__/actions/documents.test.ts`
Expected: PASS

- [ ] **Step 2: Optimér documentReviewInclude (linje 178)**

Erstat:

```typescript
const documentReviewInclude = {
  company: { select: { name: true } },
  extraction: true,
  contract: {
    include: {
      parties: { include: { person: true } },
      ownerships: true,
    },
  },
  case: { select: { id: true, case_number: true, title: true } },
} satisfies Prisma.DocumentInclude
```

Med:

```typescript
const documentReviewInclude = {
  company: { select: { name: true } },
  extraction: {
    select: {
      id: true,
      detected_type: true,
      extracted_fields: true,
      discrepancies: true,
      field_decisions: true,
      reviewed_at: true,
      reviewed_by: true,
      schema_version: true,
      prompt_version: true,
      extraction_status: true,
    },
  },
  contract: {
    select: {
      id: true,
      display_name: true,
      parties: {
        select: {
          counterparty_name: true,
          person: { select: { first_name: true, last_name: true } },
        },
      },
      ownerships: {
        select: { ownership_pct: true },
      },
    },
  },
  case: { select: { id: true, case_number: true, title: true } },
} satisfies Prisma.DocumentInclude
```

- [ ] **Step 3: Verificér DocumentReviewDoc type**

`DocumentReviewDoc` er afledt af `documentReviewInclude` via `Prisma.DocumentGetPayload`. TypeScript-compileren vil fange manglende felter. Kør:

Run: `npx tsc --noEmit`
Expected: SUCCESS (ingen type-fejl)

Hvis fejl: tilføj de manglende felter til select.

- [ ] **Step 4: Kør tests**

Run: `npx vitest run src/__tests__/actions/documents.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/documents.ts
git commit -m "perf: Prisma select-optimering i documents.ts — fjern extraction:true"
```

---

### Task 4: Prisma select-optimering — remaining actions

**Files:**

- Modify: `src/actions/tasks.ts`
- Modify: `src/actions/persons.ts`
- Modify: `src/actions/companies.ts`

- [ ] **Step 1: Optimér tasks.ts eksistens-checks**

For hver `task.findFirst` uden `select` (updateTaskStatus, updateTaskPriority, updateTaskDueDate, deleteTask):

- Læs funktionen og identificér hvilke felter der bruges efter queryen
- Tilføj `select: { id: true, ...brugte_felter }`

Typisk mønster:

```typescript
// updateTaskStatus bruger task.status, task.created_by
select: { id: true, status: true, created_by: true }

// deleteTask bruger kun eksistens
select: { id: true }
```

- [ ] **Step 2: Optimér persons.ts eksistens-checks**

```typescript
// updatePerson — bruger person.organization_id (allerede i where)
select: {
  id: true
}

// deletePerson — bruger kun eksistens
select: {
  id: true
}
```

- [ ] **Step 3: Optimér companies.ts duplikat-check**

```typescript
// createCompany duplikat-check — bruger kun eksistens
select: {
  id: true
}
```

- [ ] **Step 4: Kør fuld test suite**

Run: `npx vitest run`
Expected: PASS (alle tests)

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: SUCCESS

- [ ] **Step 6: Commit**

```bash
git add src/actions/tasks.ts src/actions/persons.ts src/actions/companies.ts
git commit -m "perf: select-optimering på eksistens-checks i tasks/persons/companies"
```

---

### Task 5: Keyboard navigation E2E test

**Files:**

- Create: `tests/e2e/keyboard-nav.spec.ts`

- [ ] **Step 1: Skriv keyboard navigation tests**

```typescript
// tests/e2e/keyboard-nav.spec.ts
import { test, expect } from './fixtures'

test.describe('keyboard navigation', () => {
  test('Tab navigerer gennem sidebar-links', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Tab ind i sidebar (spring skip-link over)
    await page.keyboard.press('Tab') // skip-to-content link
    await page.keyboard.press('Tab') // første sidebar-link

    const activeElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(activeElement).toBe('A')
  })

  test('Skip-to-content link virker', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Først Tab fokuserer skip-link
    await page.keyboard.press('Tab')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeFocused()

    // Enter aktiverer skip-link
    await page.keyboard.press('Enter')

    // Fokus er nu på main-content
    const focusedId = await page.evaluate(() => document.activeElement?.id)
    expect(focusedId).toBe('main-content')
  })

  test('Escape lukker modal/dialog', async ({ loggedInPage: page }) => {
    await page.goto('/companies')
    await page.waitForLoadState('networkidle')

    // Åbn opret-dialog
    const createButton = page.locator('button', { hasText: 'Opret selskab' })
    if (await createButton.isVisible()) {
      await createButton.click()

      // Verificér dialog er åben
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()

      // Escape lukker den
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
    }
  })

  test('Mobil: burger-menu åbner sidebar via Enter', async ({ loggedInPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Find burger-knap og aktiver med keyboard
    const burgerButton = page.locator('button[aria-label]').first()
    await burgerButton.focus()
    await page.keyboard.press('Enter')

    // Sidebar-drawer åbner
    const drawer = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(drawer).toBeVisible()

    // Escape lukker drawer
    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeVisible()
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/keyboard-nav.spec.ts
git commit -m "test: keyboard navigation E2E tests (tab, skip-link, escape)"
```

---

### Task 6: Final verificering

- [ ] **Step 1: Kør fuld Vitest suite**

Run: `npx vitest run`
Expected: PASS (alle tests, coverage ≥ 80%)

- [ ] **Step 2: Kør TypeScript check**

Run: `npx tsc --noEmit`
Expected: SUCCESS

- [ ] **Step 3: Kør build**

Run: `npx next build`
Expected: SUCCESS

- [ ] **Step 4: Opsummér ændringer**

Verificér at alle Prisma detail-queries nu bruger præcise `select:` i stedet for brede `include:`. Verificér at keyboard-nav E2E tests er på plads.
