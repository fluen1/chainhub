# Gap-lukning + Google Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Luk alle 5 modenhedshuller (action-hardening, coverage, CSP, preview deploys, rate limiting) og tilføj Google OAuth med self-signup.

**Architecture:** Inkrementelle ændringer til eksisterende filer. Ingen nye frameworks. Rate limiting genbruger Upstash-infrastrukturen. Google Auth bruger NextAuth's Account-adapter-model med custom signIn-callback for self-signup.

**Tech Stack:** Next.js 14, NextAuth 4, Prisma 5, Zod, Upstash Redis, Vitest, TypeScript strict

---

## Task 1: Action-hardening — billing.ts

**Files:**

- Modify: `src/actions/billing.ts`
- Create: `src/__tests__/actions/billing-hardening.test.ts`

- [ ] **Step 1: Write failing tests for permission checks**

```typescript
// src/__tests__/actions/billing-hardening.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSession = {
  user: { id: 'user-1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
}

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    subscription: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/stripe', () => ({ getStripe: vi.fn() }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { NEXTAUTH_URL: 'http://localhost:3000' } }))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { getBillingPageData, createCheckoutSession, createPortalSession } from '@/actions/billing'

describe('billing action hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getBillingPageData afviser uden billing-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(canAccessModule).mockResolvedValue(false)

    const result = await getBillingPageData()
    expect(result).toEqual({ error: expect.stringContaining('adgang') })
    expect(canAccessModule).toHaveBeenCalledWith('user-1', 'billing', 'org-1')
  })

  it('createCheckoutSession validerer priceId med Zod', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(canAccessModule).mockResolvedValue(true)

    const result = await createCheckoutSession('')
    expect(result).toEqual({ error: expect.stringContaining('pris') })
  })

  it('createPortalSession afviser uden billing-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(canAccessModule).mockResolvedValue(false)

    const result = await createPortalSession()
    expect(result).toEqual({ error: expect.stringContaining('adgang') })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/actions/billing-hardening.test.ts`
Expected: FAIL — no permission checks exist yet

- [ ] **Step 3: Add Zod + permissions to billing.ts**

Add import at top of `src/actions/billing.ts`:

```typescript
import { z } from 'zod'
import { canAccessModule } from '@/lib/permissions'
```

Add Zod schema after BASE_URL:

```typescript
const checkoutSchema = z.object({
  priceId: z.string().min(1, 'Ugyldig pris-ID'),
})
```

Add permission check to `getBillingPageData` after session check:

```typescript
const hasAccess = await canAccessModule(session.user.id, 'billing', session.user.organizationId)
if (!hasAccess) return { error: 'Du har ikke adgang til fakturering' }
```

Add permission + Zod to `createCheckoutSession`:

```typescript
// After session check, before const stripe = getStripe()
const hasAccess = await canAccessModule(session.user.id, 'billing', session.user.organizationId)
if (!hasAccess) return { error: 'Du har ikke adgang til fakturering' }

const parsed = checkoutSchema.safeParse({ priceId })
if (!parsed.success) return { error: 'Ugyldig pris-ID' }
```

Add permission to `createPortalSession`:

```typescript
// After session check, before const stripe = getStripe()
const hasAccess = await canAccessModule(session.user.id, 'billing', session.user.organizationId)
if (!hasAccess) return { error: 'Du har ikke adgang til fakturering' }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/actions/billing-hardening.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/billing.ts src/__tests__/actions/billing-hardening.test.ts
git commit -m "fix(billing): tilføj Zod-validering + canAccessModule permission-checks"
```

---

## Task 2: Action-hardening — onboarding.ts + ai-usage.ts + permissions

**Files:**

- Modify: `src/actions/onboarding.ts`
- Modify: `src/actions/ai-usage.ts`
- Modify: `src/lib/permissions/index.ts`
- Create: `src/__tests__/actions/onboarding-hardening.test.ts`
- Create: `src/__tests__/actions/ai-usage-hardening.test.ts`

- [ ] **Step 1: Add 'onboarding' case to canAccessModule**

In `src/lib/permissions/index.ts`, add after the `'persons'` case (before `'export'`):

```typescript
    case 'onboarding':
      return userRoles.length > 0
```

All authenticated users with any role can see onboarding status.

- [ ] **Step 2: Write failing test for onboarding permission**

```typescript
// src/__tests__/actions/onboarding-hardening.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    company: { count: vi.fn() },
    contract: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { getOnboardingStatus } from '@/actions/onboarding'

describe('onboarding hardening', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer EMPTY_STATUS hvis bruger ikke har modul-adgang', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', organizationId: 'o1', email: 'a@b.dk', name: 'A' },
    } as never)
    vi.mocked(canAccessModule).mockResolvedValue(false)

    const result = await getOnboardingStatus()
    expect(result.shouldShow).toBe(false)
    expect(canAccessModule).toHaveBeenCalledWith('u1', 'onboarding', 'o1')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/actions/onboarding-hardening.test.ts`
Expected: FAIL

- [ ] **Step 4: Add permission check to onboarding.ts**

Add import at top:

```typescript
import { canAccessModule } from '@/lib/permissions'
```

Add after session check (line 35–37), before `try`:

```typescript
const hasAccess = await canAccessModule(session.user.id, 'onboarding', session.user.organizationId)
if (!hasAccess) return EMPTY_STATUS
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/actions/onboarding-hardening.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing test for ai-usage hardening**

```typescript
// src/__tests__/actions/ai-usage-hardening.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    aIUsageLog: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    organizationAISettings: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/ai/cost-cap', () => ({
  getCostCapStatus: vi.fn().mockResolvedValue({
    threshold: 'none',
    capUsd: 50,
    currentUsd: 0,
    percentage: 0,
  }),
}))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { getSettingsAIUsage } from '@/actions/ai-usage'

describe('ai-usage hardening', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getSettingsAIUsage afviser uden settings-adgang', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', organizationId: 'o1', email: 'a@b.dk', name: 'A' },
    } as never)
    vi.mocked(canAccessModule).mockResolvedValue(false)

    const result = await getSettingsAIUsage()
    expect(result.used).toBe(0)
    expect(result.max).toBe(1000)
    expect(canAccessModule).toHaveBeenCalledWith('u1', 'settings', 'o1')
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/__tests__/actions/ai-usage-hardening.test.ts`
Expected: FAIL

- [ ] **Step 8: Add permission check to ai-usage.ts**

In `getSettingsAIUsage()`, after `if (!organizationId)` block, add:

```typescript
const hasAccess = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
if (!hasAccess) {
  return { used: 0, max: 1000, percent: 0, threshold: 'none', capUsd: 50, currentUsd: 0 }
}
```

- [ ] **Step 9: Run all hardening tests**

Run: `npx vitest run src/__tests__/actions/onboarding-hardening.test.ts src/__tests__/actions/ai-usage-hardening.test.ts`
Expected: PASS

- [ ] **Step 10: Run full test suite**

Run: `npx vitest run`
Expected: All 1210+ tests pass

- [ ] **Step 11: Commit**

```bash
git add src/actions/onboarding.ts src/actions/ai-usage.ts src/lib/permissions/index.ts src/__tests__/actions/onboarding-hardening.test.ts src/__tests__/actions/ai-usage-hardening.test.ts
git commit -m "fix(permissions): tilføj canAccessModule checks til onboarding + ai-usage + onboarding-case"
```

---

## Task 3: Coverage-tærskel i CI

**Files:**

- Modify: `vitest.config.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add coverage config to vitest.config.ts**

Add `coverage` inside the `test` block, after `exclude`:

```typescript
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 60,
        functions: 60,
      },
    },
```

Full `test` block becomes:

```typescript
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    testTimeout: 30_000,
    exclude: ['node_modules/**', 'tests/e2e/**', '.next/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 60,
        functions: 60,
      },
    },
  },
```

- [ ] **Step 2: Update CI to use coverage**

In `.github/workflows/ci.yml`, change the `Unit tests` step command from `npm test` to `npm run test:coverage`:

```yaml
- name: Unit tests (Vitest)
  run: npm run test:coverage
  env:
    NODE_ENV: test
```

- [ ] **Step 3: Install v8 coverage provider**

Run: `npm install -D @vitest/coverage-v8`

- [ ] **Step 4: Verify coverage runs locally**

Run: `npm run test:coverage`
Expected: Tests pass with coverage report. Thresholds met (60% lines/functions).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts .github/workflows/ci.yml package.json package-lock.json
git commit -m "ci: tilføj coverage-tærskel (60% lines/functions) og håndhæv i CI"
```

---

## Task 4: CSP-stramning

**Files:**

- Modify: `next.config.mjs`

- [ ] **Step 1: Remove unsafe-eval, add upgrade-insecure-requests**

In `next.config.mjs`, update the CSP header value. Change:

```javascript
"script-src 'self' 'unsafe-eval' 'unsafe-inline'",
```

To:

```javascript
"script-src 'self' 'unsafe-inline'",
```

And add after the `form-action` line:

```javascript
"upgrade-insecure-requests",
```

- [ ] **Step 2: Verify build succeeds**

Run: `npx next build`
Expected: Build succeeds without CSP errors. `unsafe-eval` is not needed for production.

- [ ] **Step 3: Commit**

```bash
git add next.config.mjs
git commit -m "security: fjern unsafe-eval fra CSP, tilføj upgrade-insecure-requests"
```

---

## Task 5: Vercel Preview Deploys — dynamisk NEXTAUTH_URL

**Files:**

- Modify: `src/lib/auth/index.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update env.ts with VERCEL_URL**

Add to env schema in `src/lib/env.ts`:

```typescript
  VERCEL_URL: z.string().optional(),
```

- [ ] **Step 2: Update auth config for dynamic URL**

In `src/lib/auth/index.ts`, replace the current `pages` config:

```typescript
  pages: {
    signIn: '/login',
  },
```

With no change needed — NextAuth 4 uses `NEXTAUTH_URL` automatically. But the env var must be set.

Instead, add a `NEXTAUTH_URL` fallback. In `src/lib/env.ts`, after the schema parsing, add a computed `baseUrl`:

```typescript
export const baseUrl =
  env.NEXTAUTH_URL ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:3000')
```

Then update `src/actions/billing.ts` to use `baseUrl` instead of `env.NEXTAUTH_URL`:

```typescript
import { baseUrl } from '@/lib/env'

// Remove: const BASE_URL = env.NEXTAUTH_URL ?? 'http://localhost:3000'
// Replace with:
const BASE_URL = baseUrl
```

- [ ] **Step 3: Update .env.example**

Add under the NextAuth section:

```bash
# Vercel sætter automatisk VERCEL_URL — bruges som fallback for NEXTAUTH_URL i preview deploys.
# Sæt ikke denne manuelt.
# VERCEL_URL=
```

- [ ] **Step 4: Verify build**

Run: `npx next build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/actions/billing.ts .env.example
git commit -m "feat: dynamisk NEXTAUTH_URL via VERCEL_URL for preview deploys"
```

---

## Task 6: Generel rate limiting på Server Actions

**Files:**

- Create: `src/lib/rate-limit.ts`
- Create: `src/__tests__/lib/rate-limit.test.ts`
- Modify: `src/actions/companies.ts` (eksempel-integration)
- Modify: `src/actions/cases.ts`
- Modify: `src/actions/contracts.ts`
- Modify: `src/actions/persons.ts`
- Modify: `src/actions/tasks.ts`
- Modify: `src/actions/documents.ts`
- Modify: `src/actions/visits.ts`
- Modify: `src/actions/comments.ts`
- Modify: `src/actions/ownership.ts`
- Modify: `src/actions/governance.ts`
- Modify: `src/actions/finance.ts`
- Modify: `src/actions/users.ts`
- Modify: `src/actions/billing.ts`
- Modify: `src/actions/signup.ts`
- Modify: `src/actions/auth.ts`

- [ ] **Step 1: Write failing test for rate limiter**

```typescript
// src/__tests__/lib/rate-limit.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { checkActionRateLimit, resetActionRateLimiter } from '@/lib/rate-limit'

describe('checkActionRateLimit', () => {
  beforeEach(() => {
    resetActionRateLimiter()
  })

  it('tillader normale requests', async () => {
    const result = await checkActionRateLimit('org-1')
    expect(result.limited).toBe(false)
  })

  it('blokerer efter 60 requests', async () => {
    for (let i = 0; i < 60; i++) {
      await checkActionRateLimit('org-1')
    }
    const result = await checkActionRateLimit('org-1')
    expect(result.limited).toBe(true)
  })

  it('isolerer per organisation', async () => {
    for (let i = 0; i < 60; i++) {
      await checkActionRateLimit('org-1')
    }
    const result = await checkActionRateLimit('org-2')
    expect(result.limited).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/rate-limit.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement rate limiter**

```typescript
// src/lib/rate-limit.ts
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

let redisRatelimit: Ratelimit | null = null

function getRedisRatelimit(): Ratelimit | null {
  if (redisRatelimit) return redisRatelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  redisRatelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    prefix: 'chainhub:action',
  })
  return redisRatelimit
}

interface RateLimitBucket {
  count: number
  windowStart: number
}

const MAX_REQUESTS = 60
const WINDOW_MS = 60_000
const buckets = new Map<string, RateLimitBucket>()

export async function checkActionRateLimit(
  organizationId: string
): Promise<{ limited: boolean; retryAfter?: number }> {
  // Redis først
  const rl = getRedisRatelimit()
  if (rl) {
    try {
      const result = await rl.limit(organizationId)
      if (result.success) return { limited: false }
      return { limited: true, retryAfter: Math.max(0, result.reset - Date.now()) }
    } catch {
      // Fallthrough til in-memory
    }
  }

  // In-memory fallback
  const now = Date.now()
  const bucket = buckets.get(organizationId)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(organizationId, { count: 1, windowStart: now })
    return { limited: false }
  }

  bucket.count++
  if (bucket.count > MAX_REQUESTS) {
    return { limited: true, retryAfter: WINDOW_MS - (now - bucket.windowStart) }
  }

  return { limited: false }
}

export function resetActionRateLimiter(): void {
  buckets.clear()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/rate-limit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit rate limiter**

```bash
git add src/lib/rate-limit.ts src/__tests__/lib/rate-limit.test.ts
git commit -m "feat: generel rate limiting for Server Actions (60/60s per org)"
```

- [ ] **Step 6: Integrate into mutating actions**

Add to the top of each mutating action file:

```typescript
import { checkActionRateLimit } from '@/lib/rate-limit'
```

Add after session check + permission check, before DB-operation, in each mutating function:

```typescript
const rl = await checkActionRateLimit(session.user.organizationId)
if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }
```

Files and functions to update (add the 2 lines above to each):

**`src/actions/companies.ts`:** `createCompany`, `updateCompany`, `deleteCompany`, `updateCompanyStamdata`
**`src/actions/cases.ts`:** `createCase`, `updateCaseStatus`, `closeCase`, `escalateCase`, `updateCase`, `deleteCase`
**`src/actions/contracts.ts`:** `createContract`, `updateContractStatus`, `deleteContract`, `updateContract`, `addContractParty`
**`src/actions/persons.ts`:** `createPerson`, `updatePerson`, `deletePerson`, `addPersonRole`, `addPersonOwnership`
**`src/actions/tasks.ts`:** `createTask`, `updateTaskStatus`, `updateTaskPriority`, `updateTaskAssignee`, `updateTaskDueDate`, `deleteTask`
**`src/actions/documents.ts`:** `deleteDocument`
**`src/actions/visits.ts`:** `createVisit`, `updateVisit`, `deleteVisit`
**`src/actions/comments.ts`:** `createComment`, `createCaseComment`, `deleteComment`
**`src/actions/ownership.ts`:** `addOwner`, `updateOwnership`, `endOwnership`
**`src/actions/governance.ts`:** `addCompanyPerson`, `endCompanyPerson`
**`src/actions/finance.ts`:** `upsertFinancialMetric`, `createDividendRecord`
**`src/actions/users.ts`:** `createUser`, `updateUserRole`, `toggleUserActive`, `inviteUser`, `acceptInvite`
**`src/actions/billing.ts`:** `createCheckoutSession`, `createPortalSession`
**`src/actions/signup.ts`:** `createAccount` (NB: ingen session her — brug email som key: `checkActionRateLimit(parsed.data.email)`)
**`src/actions/auth.ts`:** `requestPasswordReset`, `resetPassword` (brug email som key)

For actions without session (signup, auth reset): use email instead of organizationId:

```typescript
const rl = await checkActionRateLimit(parsed.data.email)
if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }
```

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (rate limit mock may be needed in some test files — add `vi.mock('@/lib/rate-limit', () => ({ checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }) }))` where tests break)

- [ ] **Step 8: Commit integration**

```bash
git add src/actions/
git commit -m "feat: integrér rate limiting i alle muterende Server Actions"
```

---

## Task 7: Google OAuth — Prisma migration

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Account model to schema.prisma**

After the `PasswordResetToken` model (around line 359), add:

```prisma
model Account {
  id                  String  @id @default(uuid())
  user_id             String
  type                String
  provider            String
  provider_account_id String
  refresh_token       String?
  access_token        String?
  expires_at          Int?
  token_type          String?
  scope               String?
  id_token            String?

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([provider, provider_account_id])
  @@index([user_id])
  @@map("accounts")
}
```

- [ ] **Step 2: Add relation to User model**

Add to the User model relations (after `password_reset_tokens`):

```prisma
  accounts              Account[]
```

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully

- [ ] **Step 4: Create migration**

Run: `npx prisma migrate dev --name add_account_model`
Expected: Migration created and applied

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(auth): tilføj Account-model til Prisma for OAuth-support"
```

---

## Task 8: Google OAuth — NextAuth config + env

**Files:**

- Modify: `src/lib/auth/index.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add Google env vars to env.ts**

Add to env schema:

```typescript
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
```

- [ ] **Step 2: Add Google vars to .env.example**

Add under the NextAuth/Microsoft section:

```bash
# Google OAuth (opret credentials i Google Cloud Console → APIs & Services → Credentials)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 3: Add GoogleProvider + PrismaAdapter to auth config**

Update `src/lib/auth/index.ts`:

Add imports:

```typescript
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
```

Add Google provider to the `providers` array (before CredentialsProvider):

```typescript
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      // ... existing
    }),
  ],
```

Add adapter (only for non-credentials flows — NextAuth 4 needs this for Account linking):

```typescript
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
```

- [ ] **Step 4: Update signIn callback for self-signup**

Add `signIn` callback to the `callbacks` object:

```typescript
    async signIn({ user, account }) {
      // Credentials-flow håndteres af authorize() — skip her
      if (account?.provider === 'credentials') return true
      if (!user.email) return false

      const normalizedEmail = user.email.trim().toLowerCase()

      // Defensive: afvis hvis email matcher >1 tenant
      const matchingUsers = await prisma.user.findMany({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
          deleted_at: null,
          active: true,
        },
        take: 2,
      })

      if (matchingUsers.length > 1) return false

      if (matchingUsers.length === 1) {
        // Eksisterende bruger — opdater last_login_at
        try {
          await prisma.user.update({
            where: { id: matchingUsers[0].id },
            data: { last_login_at: new Date() },
          })
        } catch {
          // Non-fatal
        }
        return true
      }

      // Ny bruger — self-signup: opret org + user + rolle
      const nameParts = (user.name ?? normalizedEmail.split('@')[0] ?? 'Bruger').trim().split(/\s+/)
      const lastName = nameParts[nameParts.length - 1] ?? nameParts[0]
      const orgName = `${lastName} Holding`
      const planExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

      await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: orgName, plan: 'trial', plan_expires_at: planExpiresAt },
        })

        const newUser = await tx.user.create({
          data: {
            organization_id: org.id,
            name: user.name ?? normalizedEmail.split('@')[0] ?? 'Bruger',
            email: normalizedEmail,
            avatar_url: user.image ?? null,
            active: true,
            last_login_at: new Date(),
          },
        })

        await tx.userRoleAssignment.create({
          data: {
            organization_id: org.id,
            user_id: newUser.id,
            role: 'GROUP_OWNER',
            scope: 'ALL',
            company_ids: [],
            created_by: newUser.id,
          },
        })

        // Sæt user.id så NextAuth Account-linking bruger den rigtige bruger
        user.id = newUser.id
      })

      return true
    },
```

- [ ] **Step 5: Update jwt callback to handle OAuth users**

Replace the existing `jwt` callback with:

```typescript
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'credentials') {
          token.id = user.id
          token.organizationId = user.organizationId
        } else {
          // OAuth: hent organizationId fra DB
          const dbUser = await prisma.user.findFirst({
            where: {
              email: { equals: token.email ?? '', mode: 'insensitive' },
              deleted_at: null,
              active: true,
            },
            select: { id: true, organization_id: true },
          })
          if (dbUser) {
            token.id = dbUser.id
            token.organizationId = dbUser.organization_id
          }
        }
      }
      return token
    },
```

- [ ] **Step 6: Verify Prisma generate + build**

Run: `npx prisma generate && npx next build`
Expected: Both succeed

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/index.ts src/lib/env.ts .env.example
git commit -m "feat(auth): tilføj Google OAuth provider med self-signup"
```

---

## Task 9: Google OAuth — Login + Signup UI

**Files:**

- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Replace Microsoft button with Google button on login page**

In `src/app/(auth)/login/page.tsx`, replace the disabled Microsoft button (lines 196-206) with:

```tsx
<button
  type="button"
  onClick={() => signIn('google', { callbackUrl })}
  className="flex w-full items-center justify-center gap-2 rounded-[4px] border border-b-border-strong bg-white py-2 text-[12px] font-medium text-b-1 hover:bg-[#f6f8fa] hover:border-[#c1c5cc]"
>
  <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
  Log ind med Google
</button>
```

- [ ] **Step 2: Add Google button to signup page**

In `src/app/(auth)/signup/page.tsx`, add after the submit button and before the login link:

```tsx
            <div className="flex items-center gap-2.5">
              <div className="h-px flex-1 bg-b-border" />
              <span className="whitespace-nowrap text-[11px] text-b-3">eller</span>
              <div className="h-px flex-1 bg-b-border" />
            </div>

            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="flex w-full items-center justify-center gap-2 rounded-[4px] border border-b-border-strong bg-white py-2 text-[12px] font-medium text-b-1 hover:bg-[#f6f8fa] hover:border-[#c1c5cc]"
            >
              <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Opret med Google
            </button>
```

Add the `signIn` import if not already present:

```typescript
import { signIn } from 'next-auth/react'
```

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/(auth)/login/page.tsx src/app/(auth)/signup/page.tsx
git commit -m "feat(auth): Google OAuth knapper på login- og signup-side"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run build**

Run: `npx next build`
Expected: Build succeeds

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`

- Visit http://localhost:3000/login — verify Google button is visible and styled
- Visit http://localhost:3000/signup — verify Google button is visible
- Click Google button (will fail without credentials, but should redirect to Google)

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final verification fixes for gap-closure + Google Auth"
```
