# ChainHub Complete Maturity 10/10 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all remaining gaps to reach 10/10 production maturity — infrastructure hardening, test coverage, and deployment pipeline.

**Architecture:** 5 executable tasks (Group A+B) that can be done now without design ambiguity, followed by 5 larger items (Group C+D+E) that each require their own brainstorming → spec → plan cycle.

**Tech Stack:** Next.js 16, Upstash Redis, Playwright, Vercel

**Spec:** Gap analysis from conversation (2026-05-25)

---

# Group A: Infrastructure & Security (executable now)

## Task 1: Mobile Navigation Polish

The sidebar already has a drawer pattern in `src/components/layout/b-shell.tsx` (lines 86-120) with hamburger button, backdrop, focus trap, and route-change close. The audit flagged "0% mobile" but code exists. This task verifies it works and fixes any issues.

**Files:**

- Modify: `src/components/layout/b-shell.tsx`
- Modify: `src/components/layout/b-sidebar.tsx`
- Test: `tests/e2e/a11y.spec.ts` (add mobile viewport test)

- [ ] **Step 1: Verify mobile nav in browser**

Start dev server and test at 375px width (iPhone SE):

```bash
npm run dev
```

Open browser DevTools → toggle device toolbar → iPhone SE (375×667). Check:

- Does hamburger button appear?
- Does clicking it open the drawer?
- Does clicking a nav item close the drawer and navigate?
- Does Escape close the drawer?
- Is content readable without horizontal scroll?

Document any issues found.

- [ ] **Step 2: Fix identified issues**

Common issues to check and fix:

- Tables/cards overflowing on small screens → add `overflow-x-auto` wrappers
- Text truncation on list pages → verify `truncate` classes are present
- Modal/dialog sizing → check modals use `max-w-[95vw]` on mobile
- Touch targets → buttons should be at least 44×44px

For each page under `src/app/(dashboard)/`, check the main content component for mobile overflow. Add responsive classes where needed:

```tsx
// Wrap tables that overflow
<div className="overflow-x-auto">
  <table>...</table>
</div>
```

- [ ] **Step 3: Add E2E mobile viewport test**

Add to `tests/e2e/a11y.spec.ts`:

```typescript
test('mobil navigation virker på 375px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await loginAs(page)

  // Sidebar should be hidden
  const sidebar = page.locator('aside')
  await expect(sidebar).not.toBeVisible()

  // Hamburger should be visible
  const hamburger = page.getByRole('button', { name: /menu|navigation/i })
  await expect(hamburger).toBeVisible()

  // Click hamburger opens drawer
  await hamburger.click()
  await expect(sidebar).toBeVisible()

  // Click nav item closes drawer and navigates
  await page.getByRole('link', { name: /selskaber/i }).click()
  await expect(page).toHaveURL(/companies/)
  await expect(sidebar).not.toBeVisible()
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/app/ tests/e2e/
git commit -m "fix(mobile): verificér og polish mobilnavigation"
```

---

## Task 2: CSP Headers + Health Endpoint

**Files:**

- Modify: `next.config.mjs`
- Create: `src/app/api/health/route.ts`
- Create: `src/__tests__/api/health.test.ts`

- [ ] **Step 1: Write health endpoint test**

```typescript
// src/__tests__/api/health.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
  },
}))

import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('returnerer 200 med status ok', async () => {
    const response = await GET()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/__tests__/api/health.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement health endpoint**

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json(
      { status: 'error', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run src/__tests__/api/health.test.ts`
Expected: PASS

- [ ] **Step 5: Add CSP headers to next.config.mjs**

Add `headers()` function inside `nextConfig`:

```javascript
// next.config.mjs — add inside nextConfig object:
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
            "font-src 'self'",
            "connect-src 'self' https://*.sentry.io https://*.supabase.co",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
  ]
},
```

Note: `'unsafe-eval'` is needed for Next.js dev mode. In production, consider removing it and using nonces. `'unsafe-inline'` is needed for Tailwind's style injection.

- [ ] **Step 6: Verify build**

Run: `npx next build`
Expected: Build succeeds. Check that headers appear in response:

```bash
curl -I http://localhost:3000/login 2>/dev/null | grep -i "content-security-policy\|x-frame"
```

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`

- [ ] **Step 8: Commit**

```bash
git add next.config.mjs src/app/api/health/ src/__tests__/api/health.test.ts
git commit -m "feat(infra): CSP headers + /api/health endpoint"
```

---

## Task 3: Redis-Backed Rate Limiting (Upstash)

**Files:**

- Modify: `package.json` (add `@upstash/redis`, `@upstash/ratelimit`)
- Create: `src/lib/auth/redis-rate-limit.ts`
- Modify: `src/lib/auth/login-rate-limit.ts` (swap backend)
- Modify: `src/__tests__/auth/login-rate-limit.test.ts` (mock Redis)
- Modify: `src/lib/env.ts` (add optional Redis env vars)

- [ ] **Step 1: Install Upstash packages**

```bash
npm install @upstash/redis @upstash/ratelimit
```

- [ ] **Step 2: Add Redis env vars to env.ts**

Add to the Zod schema in `src/lib/env.ts`:

```typescript
UPSTASH_REDIS_REST_URL: z.string().url().optional(),
UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
```

- [ ] **Step 3: Write failing test**

```typescript
// src/__tests__/auth/login-rate-limit.test.ts
// Update existing tests to work with both in-memory and Redis backends.
// The tests should mock @upstash/ratelimit when Redis env vars are set.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Redis as unavailable — forces in-memory fallback
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn(),
}))

import {
  isLoginRateLimited,
  recordFailedLoginAttempt,
  resetLoginRateLimiter,
} from '@/lib/auth/login-rate-limit'

describe('login rate limit (in-memory fallback)', () => {
  beforeEach(() => {
    resetLoginRateLimiter()
  })

  // ... keep all existing tests unchanged
})
```

- [ ] **Step 4: Implement Redis-backed rate limiter**

```typescript
// src/lib/auth/redis-rate-limit.ts
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

let ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: 'chainhub:login',
  })
  return ratelimit
}

export async function isRedisRateLimited(
  email: string
): Promise<{ limited: boolean; retryAfterMs?: number } | null> {
  const rl = getRatelimit()
  if (!rl) return null // fallback to in-memory

  const result = await rl.limit(email.trim().toLowerCase())
  if (result.success) return { limited: false }
  return {
    limited: true,
    retryAfterMs: Math.max(0, result.reset - Date.now()),
  }
}

export async function recordRedisFailedAttempt(email: string): Promise<boolean> {
  const rl = getRatelimit()
  if (!rl) return false // fallback to in-memory
  await rl.limit(email.trim().toLowerCase())
  return true
}
```

- [ ] **Step 5: Update login-rate-limit.ts to try Redis first**

Modify `src/lib/auth/login-rate-limit.ts` to attempt Redis, falling back to in-memory:

```typescript
import { isRedisRateLimited, recordRedisFailedAttempt } from './redis-rate-limit'

export async function isLoginRateLimited(
  email: string
): Promise<{ limited: boolean; retryAfterMs?: number }> {
  // Try Redis first
  const redisResult = await isRedisRateLimited(email).catch(() => null)
  if (redisResult !== null) return redisResult

  // Fallback to in-memory
  // ... existing in-memory logic unchanged
}

export async function recordFailedLoginAttempt(email: string): Promise<void> {
  const used = await recordRedisFailedAttempt(email).catch(() => false)
  if (used) return

  // Fallback to in-memory
  // ... existing in-memory logic unchanged
}
```

Note: `isLoginRateLimited` and `recordFailedLoginAttempt` change from sync to async. Update the caller in `src/lib/auth/index.ts` to `await` both calls.

- [ ] **Step 6: Update auth/index.ts caller**

In `src/lib/auth/index.ts`, the `authorize` function already uses `async`, so just add `await`:

```typescript
// Change:
const rateCheck = isLoginRateLimited(normalizedEmail)
// To:
const rateCheck = await isLoginRateLimited(normalizedEmail)

// Change:
recordFailedLoginAttempt(normalizedEmail)
// To:
await recordFailedLoginAttempt(normalizedEmail)
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All pass. In-memory fallback tests still work because Redis mocks return null.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/auth/ src/lib/env.ts src/__tests__/
git commit -m "feat(security): Redis-backed rate-limiting med in-memory fallback"
```

---

# Group B: Testing & Deployment

## Task 4: E2E CRUD Flows

**Files:**

- Create: `tests/e2e/companies-crud.spec.ts`
- Create: `tests/e2e/contracts-crud.spec.ts`
- Create: `tests/e2e/cases-crud.spec.ts`
- Create: `tests/e2e/tasks-crud.spec.ts`
- Create: `tests/e2e/persons-crud.spec.ts`

- [ ] **Step 1: Write companies CRUD E2E test**

```typescript
// tests/e2e/companies-crud.spec.ts
import { test, expect } from './fixtures'
import { loginAs } from './helpers/auth'

test.describe('Companies CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('opret nyt selskab', async ({ page }) => {
    await page.goto('/companies')
    await page.getByRole('link', { name: /opret selskab/i }).click()
    await expect(page).toHaveURL(/companies\/new/)

    await page.getByLabel(/navn/i).fill('Test Selskab ApS')
    await page.getByLabel(/cvr/i).fill('12345678')
    // Fill remaining required fields based on form
    await page.getByRole('button', { name: /opret/i }).click()

    // Should redirect to company detail
    await expect(page).toHaveURL(/companies\//)
    await expect(page.getByText('Test Selskab ApS')).toBeVisible()
  })

  test('redigér selskab', async ({ page }) => {
    await page.goto('/companies')
    // Click first company
    await page.getByRole('row').nth(1).click()
    await page.getByRole('button', { name: /redigér/i }).click()

    // Change name
    const nameField = page.getByLabel(/navn/i)
    await nameField.clear()
    await nameField.fill('Opdateret Selskab')
    await page.getByRole('button', { name: /gem/i }).click()

    await expect(page.getByText('Opdateret Selskab')).toBeVisible()
  })
})
```

- [ ] **Step 2: Write tasks CRUD E2E test**

```typescript
// tests/e2e/tasks-crud.spec.ts
import { test, expect } from './fixtures'
import { loginAs } from './helpers/auth'

test.describe('Tasks CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('opret ny opgave', async ({ page }) => {
    await page.goto('/tasks')
    await page.getByRole('link', { name: /opret opgave/i }).click()

    await page.getByLabel(/titel/i).fill('Test Opgave')
    await page.getByLabel(/type/i).selectOption({ label: 'Admin' })
    await page.getByRole('button', { name: /opret/i }).click()

    await expect(page.getByText('Test Opgave')).toBeVisible()
  })

  test('markér opgave som lukket', async ({ page }) => {
    await page.goto('/tasks')
    await page.getByText('Test Opgave').click()

    await page.getByRole('button', { name: /status/i }).click()
    await page.getByText(/lukket/i).click()

    await expect(page.getByText(/lukket/i)).toBeVisible()
  })
})
```

- [ ] **Step 3: Write contracts, cases, persons CRUD tests**

Follow same pattern for each module. Focus on:

- **Contracts:** Create with type selection, verify status badges
- **Cases:** Create case linked to company, add comment
- **Persons:** Create person, link to company

Read the actual create-forms in the app to match exact field labels and button texts.

- [ ] **Step 4: Run E2E tests**

```bash
npx playwright test tests/e2e/companies-crud.spec.ts
npx playwright test tests/e2e/tasks-crud.spec.ts
# etc.
```

Fix any failures — the exact form field labels and selectors may need adjustment based on actual UI.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/
git commit -m "test(e2e): CRUD-flows for companies, contracts, cases, tasks, persons"
```

---

## Task 5: CD Pipeline (Vercel)

**Files:**

- Create: `vercel.json`
- Modify: `.github/workflows/ci.yml` (add deploy step)

- [ ] **Step 1: Create vercel.json**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["fra1"],
  "headers": [
    {
      "source": "/api/health",
      "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store" }]
    }
  ]
}
```

- [ ] **Step 2: Link Vercel project**

This requires the user to run interactively:

```bash
! npx vercel link
```

Select the existing Vercel project or create a new one.

- [ ] **Step 3: Add deploy step to CI**

Add to `.github/workflows/ci.yml` after the existing `e2e` job:

```yaml
deploy:
  needs: [lint-test, build, e2e]
  if: github.ref == 'refs/heads/master'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to Vercel
      run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
      env:
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

- [ ] **Step 4: Document required secrets**

The user needs to set these GitHub secrets:

- `VERCEL_TOKEN` — from Vercel account settings
- `VERCEL_ORG_ID` — from `.vercel/project.json` after linking
- `VERCEL_PROJECT_ID` — from `.vercel/project.json` after linking

- [ ] **Step 5: Commit**

```bash
git add vercel.json .github/workflows/ci.yml
git commit -m "feat(infra): Vercel CD pipeline — auto-deploy fra master"
```

---

# Group C: Major Migrations (kræver separat brainstorming)

## Task 6: next-auth v5 Migration

**Scope:** next-auth v4 → v5 er en breaking API-ændring der påvirker:

- Session/JWT callback API
- Middleware auth pattern
- `getServerSession()` → `auth()` API (allerede delvist forberedt)
- Provider configuration
- Database adapter format

**Anbefaling:** Kør `superpowers:brainstorming` med scope "next-auth v4 → v5 migration" for at identificere alle breaking changes i kontekst af ChainHub's auth-setup. Prisma 7 bør planlægges sammen, da begge kræver ESM-omstilling.

---

## Task 7: Prisma 7 + ESM Migration

**Scope:** Kræver:

- `"type": "module"` i package.json
- Driver adapter (`@prisma/adapter-pg`)
- Generator change (`prisma-client-js` → `prisma-client`)
- 25+ import-sti ændringer
- ESM-kompatibilitet i alle config-filer

**Anbefaling:** Planlæg sammen med Task 6 (next-auth v5). Begge er store migrationer der påvirker hele codebasen og bør have et samlet testplan.

---

# Group D: Features (kræver design først)

## Task 8: Analytics + Audit Log UI

**Scope:**

- Produkt-analytics integration (Posthog eller Mixpanel)
- UI til at browse audit-log tabellen (allerede i DB)
- Web Vitals dashboard via Sentry

**Anbefaling:** Kør `superpowers:brainstorming` for at beslutte analytics-provider og audit-log UI-design.

---

## Task 9: Onboarding + Økonomi Features

**Scope:**

- Multi-tenant self-service onboarding flow (~50% implementeret)
- Økonomi-modul: grafer, trend-analyse, budget vs. aktuel (~70% implementeret)

**Anbefaling:** Disse er feature-udvikling, ikke hardening. Kør brainstorming for hver som separate Sprint 8+ features.

---

# Group E: Validation

## Task 10: Load Testing

**Scope:**

- k6 eller Artillery load test mod staging
- Verificér at 50-lokation kæde med 20 samtidige brugere ikke giver timeout
- Test de paginerede endpoints (tasks, persons, contracts)

**Anbefaling:** Kør EFTER alle andre opgaver er færdige. Kræver staging-environment (Task 5) og data-seeding for 50 lokationer.

---

# Execution Order

```
Task 1 (Mobile)  ─┐
Task 2 (CSP)     ─┼─ Parallel (uafhængige)
Task 3 (Redis)   ─┘
          │
Task 4 (E2E)     ─── After 1-3 (tests should cover new features)
Task 5 (CD)      ─── After 4 (CI must pass before auto-deploy)
          │
Task 6+7 (Auth+Prisma) ── Separate brainstorming session
Task 8 (Analytics)      ── Separate brainstorming session
Task 9 (Features)       ── Separate brainstorming session
Task 10 (Load test)     ── After everything else
```
