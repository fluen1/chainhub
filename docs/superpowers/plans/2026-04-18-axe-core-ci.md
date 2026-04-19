# axe-core CI Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrere axe-core i CI via eksisterende Playwright E2E-infrastruktur så a11y-regressioner fanges automatisk på alle top-level sider ved hver push/PR.

**Architecture:** Genbruger den eksisterende `e2e`-job i `.github/workflows/ci.yml` + Playwright-fixtures. Ny `tests/e2e/a11y.spec.ts` kører axe-core scan pr. kritisk side, log'er violations, fejler CI ved critical/serious violations. Ingen ny CI-job — bare en ny spec-fil i eksisterende setup.

**Tech Stack:** `@axe-core/playwright` (officielle Playwright-integration), Playwright, eksisterende fixtures.

---

## Kontekst

Nuværende a11y-status:

- WCAG 2.1 Level A leveret (a11y-track 2026-04-18)
- `eslint-plugin-jsx-a11y` enabled → fanger static violations
- Manuel audit af alle 27 sider (page-audit-dokumentet)
- **Mangler**: automatisk regression-detection i CI ved runtime

axe-core tester det ESLint ikke kan:

- Color-contrast på tværs af sider
- aria-attributter korrekt anvendt i faktisk render
- Fokus-management i interaktive flows
- Landmark-struktur (main, nav, header roller)
- Rolle-adaptive content (fx GROUP_OWNER ser andet end GROUP_LEGAL)

Eksisterende infrastruktur:

- Playwright kører i CI (`e2e`-job i `ci.yml:72-128`)
- Fixtures i `tests/e2e/fixtures.ts` + helpers i `tests/e2e/helpers/`
- Eksisterende specs: auth, companies, search, settings, tasks

## File Structure

**Nye filer:**

- `tests/e2e/a11y.spec.ts` — axe-core scan pr. top-level side
- `docs/build/A11Y-GUIDE.md` — guide til at tilføje nye sider + tolke violations

**Ændrede filer:**

- `package.json` — add `@axe-core/playwright` dev-dep
- `.github/workflows/ci.yml` — ingen ændring (a11y.spec.ts kører som del af eksisterende `npx playwright test`)

**Ikke ændret:** Eksisterende Playwright-specs.

---

## Plan

### Task 0: Plan commit

- [ ] Plan gemt på `docs/superpowers/plans/2026-04-18-axe-core-ci.md`. Commit:

```bash
git add docs/superpowers/plans/2026-04-18-axe-core-ci.md
git commit -m "docs(plan): axe-core CI integration"
```

---

### Task 1: Install dep + basic a11y-spec

**Files:**

- Modify: `package.json`, `package-lock.json`
- Create: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Install**

```bash
npm install -D @axe-core/playwright
```

- [ ] **Step 2: Opret basic spec**

`tests/e2e/a11y.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { login } from './helpers/auth'

// Pages der scannes — må ikke have critical/serious violations
const PAGES = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/companies', label: 'Portfolio (companies list)' },
  { path: '/contracts', label: 'Contracts list' },
  { path: '/cases', label: 'Cases list' },
  { path: '/tasks', label: 'Tasks list' },
  { path: '/persons', label: 'Persons list' },
  { path: '/documents', label: 'Documents list' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/search', label: 'Global search' },
  { path: '/settings', label: 'Settings' },
]

test.describe('a11y — axe-core scans', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  for (const { path, label } of PAGES) {
    test(`${label} har ingen critical/serious violations`, async ({ page }) => {
      await page.goto(path)
      // Vent til hovedindhold renderet (ingen hvidskærm-scan)
      await page.waitForLoadState('networkidle', { timeout: 10000 })

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const critical = results.violations.filter((v) => v.impact === 'critical')
      const serious = results.violations.filter((v) => v.impact === 'serious')

      if (critical.length > 0 || serious.length > 0) {
        // Pretty-print for CI-log
        const summary = [...critical, ...serious]
          .map((v) => {
            const nodes = v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join('; ')
            return `  [${v.impact}] ${v.id}: ${v.description}\n    Elements: ${nodes}`
          })
          .join('\n')
        console.error(`\n[a11y] ${label} (${path}) violations:\n${summary}`)
      }

      expect(critical).toHaveLength(0)
      expect(serious).toHaveLength(0)
    })
  }
})
```

Note: `login` helper skal eksistere i `tests/e2e/helpers/`. Hvis det ikke er der, re-use pattern fra eksisterende specs (fx `auth.spec.ts`).

- [ ] **Step 3: Verificér at helper findes**

```bash
cat tests/e2e/helpers/auth.ts 2>/dev/null || cat tests/e2e/helpers/login.ts 2>/dev/null || ls tests/e2e/helpers/
```

Hvis `login`-helper ikke findes som navngivet, tilpas import-path eller skriv inline login i `beforeEach`.

- [ ] **Step 4: Kør lokalt (hvis muligt)**

```bash
npx playwright test tests/e2e/a11y.spec.ts
```

Forventet: Hvis violations findes, output viser præcis hvilke elementer. Fix dem først (se Task 3).

Hvis dev-server ikke er tilgængelig, kan testen skippes lokalt — det er CI-fokuseret. Men verificér at spec compiler + imports er rigtige:

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/e2e/a11y.spec.ts
git commit -m "feat(a11y): axe-core CI scan af 10 top-level sider"
```

---

### Task 2: Detail-page scans (dynamiske paths)

**Files:**

- Modify: `tests/e2e/a11y.spec.ts`

Detail-sider (companies/[id], tasks/[id], contracts/[id], cases/[id], persons/[id]) har dynamiske paths. Vi skal hente ét id fra seed-data for hver type.

- [ ] **Step 1: Udvid spec med detail-pages**

Tilføj efter PAGES-array:

```ts
// Detail-pages — hentes via API eller hardcoded fra seed
const DETAIL_PAGES: Array<{ path: (ids: SeedIds) => string; label: string }> = [
  {
    label: 'Company detail',
    path: (ids) => `/companies/${ids.companyId}`,
  },
  {
    label: 'Contract detail',
    path: (ids) => `/contracts/${ids.contractId}`,
  },
  {
    label: 'Case detail',
    path: (ids) => `/cases/${ids.caseId}`,
  },
  {
    label: 'Task detail',
    path: (ids) => `/tasks/${ids.taskId}`,
  },
  {
    label: 'Person detail',
    path: (ids) => `/persons/${ids.personId}`,
  },
]

interface SeedIds {
  companyId: string
  contractId: string
  caseId: string
  taskId: string
  personId: string
}
```

Hent seed-IDs. Hvis seed.ts bruger `uid(n)`-helper (fra `00000000-0000-0000-0000-000000000001`-pattern), hardcode seed-IDs direkte:

```ts
const SEED_IDS: SeedIds = {
  companyId: '00000000-0000-0000-0000-000000000100', // justér hvis seed har anden company-id
  contractId: '00000000-0000-0000-0000-000000000200',
  caseId: '00000000-0000-0000-0000-000000000300',
  taskId: '00000000-0000-0000-0000-000000000400',
  personId: '00000000-0000-0000-0000-000000000500',
}
```

Justér tallene til faktiske seed-IDs (check `prisma/seed.ts` eller kør query).

Tilføj test-loop:

```ts
test.describe('a11y — detail pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  for (const { path, label } of DETAIL_PAGES) {
    test(`${label} har ingen critical/serious violations`, async ({ page }) => {
      await page.goto(path(SEED_IDS))
      await page.waitForLoadState('networkidle', { timeout: 10000 })

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const critical = results.violations.filter((v) => v.impact === 'critical')
      const serious = results.violations.filter((v) => v.impact === 'serious')

      if (critical.length > 0 || serious.length > 0) {
        const summary = [...critical, ...serious]
          .map((v) => {
            const nodes = v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join('; ')
            return `  [${v.impact}] ${v.id}: ${v.description}\n    Elements: ${nodes}`
          })
          .join('\n')
        console.error(`\n[a11y] ${label} violations:\n${summary}`)
      }

      expect(critical).toHaveLength(0)
      expect(serious).toHaveLength(0)
    })
  }
})
```

- [ ] **Step 2: Kør**

```bash
npx playwright test tests/e2e/a11y.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/a11y.spec.ts
git commit -m "feat(a11y): axe-core scan af 5 detail-sider"
```

---

### Task 3: Fix violations der opdages

Dette er ukendt scope — afhænger af hvad axe faktisk finder.

Common findings og fixes:

| Violation           | Fix                                                                    |
| ------------------- | ---------------------------------------------------------------------- |
| `color-contrast`    | Bump gray-400 → gray-500 (gjort i a11y-track, men kan have regreset)   |
| `landmark-one-main` | Sikr at `<main>` findes på hver side — allerede i dashboard/layout.tsx |
| `region`            | Content udenfor `<main>`, `<nav>`, etc. — wrap eller ignore            |
| `html-has-lang`     | Check `src/app/layout.tsx` root — `<html lang="da">`                   |
| `button-name`       | Button med kun ikon — tilføj aria-label                                |
| `link-name`         | Link med kun ikon — tilføj aria-label                                  |

- [ ] **Step 1: Kør tests og saml violations**

```bash
npx playwright test tests/e2e/a11y.spec.ts 2>&1 | tee /tmp/a11y-run.log
```

- [ ] **Step 2: Fix hver violation per kategori**

Kør scans igen efter hver fix-batch.

- [ ] **Step 3: Commit per fix-kategori**

Fx:

```bash
git add src/...
git commit -m "a11y(pages): fix contrast + button-name violations fra axe"
```

---

### Task 4: Dokumentation + CI verification

**Files:**

- Create: `docs/build/A11Y-GUIDE.md`
- Verify: `.github/workflows/ci.yml` kører a11y-spec (ingen ændring nødvendig — inkluderet i `npx playwright test`)

- [ ] **Step 1: Opret `docs/build/A11Y-GUIDE.md`**

```markdown
# A11y Guide — ChainHub

**Standard:** WCAG 2.1 Level AA (Level A baseline + kritisk AA som kontrast + tap-targets)
**Regression-beskyttelse:** axe-core i Playwright CI (`tests/e2e/a11y.spec.ts`)
**Static linting:** `eslint-plugin-jsx-a11y/recommended` i `.eslintrc.json`

## Hvad testes i CI

- 10 top-level sider + 5 detail-sider scannes med axe-core via `@axe-core/playwright`
- Tags anvendt: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`
- **Fejler på:** `critical` eller `serious` violations
- **Tolereres (p.t.):** `moderate`, `minor` — logges men fejler ikke

## Tilføj ny side til scan

Åbn `tests/e2e/a11y.spec.ts`. Tilføj til PAGES-array:

\`\`\`ts
{ path: '/min-nye-side', label: 'Min nye side' },
\`\`\`

For dynamisk side: tilføj til DETAIL_PAGES + sikr at seed har et id.

## Common violations + fixes

Se Task 3 i `docs/superpowers/plans/2026-04-18-axe-core-ci.md`.

## Lokal debugging

\`\`\`bash

# Start dev-server + seed-data

npm run dev

# I separat terminal:

npx playwright test tests/e2e/a11y.spec.ts --debug
\`\`\`

Playwright's UI-mode viser præcis hvor violations sker i DOM.

## Eskalering

Hvis en violation ikke kan fikses (fx 3rd-party library), eksemptér den specifikt:

\`\`\`ts
const results = await new AxeBuilder({ page })
.withTags(['wcag2a', 'wcag2aa'])
.disableRules(['color-contrast']) // DOKUMENTÉR ÅRSAG HER
.analyze()
\`\`\`

Max 1 regel-disable pr. side. Hvis flere skulle disables, er noget strukturelt galt.
```

- [ ] **Step 2: Verificér at CI kører den nye spec**

`.github/workflows/ci.yml` har allerede `run: npx playwright test` (linje 115). Den kører ALLE specs inkl. a11y.spec.ts automatisk. **Ingen workflow-ændring nødvendig**.

- [ ] **Step 3: Commit**

```bash
git add docs/build/A11Y-GUIDE.md
git commit -m "docs(a11y): guide til axe-core CI og violations"
```

---

### Task 5: Verifikation + PROGRESS

- [ ] **Step 1: Full gate**

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npm test  # Vitest (ikke Playwright)
```

Playwright test-run kører i CI — lokalt er det optional. Hvis dev-server tilgængelig:

```bash
npx playwright test tests/e2e/a11y.spec.ts
```

- [ ] **Step 2: Opdatér PROGRESS.md**

Tilføj:

```markdown
## axe-core CI ✅ (2026-04-18)

Sidste Gate 1 kvalitets-infra. A11y-regressioner fanges nu automatisk i CI.

- [x] `@axe-core/playwright` installed
- [x] `tests/e2e/a11y.spec.ts` scanner 10 top-level + 5 detail-sider med WCAG 2.1 A/AA tags
- [x] CI fejler på critical/serious violations (moderate/minor logges kun)
- [x] `docs/build/A11Y-GUIDE.md` — guide til tilføjelse + tolke findings
- [x] Ingen changelog på `.github/workflows/ci.yml` (specs kører automatisk via eksisterende `npx playwright test`)
- [x] [Evt. fix af violations der opdages]
```

- [ ] **Step 3: Commit**

```bash
git add docs/status/PROGRESS.md
git commit -m "docs(status): axe-core CI klar — sidste Gate 1 kode-item"
```

---

## Verification

**Acceptance:**

- ✅ `@axe-core/playwright` installed
- ✅ `tests/e2e/a11y.spec.ts` scanner 15 sider
- ✅ Tests fejler på critical/serious, logger moderate/minor
- ✅ CI kører automatisk — ingen workflow-ændring
- ✅ `docs/build/A11Y-GUIDE.md` klar til fremtidige developers
- ✅ Alle opdagede violations enten fixet eller eksplicit disabled med kommentar

**Ikke-mål:**

- Automatisk a11y-tests i unit-test-suite (Vitest) — for hver side ville være overkill
- Scan af rolle-specifikke variations (fx GROUP_FINANCE ser andet — kan gøres v2)
- WCAG 2.2-specifikke tags (tags: `wcag22aa`) — Level AA er tilstrækkeligt for v1
- Mobile viewport a11y-scan — Chromium desktop er nok til v1
- Screenshot-regression — separat track hvis ønsket
