# Goal 2: Hardening — Sikkerhed + Fejlhåndtering + Test → 10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Løft Sikkerhed (8.5→10), Fejlhåndtering (8.5→10) og Test (8→10) til 10/10.

**Architecture:** Middleware-dækning udvides med /visits. CSP strammes med manglende domæner (Stripe, PostHog). withRetry-utility tilføjes til eksterne service-kald. Pino-logs sendes som Sentry breadcrumbs. CI e2e-job får db:e2e:reset. Visits-modul og billing-flow får testdækning.

**Tech Stack:** Next.js middleware, CSP headers, Pino, Sentry, Vitest, Playwright, GitHub Actions

**Allerede gjort (verificeret i codebase):**

- ✅ 2C error.tsx /calendar — Eksisterer allerede med ErrorBoundaryPage
- ✅ Sentry dual-write — captureError() i logger.ts sender fejl til både Pino og Sentry

---

### Task 1: Middleware /visits matcher + CSP-tightening

**Files:**

- Modify: `src/middleware.ts`
- Modify: `next.config.mjs`

- [ ] **Step 1: Tilføj /visits til middleware matcher**

I `src/middleware.ts`, tilføj `/visits/:path*` til matcher-arrayet:

```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/companies/:path*',
    '/contracts/:path*',
    '/cases/:path*',
    '/tasks/:path*',
    '/persons/:path*',
    '/documents/:path*',
    '/settings/:path*',
    '/billing/:path*',
    '/calendar/:path*',
    '/search/:path*',
    '/visits/:path*',
  ],
}
```

- [ ] **Step 2: Stram CSP i next.config.mjs**

Tilføj manglende domæner til connect-src og frame-src. Next.js 14 App Router kræver `'unsafe-inline'` for hydration-scripts — dette er en framework-begrænsning, ikke en designfejl.

```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://js.stripe.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
            "font-src 'self'",
            "connect-src 'self' https://*.sentry.io https://*.supabase.co https://api.stripe.com https://*.posthog.com https://us.i.posthog.com",
            "frame-src https://js.stripe.com https://hooks.stripe.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
          ].join('; '),
        },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ]
},
```

- [ ] **Step 3: Kør build for at verificere**

Run: `npx next build`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts next.config.mjs
git commit -m "sec: tilføj /visits til middleware + stram CSP headers"
```

---

### Task 2: withRetry utility

**Files:**

- Create: `src/lib/retry.ts`
- Create: `src/__tests__/lib/retry.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
// src/__tests__/lib/retry.test.ts
import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '@/lib/retry'

describe('withRetry', () => {
  it('returnerer resultat ved første succesfulde kald', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('prøver igen ved fejl og lykkes på andet forsøg', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('kaster fejl efter max forsøg', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent'))
    await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })).rejects.toThrow('persistent')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('bruger eksponentiel backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok')

    const start = Date.now()
    await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })
    const elapsed = Date.now() - start

    // 10ms + 20ms = mindst 25ms (med jitter)
    expect(elapsed).toBeGreaterThanOrEqual(20)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('stopper retry ved shouldRetry=false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'))
    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        initialDelayMs: 1,
        shouldRetry: (err) => !(err instanceof Error && err.message === 'fatal'),
      })
    ).rejects.toThrow('fatal')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Kør tests — de fejler**

Run: `npx vitest run src/__tests__/lib/retry.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implementér withRetry**

```typescript
// src/lib/retry.ts
interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  shouldRetry?: (error: unknown) => boolean
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const { maxAttempts = 3, initialDelayMs = 500, shouldRetry } = options ?? {}

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (shouldRetry && !shouldRetry(err)) throw err
      if (attempt === maxAttempts) throw err
      const delay = initialDelayMs * Math.pow(2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}
```

- [ ] **Step 4: Kør tests**

Run: `npx vitest run src/__tests__/lib/retry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/retry.ts src/__tests__/lib/retry.test.ts
git commit -m "feat: withRetry utility til ekstern service-kald med eksponentiel backoff"
```

---

### Task 3: Pino → Sentry breadcrumbs

**Files:**

- Modify: `src/lib/logger.ts`

- [ ] **Step 1: Tilføj Sentry breadcrumb i createLogger**

I `src/lib/logger.ts`, tilføj en Pino-hook der sender alle log-entries som Sentry breadcrumbs:

Tilføj i `createLogger` funktionen og root `logger`:

```typescript
import pino from 'pino'
import * as Sentry from '@sentry/nextjs'

// ... existing code ...

function sentryBreadcrumbHook(_args: unknown, method: string, _level: number, ...rest: unknown[]) {
  const [obj, msg] = rest as [Record<string, unknown> | string, string?]
  const message = typeof obj === 'string' ? obj : (msg ?? '')
  const data = typeof obj === 'object' ? obj : undefined

  Sentry.addBreadcrumb({
    category: 'pino',
    message,
    level:
      method === 'error' || method === 'fatal' ? 'error' : method === 'warn' ? 'warning' : 'info',
    data: data as Record<string, unknown> | undefined,
  })
}

const hooks = { logMethod: sentryBreadcrumbHook }
```

Tilføj `hooks` til begge pino()-kald:

```typescript
export const logger = pino({
  level: baseLevel,
  base: { module: 'app' },
  timestamp: pino.stdTimeFunctions.isoTime,
  hooks,
  ...(transport ? { transport } : {}),
})

export function createLogger(namespace: string) {
  return pino({
    level: baseLevel,
    base: { module: 'app', namespace },
    timestamp: pino.stdTimeFunctions.isoTime,
    hooks,
    ...(transport ? { transport } : {}),
  })
}
```

- [ ] **Step 2: Kør tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/logger.ts
git commit -m "feat: Pino logs som Sentry breadcrumbs for fejl-kontekst"
```

---

### Task 4: db:e2e:reset i CI

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Tilføj reset-step i e2e job**

I `.github/workflows/ci.yml`, tilføj et reset-step FØR E2E test-step:

```yaml
- name: Reset E2E database
  run: npm run db:e2e:reset
  env:
    E2E_DATABASE_URL: postgresql://chainhub:chainhub@localhost:5432/chainhub_e2e
    DATABASE_URL: postgresql://chainhub:chainhub@localhost:5432/chainhub_e2e
    DIRECT_URL: postgresql://chainhub:chainhub@localhost:5432/chainhub_e2e
```

Placeres efter "Push schema + seed" og FØR "Run E2E tests".

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: tilføj db:e2e:reset step i e2e-job for clean database"
```

---

### Task 5: Visits unit tests

**Files:**

- Create: `src/__tests__/actions/visits.test.ts`

- [ ] **Step 1: Skriv tests for alle 6 exported functions**

```typescript
// src/__tests__/actions/visits.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    visit: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findMany: vi.fn(),
    },
    userRoleAssignment: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(),
  getAccessibleCompanies: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, getAccessibleCompanies } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'

const mockSession = {
  user: { id: 'u1', email: 'test@test.dk', name: 'Test', organizationId: 'org-1' },
  expires: '',
}

describe('visits actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getVisitDetailPageData', () => {
    it('returnerer null uden session', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const { getVisitDetailPageData } = await import('@/actions/visits')
      const result = await getVisitDetailPageData('v1')
      expect(result).toBeNull()
    })

    it('returnerer null uden adgang', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(prisma.visit.findFirst).mockResolvedValue({
        id: 'v1',
        company_id: 'c1',
        organization_id: 'org-1',
        company: { id: 'c1', name: 'Test Co' },
        visitor: { id: 'u1', name: 'Test' },
      } as never)
      vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([])
      vi.mocked(canAccessCompany).mockResolvedValue(false)
      const { getVisitDetailPageData } = await import('@/actions/visits')
      const result = await getVisitDetailPageData('v1')
      expect(result).toBeNull()
    })

    it('returnerer data med adgang', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(prisma.visit.findFirst).mockResolvedValue({
        id: 'v1',
        company_id: 'c1',
        organization_id: 'org-1',
        visited_by: 'u1',
        visit_date: new Date(),
        visit_type: 'KLINIK',
        status: 'PLANLAGT',
        notes: null,
        summary: null,
        created_at: new Date(),
        company: { id: 'c1', name: 'Test Co' },
        visitor: { id: 'u1', name: 'Test' },
      } as never)
      vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
        { role: 'GROUP_OWNER' },
      ] as never)
      vi.mocked(canAccessCompany).mockResolvedValue(true)
      const { getVisitDetailPageData } = await import('@/actions/visits')
      const result = await getVisitDetailPageData('v1')
      expect(result).not.toBeNull()
      expect(result!.visit.id).toBe('v1')
      expect(result!.canReopen).toBe(true)
    })
  })

  describe('createVisit', () => {
    it('returnerer fejl uden session', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const { createVisit } = await import('@/actions/visits')
      const result = await createVisit({
        companyId: 'c1',
        visitDate: '2026-01-01',
        visitType: 'KLINIK',
      })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('returnerer fejl uden adgang til selskab', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(canAccessCompany).mockResolvedValue(false)
      const { createVisit } = await import('@/actions/visits')
      const result = await createVisit({
        companyId: 'c1',
        visitDate: '2026-01-01',
        visitType: 'KLINIK',
      })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('opretter besøg med gyldigt input', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(canAccessCompany).mockResolvedValue(true)
      vi.mocked(prisma.visit.create).mockResolvedValue({ id: 'v-new' } as never)
      const { createVisit } = await import('@/actions/visits')
      const result = await createVisit({
        companyId: 'c1',
        visitDate: '2026-01-01',
        visitType: 'KLINIK',
      })
      expect(result).toMatchObject({ data: { id: 'v-new' } })
      expect(prisma.visit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_id: 'org-1',
            company_id: 'c1',
          }),
        })
      )
    })

    it('returnerer fejl ved rate limit', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(canAccessCompany).mockResolvedValue(true)
      vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as never)
      const { createVisit } = await import('@/actions/visits')
      const result = await createVisit({
        companyId: 'c1',
        visitDate: '2026-01-01',
        visitType: 'KLINIK',
      })
      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })

  describe('updateVisit', () => {
    it('returnerer fejl uden session', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const { updateVisit } = await import('@/actions/visits')
      const result = await updateVisit({ visitId: 'v1' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('returnerer fejl når besøg ikke findes', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(prisma.visit.findFirst).mockResolvedValue(null)
      const { updateVisit } = await import('@/actions/visits')
      const result = await updateVisit({ visitId: 'v1' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })

  describe('deleteVisit', () => {
    it('returnerer fejl uden session', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const { deleteVisit } = await import('@/actions/visits')
      const result = await deleteVisit('v1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('soft-deleter besøg med adgang', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(prisma.visit.findFirst).mockResolvedValue({
        id: 'v1',
        company_id: 'c1',
        organization_id: 'org-1',
      } as never)
      vi.mocked(canAccessCompany).mockResolvedValue(true)
      vi.mocked(prisma.visit.update).mockResolvedValue({} as never)
      const { deleteVisit } = await import('@/actions/visits')
      const result = await deleteVisit('v1')
      expect(result).toMatchObject({ data: undefined })
      expect(prisma.visit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deleted_at: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('getVisitNewPageCompanies', () => {
    it('returnerer tomt array uden session', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const { getVisitNewPageCompanies } = await import('@/actions/visits')
      const result = await getVisitNewPageCompanies()
      expect(result).toEqual([])
    })

    it('returnerer tilgængelige selskaber', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1', 'c2'])
      vi.mocked(prisma.company.findMany).mockResolvedValue([
        { id: 'c1', name: 'Selskab A' },
        { id: 'c2', name: 'Selskab B' },
      ] as never)
      const { getVisitNewPageCompanies } = await import('@/actions/visits')
      const result = await getVisitNewPageCompanies()
      expect(result).toHaveLength(2)
    })
  })
})
```

- [ ] **Step 2: Kør tests**

Run: `npx vitest run src/__tests__/actions/visits.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/actions/visits.test.ts
git commit -m "test: visits action tests — auth, adgang, CRUD, org-filter"
```

---

### Task 6: Billing E2E test

**Files:**

- Create: `tests/e2e/billing.spec.ts`

- [ ] **Step 1: Skriv billing E2E test**

```typescript
// tests/e2e/billing.spec.ts
import { test, expect } from './fixtures'

test.describe('billing', () => {
  test('billing-side viser planer', async ({ loggedInPage: page }) => {
    await page.goto('/billing')
    await page.waitForLoadState('networkidle')

    // Verificér at billing-siden loader
    await expect(page.locator('body')).not.toBeEmpty()

    // Verificér at mindst én plan/pris vises
    const starterButton = page.locator('button, a', { hasText: /Starter|Vælg|Opgradér/ })
    const hasPlans = (await starterButton.count()) > 0
    expect(hasPlans).toBe(true)
  })

  test('success-banner vises med ?success=1', async ({ loggedInPage: page }) => {
    await page.goto('/billing?success=1')
    await page.waitForLoadState('networkidle')

    const successBanner = page
      .locator('text=Betaling gennemført')
      .or(page.locator('text=abonnement'))
      .or(page.locator('[class*="green"]'))
    await expect(successBanner.first()).toBeVisible({ timeout: 5000 })
  })

  test('cancel-banner vises med ?canceled=1', async ({ loggedInPage: page }) => {
    await page.goto('/billing?canceled=1')
    await page.waitForLoadState('networkidle')

    const cancelBanner = page
      .locator('text=annulleret')
      .or(page.locator('text=Betalingen blev'))
      .or(page.locator('[class*="amber"]'))
    await expect(cancelBanner.first()).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/billing.spec.ts
git commit -m "test: billing E2E — planer vises, success/cancel feedback"
```

---

### Task 7: Final verificering

- [ ] **Step 1: Kør fuld Vitest suite**

Run: `npx vitest run`
Expected: PASS (alle tests)

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: SUCCESS

- [ ] **Step 3: Kør build**

Run: `npx next build`
Expected: SUCCESS

- [ ] **Step 4: Verificér commits**

Run: `git log --oneline -10`
Expected: 6 nye commits (middleware/CSP, withRetry, breadcrumbs, CI, visits tests, billing E2E)
