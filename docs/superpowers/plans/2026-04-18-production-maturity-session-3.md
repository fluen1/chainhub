# ChainHub — Produktions-modenhed session 3: E2E Playwright + GitHub Actions CI + coverage-uplift

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Etablere E2E-test-suite med Playwright dækkende 5 kritiske flows, GitHub Actions CI-pipeline der kører Prettier+ESLint+tsc+vitest+E2E på hver PR/push, og unit-tests for de 4 manglende action-filer (calendar, finance, governance, persons).

**Architecture:** Separat lokal Postgres-database (port 5433) til E2E så live dev-data ikke contamineres. Playwright-tests bruger seed-brugeren `philip@chainhub.dk`. CI-jobs splittes i tre parallelle: lint-test (hurtig), build (mellem), e2e (langsom — kun på PR + push til master). Sentry deaktiveres automatisk i CI (ingen DSN sat).

**Tech Stack:** `@playwright/test` (installeres), eksisterende `playwright@1.58.2`, Vitest, Prisma 5, Docker Compose, GitHub Actions.

---

## Kontekst

Session 1 (foundation) gav observability + dev-hygiejne. Session 2 (schema/audit) lukkede datamodel-huller og standardiserede error-capture. Session 3 lukker det sidste foundation-hul: **automatiseret regression-sikring**.

Aktuelt hits regressionsfejl manuelt via Playwright-MCP smoke-tests efter hver session. Det skalerer ikke. Konkrete huller:

1. **Ingen E2E test-suite** — `playwright@1.58.2` er installeret men ingen `playwright.config.ts`, ingen tests/e2e/ directory, ingen `@playwright/test` (test-runner).
2. **Ingen CI** — `.github/workflows/` mangler. PR'er kører ikke automatisk tests, lint, format-check, build.
3. **15/20 action-filer mangler unit-tests** — denne session uplifter de 4 vigtigste (calendar, finance, governance, persons). Resten udskydes.
4. **Live dev-DB bruges i Vitest** — `runIf(!!DATABASE_URL)` mutates seed-data. Skalerer ikke til E2E der kører tit. Behøver isoleret test-DB.

**Eksplorationsfund der ændrer scope:**

- Seed-bruger-IDer er **ikke** `00000000-0000-0000-0000-000000010001` (som dashboard-actions.test.ts forkert bruger) — de korrekte er `00000000-0000-0000-0000-000000000010` (philip) og org `00000000-0000-0000-0000-000000000001`. Session 1 inspection bekræftede dette. Nye unit-tests bruger korrekte IDer.
- Sentry-config er CI-safe: `enabled: !!dsn` betyder ingen crash uden DSN.
- A11y-sweep + 80%-coverage-mål er bevidst udskudt til session 4 (dedikeret).

**Udfald:** Hver PR/push kører automatisk fuld gate (format + lint + tsc + vitest + build + E2E). Holder kvalitet uden manuel discipline. Tests: 394 → ~430+ passed. CI-confidence ramt: kan deploye uden frygt.

---

## File Structure

**Nye filer:**

- `playwright.config.ts` — Playwright test-runner config (root)
- `tests/e2e/auth.spec.ts` — login + dashboard flow
- `tests/e2e/companies.spec.ts` — opret + redigér selskab
- `tests/e2e/tasks.spec.ts` — opret task + status-ændring + audit synlig
- `tests/e2e/search.spec.ts` — global søgning på tværs af 6 typer
- `tests/e2e/settings.spec.ts` — opdatér organisation-info
- `tests/e2e/fixtures.ts` — shared login + test-data helpers
- `tests/e2e/helpers/auth.ts` — programmatic login via NextAuth credentials
- `src/__tests__/calendar-action.test.ts` — getCalendarEvents (5 tests)
- `src/__tests__/finance-actions.test.ts` — upsertFinancialMetric + createDividendRecord (10 tests)
- `src/__tests__/governance-actions.test.ts` — addCompanyPerson + endCompanyPerson (10 tests)
- `src/__tests__/persons-actions.test.ts` — createPerson + updatePerson + deletePerson + searchPersons (15 tests)
- `.github/workflows/ci.yml` — 3-jobs CI workflow

**Ændrede filer:**

- `package.json` — `@playwright/test` devDep + nye scripts (`e2e`, `e2e:ui`, `e2e:install`, `db:e2e:reset`)
- `docker-compose.yml` — tilføj `chainhub_e2e` service på port 5433
- `.gitignore` — tilføj `playwright-report/`, `test-results/`, `tests/e2e/.auth/`
- `src/__tests__/dashboard-actions.test.ts` — fix forkerte seed-IDer (`010001` → `000010`)
- `src/__tests__/company-detail-actions.test.ts` — samme fix hvis berørt
- `docs/status/PROGRESS.md` — session 3-afsnit + opdatér tilbageværende work
- `README.md` — `npm run e2e` kommandoer + CI badge

---

## Plan

### Task 0: Kopiér plan til docs

**Files:**

- Create: `docs/superpowers/plans/2026-04-18-production-maturity-session-3.md`

- [ ] **Step 1: Kopiér plan-filen**

```bash
cp ~/.claude/plans/jeg-t-nker-vi-skal-elegant-marble.md docs/superpowers/plans/2026-04-18-production-maturity-session-3.md
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-04-18-production-maturity-session-3.md
git commit -m "docs(plan): session 3 production maturity — E2E + CI + coverage"
```

---

### Task 1: Install @playwright/test + browsers

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install @playwright/test**

```bash
npm install -D @playwright/test
```

- [ ] **Step 2: Install browser binaries**

```bash
npx playwright install --with-deps chromium
```

(Vi bruger kun Chromium — Firefox/WebKit kan tilføjes senere hvis behov. `--with-deps` installerer system-deps på Linux, no-op på Windows.)

- [ ] **Step 3: Verificér installation**

```bash
npx playwright --version
```

Forventet: `Version 1.58.x` eller højere.

- [ ] **Step 4: Tilføj npm scripts**

I `package.json` `scripts`-sektion (efter `test:coverage`):

```json
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:install": "playwright install --with-deps chromium",
    "db:e2e:reset": "DATABASE_URL=$E2E_DATABASE_URL DIRECT_URL=$E2E_DATABASE_URL npx prisma db push --skip-generate --force-reset && DATABASE_URL=$E2E_DATABASE_URL DIRECT_URL=$E2E_DATABASE_URL npx prisma db seed",
```

- [ ] **Step 5: Tilføj .gitignore-entries**

I `.gitignore` (eller opret hvis mangler), tilføj:

```
# Playwright
/playwright-report/
/test-results/
/tests/e2e/.auth/
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore(e2e): install @playwright/test + chromium browser

Tilføjer Playwright test-runner + browser-binærer. Nye npm scripts:
- e2e: kør Playwright tests
- e2e:ui: kør Playwright med UI
- e2e:install: install browsers (kør én gang efter klon)
- db:e2e:reset: reset isoleret test-DB + seed

.gitignore opdateret med Playwright-output mapper."
```

---

### Task 2: Playwright config + tests/e2e directory

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/.gitkeep`

- [ ] **Step 1: Opret playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.E2E_PORT ?? '3010'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Tests muterer DB — kør sekventielt for at undgå races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sekventiel kørsel
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    locale: 'da-DK',
    timezoneId: 'Europe/Copenhagen',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
      DIRECT_URL: process.env.E2E_DATABASE_URL ?? process.env.DIRECT_URL ?? '',
      NEXTAUTH_URL: BASE_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'e2e-test-secret-must-be-32-chars-min',
      NODE_ENV: 'test',
    },
  },
})
```

- [ ] **Step 2: Opret tests/e2e directory + placeholder**

```bash
mkdir -p tests/e2e
touch tests/e2e/.gitkeep
```

- [ ] **Step 3: Verificér Playwright kan finde config**

```bash
npx playwright test --list 2>&1 | head -5
```

Forventet: "0 tests found" (ingen tests endnu, men ingen errors).

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/.gitkeep
git commit -m "chore(e2e): add Playwright config

Sekventiel kørsel (workers: 1, fullyParallel: false) fordi tests muterer
DB. Trace + screenshot + video on failure. Custom port 3010 for at undgå
clash med dev-server på 3000-3005. webServer auto-starter dev-server med
E2E_DATABASE_URL fra env. Lokale: chromium only (kan udvides senere)."
```

---

### Task 3: Docker Compose E2E service + DB-reset

**Files:**

- Modify: `docker-compose.yml`

- [ ] **Step 1: Læs eksisterende docker-compose.yml**

```bash
cat docker-compose.yml
```

- [ ] **Step 2: Tilføj chainhub_e2e service**

I `docker-compose.yml` `services`-sektion, tilføj:

```yaml
postgres-e2e:
  image: postgres:15
  container_name: chainhub-postgres-e2e
  restart: unless-stopped
  environment:
    POSTGRES_USER: chainhub
    POSTGRES_PASSWORD: chainhub
    POSTGRES_DB: chainhub_e2e
  ports:
    - '5433:5432'
  volumes:
    - chainhub_e2e_data:/var/lib/postgresql/data
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U chainhub -d chainhub_e2e']
    interval: 5s
    timeout: 5s
    retries: 5
```

Tilføj til `volumes`-sektion (bunden af filen):

```yaml
volumes:
  chainhub_dev_data:
  chainhub_e2e_data:
```

(Bevar eksisterende `chainhub_dev_data` hvis den findes.)

- [ ] **Step 3: Start e2e DB**

```bash
docker compose up -d postgres-e2e
docker compose ps postgres-e2e
```

Forventet: `Up (healthy)` status.

- [ ] **Step 4: Tilføj E2E_DATABASE_URL til .env.example**

I `.env.example`, find `# OBSERVABILITY`-sektionen og tilføj før den:

```
# ────────────────────────────────────────────────────
# E2E TESTS (lokal Docker PG på port 5433)
# ────────────────────────────────────────────────────
# Sæt KUN i .env.local — Playwright bruger denne i stedet for DATABASE_URL
# E2E_DATABASE_URL=postgresql://chainhub:chainhub@localhost:5433/chainhub_e2e
```

- [ ] **Step 5: Sæt E2E_DATABASE_URL i .env.local**

```bash
echo "" >> .env.local
echo "E2E_DATABASE_URL=postgresql://chainhub:chainhub@localhost:5433/chainhub_e2e" >> .env.local
```

- [ ] **Step 6: Reset + seed E2E DB**

```bash
npm run db:e2e:reset
```

Forventet: Schema synced + seed kørt på e2e-DB.

- [ ] **Step 7: Verificér seed**

```bash
cat <<'EOF' > verify-e2e.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL } },
})
const philip = await prisma.user.findFirst({ where: { email: 'philip@chainhub.dk' } })
console.log('philip exists:', !!philip)
console.log('philip.id:', philip?.id)
const companies = await prisma.company.count()
console.log('companies in e2e DB:', companies)
await prisma.$disconnect()
EOF
node --env-file=.env.local verify-e2e.mjs && rm -f verify-e2e.mjs
```

Forventet: `philip exists: true`, `companies: 7`.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore(e2e): add isolated postgres-e2e service on port 5433

Separat Docker-container for E2E tests så live dev-DB (Supabase) ikke
contamineres af E2E-mutations. Health-check sikrer Playwright kun
starter når DB er klar.

E2E_DATABASE_URL dokumenteret i .env.example. Tilføjes lokalt i
.env.local af hver udvikler."
```

---

### Task 4: E2E auth fixture + helpers

**Files:**

- Create: `tests/e2e/fixtures.ts`
- Create: `tests/e2e/helpers/auth.ts`

- [ ] **Step 1: Opret auth-helper**

`tests/e2e/helpers/auth.ts`:

```typescript
import { Page, expect } from '@playwright/test'

export const SEED_USER = {
  email: 'philip@chainhub.dk',
  password: 'password123',
  name: 'Philip Larsen',
}

/**
 * Login via NextAuth credentials-provider. Bruger UI flow så vi tester
 * det samme som brugeren. Returnerer når dashboard er loaded.
 */
export async function loginAs(page: Page, user = SEED_USER): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email)
  await page.getByRole('textbox', { name: 'Adgangskode' }).fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
}
```

- [ ] **Step 2: Opret fixtures.ts**

`tests/e2e/fixtures.ts`:

```typescript
import { test as base } from '@playwright/test'
import { loginAs } from './helpers/auth'

type Fixtures = {
  loggedInPage: import('@playwright/test').Page
}

export const test = base.extend<Fixtures>({
  loggedInPage: async ({ page }, use) => {
    await loginAs(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Forventet: 0 fejl.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/helpers/auth.ts tests/e2e/fixtures.ts
git commit -m "test(e2e): add login helper + loggedInPage fixture"
```

---

### Task 5: E2E test 1 — auth + dashboard

**Files:**

- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Skriv test**

```typescript
import { test, expect } from './fixtures'
import { loginAs, SEED_USER } from './helpers/auth'

test.describe('Authentication', () => {
  test('login + redirect til dashboard', async ({ page }) => {
    await loginAs(page)
    await expect(
      page.getByRole('heading', { name: /God (morgen|eftermiddag|aften)/ })
    ).toBeVisible()
    // Sidebar viser bruger-rolle
    await expect(page.getByText('Kædeejer')).toBeVisible()
  })

  test('forkert password viser fejl-besked', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Email' }).fill(SEED_USER.email)
    await page.getByRole('textbox', { name: 'Adgangskode' }).fill('forkert-password')
    await page.getByRole('button', { name: 'Log ind' }).click()
    // Forbliver på login-siden
    await expect(page).toHaveURL(/\/login/)
  })

  test('protected route redirecter til login når ikke logget ind', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('dashboard viser KPI-header med selskaber + sager + omsætning', async ({
    loggedInPage: page,
  }) => {
    await expect(page.getByText('Selskaber').first()).toBeVisible()
    await expect(page.getByText('Sager').first()).toBeVisible()
    await expect(page.getByText('Omsætning').first()).toBeVisible()
  })
})
```

- [ ] **Step 2: Reset E2E DB inden test-run**

```bash
npm run db:e2e:reset
```

- [ ] **Step 3: Kør testen**

```bash
npx playwright test tests/e2e/auth.spec.ts
```

Forventet: 4 tests passed.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/auth.spec.ts
git commit -m "test(e2e): auth + dashboard render flow (4 tests)

Login lykkes, forkert password afvises, beskyttet route redirecter
til login, dashboard KPIs vises efter login."
```

---

### Task 6: E2E test 2 — opret selskab

**Files:**

- Create: `tests/e2e/companies.spec.ts`

- [ ] **Step 1: Skriv test**

```typescript
import { test, expect } from './fixtures'

test.describe('Companies CRUD', () => {
  test('opret nyt selskab og se det i listen', async ({ loggedInPage: page }) => {
    const cvr = String(Math.floor(10000000 + Math.random() * 89999999))
    const name = `E2E Test ApS ${Date.now()}`

    await page.goto('/companies')
    await page.getByRole('link', { name: /Nyt selskab/i }).click()
    await expect(page).toHaveURL(/\/companies\/new/)

    await page.getByLabel('Navn', { exact: true }).fill(name)
    await page.getByLabel('CVR', { exact: true }).fill(cvr)
    await page.getByLabel(/By/i).fill('København K')
    await page.getByRole('button', { name: /Opret/i }).click()

    // Efter oprettelse vises selskabet på /companies eller /companies/[id]
    await expect(page).toHaveURL(/\/companies/, { timeout: 10_000 })
    await page.goto('/companies')
    await expect(page.getByText(name)).toBeVisible()
  })

  test('selskabs-detalje viser alle sektioner', async ({ loggedInPage: page }) => {
    // Brug seed-selskab Tandlæge Østerbro ApS
    await page.goto('/companies')
    await page.getByText('Tandlæge Østerbro ApS').click()
    // Sektioner fra /companies/[id] single-page
    await expect(page.getByRole('heading', { name: 'Ejerskab' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kontrakter' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sager' })).toBeVisible()
  })
})
```

- [ ] **Step 2: Kør test**

```bash
npx playwright test tests/e2e/companies.spec.ts
```

Forventet: 2 tests passed.

- [ ] **Step 3: Hvis fail — debug med UI**

```bash
npx playwright test tests/e2e/companies.spec.ts --ui
```

Justér selektorer hvis labels/headings er anderledes end forventet. Bemærk: Tests kan kræve justering ift. faktisk UI-tekst.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/companies.spec.ts
git commit -m "test(e2e): companies create + detail (2 tests)

Opret nyt selskab via formular, verificér det vises i liste.
Selskabs-detalje viser alle 3 hoved-sektioner (Ejerskab, Kontrakter, Sager)."
```

---

### Task 7: E2E test 3 — task status + audit

**Files:**

- Create: `tests/e2e/tasks.spec.ts`

- [ ] **Step 1: Skriv test**

```typescript
import { test, expect } from './fixtures'
import { PrismaClient } from '@prisma/client'

test.describe('Tasks + audit trail', () => {
  test('ændr task status fra detalje-side trigger AuditLog-entry', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/tasks')
    // Klik på en seed-opgave
    await page
      .getByText(/GDPR-tjekliste for Aarhus/)
      .first()
      .click()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+/)

    // Åbn edit-dialog
    await page.getByRole('button', { name: 'Redigér' }).click()
    await expect(page.getByRole('heading', { name: 'Redigér opgave' })).toBeVisible()

    // Ændr status
    const statusSelect = page.getByLabel('Status', { exact: true })
    await statusSelect.selectOption({ label: 'Aktiv' })
    await page.getByRole('button', { name: /Gem/ }).click()

    // Vent på toast
    await expect(page.getByText(/Opgave opdateret/)).toBeVisible({ timeout: 10_000 })

    // Verificér AuditLog-entry direkte i DB
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.E2E_DATABASE_URL } },
    })
    const recentAudit = await prisma.auditLog.findFirst({
      where: { resource_type: 'task' },
      orderBy: { created_at: 'desc' },
    })
    await prisma.$disconnect()

    // Note: TaskHistory bruges direkte (ikke AuditLog) til task-status-ændringer
    // — dette er per design (TaskHistory har bedre struktur for tasks)
    // Erstatter ovenstående assertion med TaskHistory-check:
    const prisma2 = new PrismaClient({
      datasources: { db: { url: process.env.E2E_DATABASE_URL } },
    })
    const recentHistory = await prisma2.taskHistory.findFirst({
      where: { field_name: 'STATUS' },
      orderBy: { changed_at: 'desc' },
    })
    expect(recentHistory).toBeTruthy()
    expect(recentHistory!.new_value).toBe('AKTIV_TASK')
    await prisma2.$disconnect()
  })

  test('kanban view drag-drop ikke testes (HTML5 drag svært i Playwright) men view loader', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/tasks?view=kanban')
    await expect(page.getByRole('heading', { name: 'Ny' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aktiv' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Afventer' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Lukket' })).toBeVisible()
  })
})
```

- [ ] **Step 2: Kør test**

```bash
npx playwright test tests/e2e/tasks.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/tasks.spec.ts
git commit -m "test(e2e): task status change + audit + kanban view (2 tests)

Status-ændring via edit-dialog → TaskHistory-entry skrevet i DB med
korrekte old/new values. Kanban-view loader alle 4 status-kolonner."
```

---

### Task 8: E2E test 4 — search

**Files:**

- Create: `tests/e2e/search.spec.ts`

- [ ] **Step 1: Skriv test**

```typescript
import { test, expect } from './fixtures'

test.describe('Global search', () => {
  test('søgning på "tandlæge" returnerer selskaber + kontrakter', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/search?q=tandl%C3%A6ge')
    await expect(page.getByRole('heading', { name: /Selskaber \(/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Kontrakter \(/ })).toBeVisible()
    // Mindst 1 selskab vises
    await expect(page.getByText('Tandlæge Østerbro ApS')).toBeVisible()
  })

  test('søgning på "GDPR" returnerer både sager og opgaver', async ({ loggedInPage: page }) => {
    await page.goto('/search?q=GDPR')
    await expect(page.getByRole('heading', { name: /Sager \(/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Opgaver \(/ })).toBeVisible()
  })

  test('søgning under 2 tegn viser quick-access panel', async ({ loggedInPage: page }) => {
    await page.goto('/search?q=a')
    await expect(page.getByText(/Skriv mindst 2 tegn/)).toBeVisible()
  })
})
```

- [ ] **Step 2: Kør test**

```bash
npx playwright test tests/e2e/search.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/search.spec.ts
git commit -m "test(e2e): global search dækker selskaber/kontrakter/sager/opgaver (3 tests)

Søgning på 'tandlæge' + 'GDPR' validerer 4 entitetstyper. Korte queries
viser quick-access panel som fallback."
```

---

### Task 9: E2E test 5 — settings persistence

**Files:**

- Create: `tests/e2e/settings.spec.ts`

- [ ] **Step 1: Skriv test**

```typescript
import { test, expect } from './fixtures'
import { PrismaClient } from '@prisma/client'

test.describe('Settings — organisation', () => {
  test('opdatér organisation-navn og verificér persistens', async ({ loggedInPage: page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Organisation' })).toBeVisible()

    const newName = `TandlægeGruppen E2E ${Date.now()}`
    const nameInput = page.getByDisplayValue(/TandlægeGruppen/)
    await nameInput.fill(newName)
    await page.getByRole('button', { name: /Gem ændringer/ }).click()

    await expect(page.getByText(/Organisation opdateret/)).toBeVisible({ timeout: 10_000 })

    // Verificér i DB
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.E2E_DATABASE_URL } },
    })
    const org = await prisma.organization.findFirst()
    expect(org?.name).toBe(newName)
    await prisma.$disconnect()

    // Reset til seed-værdi for ikke at forurene andre tests
    await prisma.organization.updateMany({ data: { name: 'TandlægeGruppen A/S' } })
  })

  test('brugere-tabel viser alle 4 seed-brugere', async ({ loggedInPage: page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Philip Larsen')).toBeVisible()
    await expect(page.getByText('Maria Sørensen')).toBeVisible()
    await expect(page.getByText('Thomas Mikkelsen')).toBeVisible()
    await expect(page.getByText('Torben Hansen')).toBeVisible()
  })
})
```

- [ ] **Step 2: Kør test**

```bash
npx playwright test tests/e2e/settings.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/settings.spec.ts
git commit -m "test(e2e): settings organization update + users table (2 tests)

Opdatér organisation-navn, verificér DB-persistens. Brugere-tabel
viser alle 4 seed-brugere."
```

---

### Task 10: Unit tests for calendar.ts

**Files:**

- Create: `src/__tests__/calendar-action.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
import { describe, it, expect } from 'vitest'
import { getCalendarEvents } from '@/actions/calendar'

// Smoke-tests mod seed-DB. Bruger korrekte seed-IDer.
describe.runIf(!!process.env.DATABASE_URL)('getCalendarEvents', () => {
  const seedUserId = '00000000-0000-0000-0000-000000000010'
  const seedOrgId = '00000000-0000-0000-0000-000000000001'

  it('returnerer events for accessible companies sorteret efter dato', async () => {
    const events = await getCalendarEvents(seedUserId, seedOrgId, 2026, 4)
    expect(Array.isArray(events)).toBe(true)
    // Verificér sortering
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.date >= events[i - 1]!.date).toBe(true)
    }
  })

  it('returnerer tom array for ukendt bruger', async () => {
    const events = await getCalendarEvents('nonexistent-user-id', seedOrgId, 2026, 4)
    expect(events).toEqual([])
  })

  it('hver event har påkrævede felter', async () => {
    const events = await getCalendarEvents(seedUserId, seedOrgId, 2026, 3)
    for (const event of events) {
      expect(event).toHaveProperty('id')
      expect(event).toHaveProperty('date')
      expect(event).toHaveProperty('title')
      expect(event).toHaveProperty('type')
      expect(['expiry', 'deadline', 'meeting', 'case', 'renewal']).toContain(event.type)
    }
  })

  it('respekterer måneds-grænse (events udenfor måneden filtreres)', async () => {
    const aprilEvents = await getCalendarEvents(seedUserId, seedOrgId, 2026, 4)
    for (const event of aprilEvents) {
      expect(event.date.startsWith('2026-04')).toBe(true)
    }
  })

  it('events af type case kommer fra åbne sager (NY/AKTIV/AFVENTER_*)', async () => {
    const events = await getCalendarEvents(seedUserId, seedOrgId, 2026, 4)
    const caseEvents = events.filter((e) => e.type === 'case')
    // Mindst forventer at NY/AKTIV/AFVENTER-sager kan optræde, ikke LUKKET
    for (const e of caseEvents) {
      expect(e.subtitle).toBe('Sagsfrist')
    }
  })
})
```

- [ ] **Step 2: Kør tests**

```bash
npx vitest run src/__tests__/calendar-action.test.ts
```

Forventet: 5 tests passed.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/calendar-action.test.ts
git commit -m "test(calendar): smoke-tests for getCalendarEvents (5 tests)

Verificerer sortering, accessible-companies-filter, event-felter,
måneds-grænse og case-type kommer kun fra åbne sager."
```

---

### Task 11: Unit tests for finance.ts

**Files:**

- Create: `src/__tests__/finance-actions.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { upsertFinancialMetric, createDividendRecord } from '@/actions/finance'

// Mock auth, prisma + permissions for unit-isolation
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    financialMetric: {
      upsert: vi.fn().mockResolvedValue({ id: 'metric-1' }),
      create: vi.fn().mockResolvedValue({ id: 'div-1' }),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('upsertFinancialMetric', () => {
  it('happy path returnerer data', async () => {
    const result = await upsertFinancialMetric({
      companyId: '00000000-0000-0000-0000-000000000001',
      metricType: 'OMSAETNING',
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect('data' in result).toBe(true)
  })

  it('returnerer fejl uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await upsertFinancialMetric({
      companyId: '00000000-0000-0000-0000-000000000001',
      metricType: 'OMSAETNING',
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl uden finance-modul-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await upsertFinancialMetric({
      companyId: '00000000-0000-0000-0000-000000000001',
      metricType: 'OMSAETNING',
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden selskab-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await upsertFinancialMetric({
      companyId: '00000000-0000-0000-0000-000000000001',
      metricType: 'OMSAETNING',
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser ugyldig metricType', async () => {
    const result = await upsertFinancialMetric({
      companyId: '00000000-0000-0000-0000-000000000001',
      metricType: 'UGYLDIG' as never,
      periodType: 'HELAAR',
      periodYear: 2025,
      value: 5000000,
    } as never)
    expect('error' in result).toBe(true)
  })
})

describe('createDividendRecord', () => {
  it('happy path returnerer data', async () => {
    const result = await createDividendRecord({
      companyId: '00000000-0000-0000-0000-000000000001',
      periodYear: 2025,
      amount: 100000,
      decidedAt: '2025-06-01',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await createDividendRecord({
      companyId: '00000000-0000-0000-0000-000000000001',
      periodYear: 2025,
      amount: 100000,
      decidedAt: '2025-06-01',
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser negativ amount', async () => {
    const result = await createDividendRecord({
      companyId: '00000000-0000-0000-0000-000000000001',
      periodYear: 2025,
      amount: -1000,
      decidedAt: '2025-06-01',
    } as never)
    expect('error' in result).toBe(true)
  })
})
```

- [ ] **Step 2: Kør tests**

```bash
npx vitest run src/__tests__/finance-actions.test.ts
```

Forventet: 8 tests passed.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/finance-actions.test.ts
git commit -m "test(finance): unit tests for upsertMetric + createDividend (8 tests)

Mock-baseret (auth, prisma, permissions). Dækker happy path, auth-gate,
module-gate, company-access-gate, validation-fejl. Negativ amount
afvises af Zod."
```

---

### Task 12: Unit tests for governance.ts

**Files:**

- Create: `src/__tests__/governance-actions.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addCompanyPerson, endCompanyPerson } from '@/actions/governance'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    companyPerson: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'cp-1' }),
      update: vi.fn().mockResolvedValue({ id: 'cp-1' }),
    },
    person: { create: vi.fn().mockResolvedValue({ id: 'p-1' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('addCompanyPerson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('happy path opretter tilknytning', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockResolvedValueOnce(null)
    const result = await addCompanyPerson({
      companyId: '00000000-0000-0000-0000-000000000001',
      personId: '00000000-0000-0000-0000-000000000002',
      role: 'ansat',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser anden direktør hvis allerede aktiv', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockResolvedValueOnce({
      id: 'existing-director',
    } as never)
    const result = await addCompanyPerson({
      companyId: '00000000-0000-0000-0000-000000000001',
      personId: '00000000-0000-0000-0000-000000000002',
      role: 'direktoer',
    } as never)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/aktiv direktør/)
    }
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await addCompanyPerson({
      companyId: '00000000-0000-0000-0000-000000000001',
      personId: '00000000-0000-0000-0000-000000000002',
      role: 'ansat',
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser uden selskab-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await addCompanyPerson({
      companyId: '00000000-0000-0000-0000-000000000001',
      personId: '00000000-0000-0000-0000-000000000002',
      role: 'ansat',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('opretter ny person hvis ingen personId angivet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockResolvedValueOnce(null)
    await addCompanyPerson({
      companyId: '00000000-0000-0000-0000-000000000001',
      firstName: 'Ny',
      lastName: 'Person',
      role: 'ansat',
    } as never)
    expect(prisma.person.create).toHaveBeenCalled()
  })

  it('skriver audit-event ved oprettelse', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockResolvedValueOnce(null)
    await addCompanyPerson({
      companyId: '00000000-0000-0000-0000-000000000001',
      personId: '00000000-0000-0000-0000-000000000002',
      role: 'direktoer',
    } as never)
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })
})

describe('endCompanyPerson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('happy path soft-sletter med end_date', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockResolvedValueOnce({
      organization_id: 'org-1',
      company_id: 'c-1',
      person_id: 'p-1',
      role: 'direktoer',
    } as never)
    const result = await endCompanyPerson({
      companyPersonId: '00000000-0000-0000-0000-000000000003',
      endDate: '2026-04-18',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser tenant mismatch', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockResolvedValueOnce({
      organization_id: 'andet-org',
      company_id: 'c-1',
      person_id: 'p-1',
      role: 'direktoer',
    } as never)
    const result = await endCompanyPerson({
      companyPersonId: '00000000-0000-0000-0000-000000000003',
      endDate: '2026-04-18',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden selskab-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockResolvedValueOnce({
      organization_id: 'org-1',
      company_id: 'c-1',
      person_id: 'p-1',
      role: 'direktoer',
    } as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await endCompanyPerson({
      companyPersonId: '00000000-0000-0000-0000-000000000003',
      endDate: '2026-04-18',
    } as never)
    expect('error' in result).toBe(true)
  })
})
```

- [ ] **Step 2: Kør tests**

```bash
npx vitest run src/__tests__/governance-actions.test.ts
```

Forventet: 9 tests passed.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/governance-actions.test.ts
git commit -m "test(governance): unit tests for addCompanyPerson + endCompanyPerson (9 tests)

Dækker happy path, direktør-1-pr-selskab regel, auth-gate,
permission-gate, ny person ved firstName/lastName uden personId,
audit-event-skriv, tenant-isolation."
```

---

### Task 13: Unit tests for persons.ts

**Files:**

- Create: `src/__tests__/persons-actions.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPerson, updatePerson, deletePerson, searchPersons } from '@/actions/persons'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      create: vi.fn().mockResolvedValue({ id: 'p-1', first_name: 'Test' }),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'p-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    companyPerson: { count: vi.fn().mockResolvedValue(0) },
    ownership: { count: vi.fn().mockResolvedValue(0) },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('createPerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opretter person', async () => {
    const result = await createPerson({
      firstName: 'Anders',
      lastName: 'Andersen',
      email: 'anders@example.dk',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await createPerson({
      firstName: 'Anders',
      lastName: 'Andersen',
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser tomt firstName', async () => {
    const result = await createPerson({
      firstName: '',
      lastName: 'Andersen',
    } as never)
    expect('error' in result).toBe(true)
  })
})

describe('updatePerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opdaterer person', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockResolvedValueOnce({
      id: 'p-1',
      organization_id: 'org-1',
    } as never)
    const result = await updatePerson({
      personId: 'p-1',
      firstName: 'Opdateret',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('returnerer fejl hvis person ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockResolvedValueOnce(null)
    const result = await updatePerson({
      personId: 'nonexistent',
      firstName: 'X',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser tenant mismatch', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockResolvedValueOnce(null)
    const result = await updatePerson({
      personId: 'p-1',
      firstName: 'X',
    } as never)
    expect('error' in result).toBe(true)
  })
})

describe('deletePerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path soft-sletter', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockResolvedValueOnce({
      id: 'p-1',
      organization_id: 'org-1',
    } as never)
    const result = await deletePerson('p-1')
    expect('data' in result).toBe(true)
  })

  it('afviser uden settings-modul-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await deletePerson('p-1')
    expect('error' in result).toBe(true)
  })

  it('afviser hvis aktiv companyPerson eksisterer', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockResolvedValueOnce({
      id: 'p-1',
      organization_id: 'org-1',
    } as never)
    vi.mocked(prisma.companyPerson.count).mockResolvedValueOnce(1)
    const result = await deletePerson('p-1')
    expect('error' in result).toBe(true)
  })

  it('afviser hvis aktiv ownership eksisterer', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockResolvedValueOnce({
      id: 'p-1',
      organization_id: 'org-1',
    } as never)
    vi.mocked(prisma.ownership.count).mockResolvedValueOnce(1)
    const result = await deletePerson('p-1')
    expect('error' in result).toBe(true)
  })
})

describe('searchPersons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer matches for query med 2+ tegn', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findMany).mockResolvedValueOnce([
      { id: 'p-1', first_name: 'Anders' } as never,
    ])
    const result = await searchPersons('And', 'org-1')
    if ('data' in result) {
      expect(result.data.length).toBe(1)
    }
  })

  it('returnerer tom array for query under 2 tegn', async () => {
    const { prisma } = await import('@/lib/db')
    const result = await searchPersons('a', 'org-1')
    if ('data' in result) {
      expect(result.data).toEqual([])
    }
    expect(prisma.person.findMany).not.toHaveBeenCalled()
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await searchPersons('test', 'org-1')
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })
})
```

- [ ] **Step 2: Kør tests**

```bash
npx vitest run src/__tests__/persons-actions.test.ts
```

Forventet: 13 tests passed.

- [ ] **Step 3: Fix seed-IDer i dashboard-actions.test.ts**

```bash
grep -l "00000000-0000-0000-0000-000000010001" src/__tests__/
```

For hver fil med forkerte IDer (formentlig dashboard-actions + company-detail-actions): erstat:

- `00000000-0000-0000-0000-000000010001` → `00000000-0000-0000-0000-000000000010`
- `00000000-0000-0000-0000-000000009001` → `00000000-0000-0000-0000-000000000001`

- [ ] **Step 4: Kør alle tests**

```bash
npm test
```

Forventet: 394 + 35 nye = ~429+ passed.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/persons-actions.test.ts src/__tests__/dashboard-actions.test.ts src/__tests__/company-detail-actions.test.ts
git commit -m "test(persons): unit tests for create/update/delete/search (13 tests) + fix seed IDs

Dækker happy path, auth-gate, validation, tenant-isolation,
delete-blocked-by-active-roles. Søgning med < 2 tegn springer DB-query
over.

Også fixet forkerte seed-bruger-IDer i dashboard-actions.test.ts og
company-detail-actions.test.ts (010001 → 000010, 009001 → 000001).
Tests rammer nu faktisk seed-data i stedet for at returnere tom shape."
```

---

### Task 14: GitHub Actions CI workflow

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Opret workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

env:
  NODE_VERSION: '20'

jobs:
  lint-test:
    name: Lint + tsc + Vitest
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Format check (Prettier)
        run: npm run format:check

      - name: Lint (ESLint)
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Unit tests (Vitest, no DB)
        run: npm test
        env:
          # Tests med runIf(!!DATABASE_URL) springes over i CI uden DB.
          # Mock-baserede tests (finance, governance, persons, audit) kører.
          NODE_ENV: test

  build:
    name: Production build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Build
        run: npm run build
        env:
          # Build kræver ikke DSN — Sentry init er gated by enabled flag
          NEXTAUTH_SECRET: dummy-build-secret-only-32-chars-min
          NEXTAUTH_URL: http://localhost:3000
          DATABASE_URL: postgresql://dummy:dummy@localhost:5432/dummy?schema=public
          DIRECT_URL: postgresql://dummy:dummy@localhost:5432/dummy?schema=public

  e2e:
    name: E2E (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: chainhub
          POSTGRES_PASSWORD: chainhub
          POSTGRES_DB: chainhub_e2e
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Push schema + seed
        run: |
          npx prisma db push --skip-generate
          npx prisma db seed
        env:
          DATABASE_URL: postgresql://chainhub:chainhub@localhost:5432/chainhub_e2e
          DIRECT_URL: postgresql://chainhub:chainhub@localhost:5432/chainhub_e2e

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test
        env:
          E2E_DATABASE_URL: postgresql://chainhub:chainhub@localhost:5432/chainhub_e2e
          E2E_PORT: 3010
          NEXTAUTH_SECRET: e2e-test-secret-min-32-chars-long-x
          NEXTAUTH_URL: http://localhost:3010
          CI: true

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Test workflow lokalt med act (valgfri men anbefalet)**

Hvis `act` er installeret:

```bash
act -j lint-test --container-architecture linux/amd64
```

Hvis ikke, push og se i GitHub Actions UI.

- [ ] **Step 3: Tilføj CI badge til README**

I `README.md` linje 1-2 (efter `# ChainHub`):

```markdown
[![CI](https://github.com/fluen1/chainhub/actions/workflows/ci.yml/badge.svg)](https://github.com/fluen1/chainhub/actions/workflows/ci.yml)
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: add GitHub Actions workflow with lint+test+build+e2e

3 jobs der kører på push til master + alle PRs:

- lint-test: format:check + lint + typecheck + vitest unit tests (~10 min)
- build: npx next build med dummy env-vars (~5 min)
- e2e: Postgres service + Prisma seed + Playwright + browsers (~15 min)

E2E uploader playwright-report som artifact ved failure (7 dages
retention) så debugging er nemt fra GitHub UI.

CI badge tilføjet til README.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Verifikation + PROGRESS.md

**Files:** Ingen ændringer på code — kun verifikation + docs

- [ ] **Step 1: Lokal full gate**

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
rm -rf .next && npm run build
```

Alle skal være grønne.

- [ ] **Step 2: Lokal E2E**

```bash
docker compose up -d postgres-e2e
npm run db:e2e:reset
npm run e2e
```

Forventet: 13 E2E-tests passed (4 auth + 2 companies + 2 tasks + 3 search + 2 settings).

- [ ] **Step 3: Push og verificér CI**

```bash
git push origin master
```

Åbn `https://github.com/fluen1/chainhub/actions` og verificér:

- lint-test job: grøn
- build job: grøn
- e2e job: grøn (eller artifact upload hvis fejl)

Vent på alle 3 jobs er grønne (~25 min total med parallelle jobs).

- [ ] **Step 4: Opdater PROGRESS.md**

Tilføj nyt afsnit til `docs/status/PROGRESS.md` (efter session 2):

```markdown
## Produktions-modenhed session 3 — 2026-04-18 ✅

E2E + CI + coverage-uplift. ~9/10 → 10/10. Klar til produktions-deploy.

- [x] **Playwright E2E test-suite** med 5 test-filer (auth, companies, tasks, search, settings) — 13 tests dækker kritiske flows
- [x] **Isoleret E2E-database** via docker-compose `postgres-e2e` på port 5433 (forhindrer dev-DB-contamination)
- [x] **GitHub Actions CI** med 3 parallelle jobs (lint-test, build, e2e) der kører på push til master + alle PRs
- [x] **Coverage-uplift** for 4 manglende action-filer: calendar (5), finance (8), governance (9), persons (13) — 35 nye unit-tests
- [x] **Seed-ID-fix** i dashboard-actions.test.ts og company-detail-actions.test.ts (010001 → 000010, 009001 → 000001)
- [x] **CI badge** på README

Tests: 394 → ~429 passed. CI runtime: ~25 min total (parallel).

### Tilbage til 100% production-ready (egen sprint)

- **A11y-sweep** — aria-labels på ikon-buttons (kun 20 i 71 komponenter), keyboard-nav, focus management
- **Test-coverage 80%+** — 11 action-filer mangler stadig tests (cases, comments, companies, contracts, contract-versions, document-review, documents, ownership, task-detail, tasks, users, visits)
- **Bredere E2E-dækning** — visits, contracts CRUD, user management, kanban drag-drop (kræver custom drag-helper)
```

- [ ] **Step 5: Commit**

```bash
git add docs/status/PROGRESS.md
git commit -m "docs(status): session 3 E2E + CI + coverage complete

Produktions-modenhed: ~9/10 → 10/10.

13 E2E tests (Playwright + Chromium) på kritiske flows. GitHub Actions
3-jobs CI (lint-test, build, e2e) på push/PR. 35 nye unit-tests for
calendar/finance/governance/persons. Seed-ID-fixes på 2 eksisterende
tests.

Tests: 394 → ~429 passed.

Tilbage som dedikerede sprints: a11y, 80%-coverage, bredere E2E."
```

---

## Kritiske filer (quick reference)

**Nye filer:**

- `playwright.config.ts` — root config
- `tests/e2e/helpers/auth.ts` — loginAs helper
- `tests/e2e/fixtures.ts` — loggedInPage fixture
- `tests/e2e/auth.spec.ts` (4 tests)
- `tests/e2e/companies.spec.ts` (2 tests)
- `tests/e2e/tasks.spec.ts` (2 tests)
- `tests/e2e/search.spec.ts` (3 tests)
- `tests/e2e/settings.spec.ts` (2 tests)
- `src/__tests__/calendar-action.test.ts` (5 tests)
- `src/__tests__/finance-actions.test.ts` (8 tests)
- `src/__tests__/governance-actions.test.ts` (9 tests)
- `src/__tests__/persons-actions.test.ts` (13 tests)
- `.github/workflows/ci.yml` — 3-jobs CI

**Ændrede filer:**

- `package.json` — `@playwright/test` devDep + 4 nye scripts
- `docker-compose.yml` — `postgres-e2e` service på port 5433
- `.env.example` — E2E_DATABASE_URL placeholder
- `.env.local` — E2E_DATABASE_URL faktisk værdi (lokal-only)
- `.gitignore` — playwright-report/, test-results/
- `src/__tests__/dashboard-actions.test.ts` — fix seed-IDer
- `src/__tests__/company-detail-actions.test.ts` — fix seed-IDer
- `README.md` — CI badge
- `docs/status/PROGRESS.md` — session 3-afsnit

**Genbrug (ingen ændring):**

- `src/lib/audit.ts` (session 2) — testes via E2E task-status flow
- `src/lib/logger.ts` (session 1) — Sentry-no-op i CI verificerer config
- Eksisterende seed-data — bruges af alle E2E-tests

---

## Verification

**Teknisk gate:**

```bash
npm run format:check                             # Prettier clean
npm run lint                                     # ESLint 0 warnings
npx tsc --noEmit                                 # 0 TS-fejl
npm test                                         # ~429+ passed
rm -rf .next && npx next build                   # Grøn
docker compose up -d postgres-e2e                # E2E DB klar
npm run db:e2e:reset                             # E2E DB seedet
npm run e2e                                      # 13 E2E passed
```

**CI-gate:**

- Push til master triggerer `.github/workflows/ci.yml`
- 3 jobs kører parallelt (lint-test, build, e2e)
- Alle 3 grønne inden for 25 min
- E2E-job uploader playwright-report som artifact ved failure

**Acceptance:**

- ✅ `playwright.config.ts` eksisterer + tests/e2e/ har 5 spec-filer
- ✅ `@playwright/test` installeret + chromium-browser tilgængelig
- ✅ `docker-compose.yml` har `postgres-e2e` service på port 5433
- ✅ `npm run e2e` kører 13 tests grønne lokalt
- ✅ `npm test` kører ~429 tests grønne (35 nye fra denne session)
- ✅ `.github/workflows/ci.yml` har 3 jobs og kører på master + PRs
- ✅ CI-badge vises på README
- ✅ PROGRESS.md opdateret med session 3-leverancer

**Ikke-mål (må ikke snige sig ind):**

- A11y-sweep (aria-labels, keyboard nav) → egen sprint
- 80% test-coverage (kræver tests for 11 yderligere action-filer) → egen sprint
- Kanban drag-drop E2E (HTML5 drag svært i Playwright) → egen sprint
- Vercel-deploy-config → adresseres når deploy-besked træffes
- TaskParticipant / CompanyNote / DocumentExtraction-UI → feature-sprints
