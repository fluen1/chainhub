# Stream B — Billing end-to-end Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gøre ChainHubs billing-vej reel end-to-end: price-IDs fail-fast i prod, korrekt plan skrevet til DB ved checkout (ikke `'standard'`-fallback), `past_due` der både ryddes ved genbetaling og gater dashboard-adgang, fuld unit-test-dækning på alle webhook-event-handlers, og (P2) webhook-idempotens mod dobbelt-processering.

**Architecture:** Webhook-route'en (`src/app/api/webhooks/stripe/route.ts`) er allerede arkitektonisk korrekt (signatur-verifikation via `constructEvent`, switch på `event.type`, alle Prisma-skriv har `organization_id`-scope via subscription-lookup). Vi udvider den med (a) en deterministisk priceId→plan-mapping der erstatter `?? 'standard'`, (b) en ny `invoice.payment_succeeded`-handler, og (c) en idempotens-guard baseret på en ny `ProcessedStripeEvent`-tabel. `src/lib/env.ts` gør price-IDs `requiredInProd`. Dashboard-layout gater `past_due` på linje med eksisterende `trial`/`canceled`-gates. Alt TDD-drevet via en ny `src/__tests__/api/webhooks-stripe.test.ts` der mocker `getStripe()` + `prisma`.

**Tech Stack:** Next.js 16 (route handlers), Stripe Node SDK (v22+ API, `lookup_key` på `price`), Prisma 6/Supabase, Vitest 4 (`vi.mock` med factory + `vi.mocked`), Zod (env). Migration genereres med `prisma migrate diff --script` OVENPÅ Stream A's `0_init`-baseline.

**Forudsætning:** Stream A er merged FØRST — `prisma/migrations/0_init/` eksisterer som baseline med `migration_lock.toml`. Task 7's nye migration lægges ovenpå den, ikke ind i den.

---

## Vigtigt før start

- **Afhængighed af Stream A:** Verificér at `prisma/migrations/0_init/migration.sql` + `prisma/migrations/migration_lock.toml` eksisterer før Task 7. Hvis ikke → STOP, Stream A skal køres først (DAG'en i roadmappen er hård her).
- **Philip-afhængighed (ekstern, Stream P — blokerer IKKE kode/unit-test):** Live Stripe-produkter med `lookup_key='basis'` og `lookup_key='plus'`, price-IDs kopieret til Vercel-env (`STRIPE_BASIS_PRICE_ID`/`STRIPE_PLUS_PRICE_ID`), og webhook-endpoint `www.chainhub.dk/api/webhooks/stripe` registreret med events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, **`invoice.payment_succeeded`** (NY — skal tilføjes i Stripe-dashboard). Koden i denne plan er skrevet til at virke uanset om `lookup_key` er sat, fordi vi mapper på price-ID som fallback — men `lookup_key` forbliver den foretrukne kilde.
- **Commit-stil:** `[type]: beskrivelse på dansk`. Én commit pr. task.
- **Test-kommando:** `npx vitest run src/__tests__/api/webhooks-stripe.test.ts` (enkelt fil) / `npm test` (fuld suite).
- **Ikke-forhandlingsbart:** Alle Prisma-skriv beholder `organization_id`-scope (via subscription-lookup på `stripe_customer_id`); ingen `any` (brug `Stripe.*`-typer + `vi.mocked`); env udelukkende via `src/lib/env.ts`.

---

## Task 1: Gør STRIPE_BASIS/PLUS_PRICE_ID requiredInProd (P0)

**Files:**

- Modify: `src/lib/env.ts:38-39`
- Modify: `src/__tests__/lib/` (ny lille env-guard-test — se Step 1)

Eksisterende mønster i `env.ts` er allerede `requiredInProd('NAVN')` (linje 26, 31, 32, 35, 36). Vi anvender samme helper på de to price-ID-felter.

- [ ] **Step 1: Skriv fejlende test for at price-IDs er påkrævet i prod**

Opret `src/__tests__/lib/env-stripe-price-ids.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// env.ts evaluerer process.env ved modul-load → vi isolerer moduler pr. test
describe('env — Stripe price-IDs requiredInProd', () => {
  const ORIGINAL = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL }
    vi.resetModules()
  })

  function setProdBase() {
    process.env.NODE_ENV = 'production'
    delete process.env.NEXT_PHASE
    process.env.DATABASE_URL = 'postgresql://x'
    process.env.NEXTAUTH_SECRET = 'x'
    process.env.NEXTAUTH_URL = 'https://www.chainhub.dk'
    process.env.DIGEST_CRON_SECRET = 'x'
    process.env.UPSTASH_REDIS_REST_URL = 'https://x'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'x'
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'
  }

  it('kaster når STRIPE_BASIS_PRICE_ID mangler i production', async () => {
    setProdBase()
    process.env.STRIPE_PLUS_PRICE_ID = 'price_plus'
    delete process.env.STRIPE_BASIS_PRICE_ID
    await expect(import('@/lib/env')).rejects.toThrow(/STRIPE_BASIS_PRICE_ID/)
  })

  it('kaster når STRIPE_PLUS_PRICE_ID mangler i production', async () => {
    setProdBase()
    process.env.STRIPE_BASIS_PRICE_ID = 'price_basis'
    delete process.env.STRIPE_PLUS_PRICE_ID
    await expect(import('@/lib/env')).rejects.toThrow(/STRIPE_PLUS_PRICE_ID/)
  })

  it('accepterer manglende price-IDs udenfor production', async () => {
    process.env = { ...ORIGINAL }
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = 'postgresql://x'
    process.env.NEXTAUTH_SECRET = 'x'
    delete process.env.STRIPE_BASIS_PRICE_ID
    delete process.env.STRIPE_PLUS_PRICE_ID
    await expect(import('@/lib/env')).resolves.toBeDefined()
  })
})
```

- [ ] **Step 2: Kør testen — forvent FAIL**

```bash
npx vitest run src/__tests__/lib/env-stripe-price-ids.test.ts
```

Expected: De to prod-tests FEJLER (`import('@/lib/env')` resolver i stedet for at kaste, fordi felterne pt. er `z.string().optional()`). Tredje test passerer allerede.

- [ ] **Step 3: Minimal impl — skift til requiredInProd**

I `src/lib/env.ts` erstat linje 38-39:

```ts
  STRIPE_BASIS_PRICE_ID: requiredInProd('STRIPE_BASIS_PRICE_ID'),
  STRIPE_PLUS_PRICE_ID: requiredInProd('STRIPE_PLUS_PRICE_ID'),
```

- [ ] **Step 4: Kør testen igen — forvent PASS**

```bash
npx vitest run src/__tests__/lib/env-stripe-price-ids.test.ts
```

Expected: Alle 3 PASS. (Bemærk: `next build` sætter `NEXT_PHASE=phase-production-build` → `isProd=false` der, så build på CI uden secrets brydes ikke; det er præcis hvad `isBuildPhase`-guarden på env.ts:5 sikrer.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/__tests__/lib/env-stripe-price-ids.test.ts
git commit -m "fix(billing): goer STRIPE_BASIS/PLUS_PRICE_ID required i prod — fail-fast paa dode checkout-knapper"
```

---

## Task 2: priceId/lookup_key→plan mapping (erstat `?? 'standard'`) (P0)

**Files:**

- Create: `src/lib/billing/plan-from-price.ts`
- Create: `src/__tests__/lib/plan-from-price.test.ts`

Beslutningen om mapping er IKKE en åben beslutning — vi laver en ren funktion med to deterministiske kilder i prioriteret rækkefølge: (1) `lookup_key` hvis sat ('basis'/'plus'), (2) price-ID matchet mod `STRIPE_BASIS_PRICE_ID`/`STRIPE_PLUS_PRICE_ID` fra env. Hvis ingen matcher → returnér `null` (kalderen logger og dropper plan-skrivning frem for at gemme en forkert plan). Dette eliminerer den nuværende `'standard'`-fallback der ikke engang er en gyldig plan-streng (`billing-client.tsx` kender kun `trial`/`basis`/`plus`/`enterprise`).

- [ ] **Step 1: Skriv fejlende test for mapping-funktionen**

Opret `src/__tests__/lib/plan-from-price.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_BASIS_PRICE_ID: 'price_basis_123',
    STRIPE_PLUS_PRICE_ID: 'price_plus_456',
  },
}))

import { planFromPrice } from '@/lib/billing/plan-from-price'

describe('planFromPrice', () => {
  it('foretrækker lookup_key når sat', () => {
    expect(planFromPrice({ lookupKey: 'basis', priceId: 'price_plus_456' })).toBe('basis')
    expect(planFromPrice({ lookupKey: 'plus', priceId: 'price_basis_123' })).toBe('plus')
  })

  it('matcher price-ID mod env når lookup_key mangler', () => {
    expect(planFromPrice({ lookupKey: null, priceId: 'price_basis_123' })).toBe('basis')
    expect(planFromPrice({ lookupKey: null, priceId: 'price_plus_456' })).toBe('plus')
  })

  it('returnerer null ved ukendt price uden lookup_key (ingen forkert plan skrives)', () => {
    expect(planFromPrice({ lookupKey: null, priceId: 'price_ukendt' })).toBeNull()
    expect(planFromPrice({ lookupKey: undefined, priceId: undefined })).toBeNull()
  })

  it('ignorerer ukendte lookup_keys og falder tilbage til price-ID', () => {
    expect(planFromPrice({ lookupKey: 'gammel_navn', priceId: 'price_plus_456' })).toBe('plus')
  })
})
```

- [ ] **Step 2: Kør testen — forvent FAIL**

```bash
npx vitest run src/__tests__/lib/plan-from-price.test.ts
```

Expected: FAIL med `Failed to resolve import "@/lib/billing/plan-from-price"` (modulet findes ikke endnu).

- [ ] **Step 3: Minimal impl**

Opret `src/lib/billing/plan-from-price.ts`:

```ts
import { env } from '@/lib/env'

export type BillingPlan = 'basis' | 'plus'

const KNOWN_LOOKUP_KEYS: ReadonlySet<string> = new Set<BillingPlan>(['basis', 'plus'])

/**
 * Deterministisk mapping fra en Stripe-prismodel til ChainHubs plan-navn.
 * Prioritet: 1) lookup_key (hvis 'basis'/'plus'), 2) price-ID matchet mod env.
 * Returnerer null hvis intet matcher — så kalderen IKKE skriver en forkert plan.
 */
export function planFromPrice(input: {
  lookupKey?: string | null
  priceId?: string | null
}): BillingPlan | null {
  const { lookupKey, priceId } = input

  if (lookupKey && KNOWN_LOOKUP_KEYS.has(lookupKey)) {
    return lookupKey as BillingPlan
  }

  if (priceId) {
    if (priceId === env.STRIPE_BASIS_PRICE_ID) return 'basis'
    if (priceId === env.STRIPE_PLUS_PRICE_ID) return 'plus'
  }

  return null
}
```

- [ ] **Step 4: Kør testen igen — forvent PASS**

```bash
npx vitest run src/__tests__/lib/plan-from-price.test.ts
```

Expected: Alle 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/plan-from-price.ts src/__tests__/lib/plan-from-price.test.ts
git commit -m "feat(billing): deterministisk priceId/lookup_key->plan mapping (erstatter 'standard'-fallback)"
```

---

## Task 3: Anvend mapping i webhook + tilføj invoice.payment_succeeded-handler (P0)

**Files:**

- Modify: `src/app/api/webhooks/stripe/route.ts:86` (checkout-plan), `:144-155` (subscription.updated-plan), `:184-200` (ny payment_succeeded-case)

Dette task ændrer route'en men dækkes adfærdsmæssigt af Task 4's webhook-tests (TDD-rækkefølgen er: Task 4 skrives som RED mod den ÆNDREDE route — derfor gør vi route-ændringen her, og Task 4 verificerer den). For at holde TDD-disciplin kører vi her kun `tsc` + den eksisterende suite som regressionsgate; den fulde adfærds-verifikation sker i Task 4.

- [ ] **Step 1: Importér mapping i route'en**

Tilføj efter linje 6 (`import type Stripe from 'stripe'`):

```ts
import { planFromPrice } from '@/lib/billing/plan-from-price'
```

- [ ] **Step 2: Erstat `?? 'standard'` i checkout.session.completed**

Erstat linje 86:

```ts
const firstItem = stripeSubscription.items.data[0]
const plan = planFromPrice({
  lookupKey: firstItem?.price.lookup_key,
  priceId: firstItem?.price.id,
})
```

…og fjern den nu-duplikerede `const firstItem = stripeSubscription.items.data[0]` på den oprindelige linje 87 (der står lige under). Gør derefter plan-skrivningen betinget: hvis `plan === null`, opdatér subscription-perioden men spring `organization.plan`-opdateringen over og log. Erstat blokken linje 90-122 med:

```ts
await prisma.subscription.upsert({
  where: { organization_id: orgId },
  create: {
    organization_id: orgId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    plan: plan ?? 'trial',
    status: stripeSubscription.status,
    seat_count: 1,
    current_period_start: new Date(periodStart * 1000),
    current_period_end: new Date(periodEnd * 1000),
    trial_ends_at: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null,
  },
  update: {
    stripe_subscription_id: subscriptionId,
    ...(plan ? { plan } : {}),
    status: stripeSubscription.status,
    current_period_start: new Date(periodStart * 1000),
    current_period_end: new Date(periodEnd * 1000),
    trial_ends_at: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null,
  },
})

if (plan) {
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan },
  })
} else {
  captureError(new Error('Ukendt Stripe-price ved checkout — plan ikke opdateret'), {
    namespace: 'api:webhooks:stripe',
    extra: { step: 'checkout.session.completed', orgId, priceId: firstItem?.price.id },
  })
}

break
```

(Bemærk: `const { periodStart, periodEnd } = resolvePeriod(firstItem)` på den oprindelige linje 88 bevares — den ligger nu lige efter `plan`-beregningen.)

- [ ] **Step 3: Brug mapping i customer.subscription.updated**

Erstat linje 143-155 (plan-opdaterings-blokken) så `lookup_key` ikke længere er eneste kilde:

```ts
// Opdater plan på organisation hvis vi kan mappe price → plan
const plan = planFromPrice({
  lookupKey: firstItem?.price.lookup_key,
  priceId: firstItem?.price.id,
})
if (plan) {
  const existing = await prisma.subscription.findFirst({
    where: { stripe_customer_id: customerId },
  })
  if (existing) {
    await prisma.organization.update({
      where: { id: existing.organization_id },
      data: { plan },
    })
  }
}
```

- [ ] **Step 4: Tilføj invoice.payment_succeeded-handler**

Indsæt en ny case lige FØR `case 'invoice.payment_failed':` (linje 184). Den rydder `past_due` ved at sætte status tilbage til `active`, men kun for subscriptions der pt. IKKE er `canceled` (en annulleret subscription må aldrig genoplives af en sen faktura-betaling):

```ts
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = resolveCustomerId(invoice.customer)
        if (!customerId) break

        // Ryd past_due → active. Rør IKKE canceled-abonnementer.
        await prisma.subscription.updateMany({
          where: {
            stripe_customer_id: customerId,
            status: { not: 'canceled' },
          },
          data: { status: 'active' },
        })

        break
      }
```

- [ ] **Step 5: Regressions-gate (adfærd verificeres i Task 4)**

```bash
npx tsc --noEmit && npm test
```

Expected: `tsc` 0 errors; eksisterende suite grøn (ingen test rører endnu denne route, så ingen regressionsbrud). Commit udskydes til Task 4, så test + impl committes sammen.

---

## Task 4: Webhook unit-tests — fuld event-dækning (P0)

**Files:**

- Create: `src/__tests__/api/webhooks-stripe.test.ts`

Mock-strategi (verificeret mod `src/__tests__/api/health.test.ts`-mønstret + route'ens faktiske imports): mock `@/lib/db` (prisma), `@/lib/stripe` (`getStripe`), `@/lib/env` (webhook-secret + price-IDs), og `@/lib/logger` (`captureError`). `getStripe()` returnerer et fake med `webhooks.constructEvent` + `subscriptions.retrieve`. Vi konstruerer `NextRequest` med en `stripe-signature`-header og en body; `constructEvent` mockes til at returnere det ønskede event (eller kaste for ugyldig-signatur-testen).

- [ ] **Step 1: Skriv den fulde fejlende test-fil**

Opret `src/__tests__/api/webhooks-stripe.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────
const constructEvent = vi.fn()
const subscriptionsRetrieve = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: subscriptionsRetrieve },
  }),
}))

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_BASIS_PRICE_ID: 'price_basis_123',
    STRIPE_PLUS_PRICE_ID: 'price_plus_456',
  },
}))

const prismaMock = {
  subscription: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  organization: {
    update: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))

import { POST } from '@/app/api/webhooks/stripe/route'
import { captureError } from '@/lib/logger'

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(body = '{}', signature: string | null = 'sig_test'): NextRequest {
  const headers = new Headers()
  if (signature !== null) headers.set('stripe-signature', signature)
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers,
    body,
  })
}

function subItem(opts: { priceId: string; lookupKey?: string | null }) {
  return {
    price: { id: opts.priceId, lookup_key: opts.lookupKey ?? null },
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_592_000,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.subscription.findFirst.mockResolvedValue({
    organization_id: 'org_1',
    stripe_customer_id: 'cus_1',
  })
  prismaMock.subscription.upsert.mockResolvedValue({})
  prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.organization.update.mockResolvedValue({})
})

// ── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/webhooks/stripe', () => {
  it('returnerer 400 ved manglende signatur-header', async () => {
    const res = await POST(makeReq('{}', null))
    expect(res.status).toBe(400)
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('returnerer 400 ved ugyldig signatur', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const res = await POST(makeReq())
    expect(res.status).toBe(400)
    expect(captureError).toHaveBeenCalled()
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled()
  })

  it('checkout.session.completed: upserter subscription + sætter korrekt plan via lookup_key', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: { mode: 'subscription', customer: 'cus_1', subscription: 'sub_1' },
      },
    })
    subscriptionsRetrieve.mockResolvedValue({
      status: 'active',
      trial_end: null,
      metadata: { organization_id: 'org_1' },
      items: { data: [subItem({ priceId: 'price_basis_123', lookupKey: 'basis' })] },
    })

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organization_id: 'org_1' } })
    )
    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { plan: 'basis' },
    })
  })

  it('checkout.session.completed: mapper via price-ID når lookup_key mangler', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', customer: 'cus_1', subscription: 'sub_1' } },
    })
    subscriptionsRetrieve.mockResolvedValue({
      status: 'active',
      trial_end: null,
      metadata: { organization_id: 'org_1' },
      items: { data: [subItem({ priceId: 'price_plus_456', lookupKey: null })] },
    })

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { plan: 'plus' },
    })
  })

  it('checkout.session.completed: ukendt price → plan IKKE opdateret + fejl logget', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_3',
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', customer: 'cus_1', subscription: 'sub_1' } },
    })
    subscriptionsRetrieve.mockResolvedValue({
      status: 'active',
      trial_end: null,
      metadata: { organization_id: 'org_1' },
      items: { data: [subItem({ priceId: 'price_ukendt', lookupKey: null })] },
    })

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prismaMock.organization.update).not.toHaveBeenCalled()
    expect(captureError).toHaveBeenCalled()
  })

  it('customer.subscription.updated: opdaterer status + plan', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_4',
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_1',
          status: 'active',
          trial_end: null,
          items: { data: [subItem({ priceId: 'price_plus_456', lookupKey: 'plus' })] },
        },
      },
    })

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripe_customer_id: 'cus_1' } })
    )
    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { plan: 'plus' },
    })
  })

  it('customer.subscription.deleted: sætter status=canceled + plan=canceled', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_5',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_1' } },
    })

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripe_customer_id: 'cus_1' },
      data: { status: 'canceled' },
    })
    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { plan: 'canceled' },
    })
  })

  it('invoice.payment_failed: sætter status=past_due', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_6',
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_1' } },
    })

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripe_customer_id: 'cus_1' },
      data: { status: 'past_due' },
    })
  })

  it('invoice.payment_succeeded: rydder past_due → active, rører ikke canceled', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_7',
      type: 'invoice.payment_succeeded',
      data: { object: { customer: 'cus_1' } },
    })

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripe_customer_id: 'cus_1', status: { not: 'canceled' } },
      data: { status: 'active' },
    })
  })

  it('ukendt event-type ignoreres med 200', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_8',
      type: 'customer.created',
      data: { object: {} },
    })

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled()
    expect(prismaMock.subscription.updateMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Kør testen — forvent PASS (route'en blev ændret i Task 3)**

```bash
npx vitest run src/__tests__/api/webhooks-stripe.test.ts
```

Expected: Alle 10 tests PASS. Hvis nogen fejler, er det en reel bug i Task 3's route-ændring → debug route'en (ikke testen), medmindre en assertion modsiger den faktiske, ønskede DB-skrivning.

- [ ] **Step 3: Kør fuld suite + tsc som regressionsgate**

```bash
npx tsc --noEmit && npm test
```

Expected: Grøn.

- [ ] **Step 4: Commit (route-ændring fra Task 3 + tests sammen)**

```bash
git add src/app/api/webhooks/stripe/route.ts src/__tests__/api/webhooks-stripe.test.ts
git commit -m "feat(billing): korrekt plan-mapping + invoice.payment_succeeded-handler m. fuld webhook-test"
```

---

## Task 5: past_due gater dashboard-adgang (P1)

**Files:**

- Modify: `src/app/(dashboard)/layout.tsx:20-39`
- Create: `src/__tests__/billing-past-due-gate.test.ts`

Eksisterende gate (layout.tsx:25-38) gater kun `trial`-expired og `canceled`. `past_due` (sat i webhook ved `invoice.payment_failed`) gater intet. Vi udtrækker gate-beslutningen til en ren, testbar funktion og kalder den fra layout'et — så vi kan unit-teste logikken uden at rendere hele server-komponenten.

- [ ] **Step 1: Skriv fejlende test for gate-funktionen**

Opret `src/__tests__/billing-past-due-gate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldGateBilling } from '@/lib/billing/access-gate'

const FUTURE = new Date(Date.now() + 86_400_000)
const PAST = new Date(Date.now() - 86_400_000)

describe('shouldGateBilling', () => {
  it('gater udløbet trial', () => {
    expect(shouldGateBilling({ plan: 'trial', planExpiresAt: PAST, subStatus: null })).toBe(true)
  })

  it('gater ikke aktiv trial', () => {
    expect(shouldGateBilling({ plan: 'trial', planExpiresAt: FUTURE, subStatus: null })).toBe(false)
  })

  it('gater canceled plan', () => {
    expect(shouldGateBilling({ plan: 'canceled', planExpiresAt: null, subStatus: null })).toBe(true)
  })

  it('gater past_due subscription på aktiv plan', () => {
    expect(shouldGateBilling({ plan: 'basis', planExpiresAt: null, subStatus: 'past_due' })).toBe(
      true
    )
  })

  it('gater ikke aktiv betalende plan', () => {
    expect(shouldGateBilling({ plan: 'plus', planExpiresAt: null, subStatus: 'active' })).toBe(
      false
    )
  })

  it('gater ikke past_due hvis plan allerede canceled (undgå dobbelt-redirect-semantik)', () => {
    // canceled fanges allerede af canceled-grenen → forbliver true, men via plan ikke status
    expect(
      shouldGateBilling({ plan: 'canceled', planExpiresAt: null, subStatus: 'past_due' })
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Kør testen — forvent FAIL**

```bash
npx vitest run src/__tests__/billing-past-due-gate.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/billing/access-gate"`.

- [ ] **Step 3: Minimal impl af gate-funktionen**

Opret `src/lib/billing/access-gate.ts`:

```ts
/**
 * Afgør om en organisation skal gate-redirectes til /billing.
 * Ren funktion → unit-testbar uden at rendere server-komponenten.
 */
export function shouldGateBilling(input: {
  plan: string
  planExpiresAt: Date | null
  subStatus: string | null
}): boolean {
  const { plan, planExpiresAt, subStatus } = input

  const isExpiredTrial = plan === 'trial' && planExpiresAt != null && planExpiresAt < new Date()
  const isCanceled = plan === 'canceled'
  const isPastDue = plan !== 'canceled' && subStatus === 'past_due'

  return isExpiredTrial || isCanceled || isPastDue
}
```

- [ ] **Step 4: Wire gate-funktionen ind i layout'et**

I `src/app/(dashboard)/layout.tsx` udvid org-query (linje 20-23) til at hente subscription-status, og erstat den inline gate-logik (linje 25-39) med funktionskaldet:

```tsx
import { shouldGateBilling } from '@/lib/billing/access-gate'
```

```tsx
const org = await prisma.organization.findUnique({
  where: { id: session.user.organizationId },
  select: {
    plan: true,
    plan_expires_at: true,
    subscriptions: {
      where: { status: { not: 'canceled' } },
      select: { status: true },
      take: 1,
    },
  },
})

if (org) {
  const subStatus = org.subscriptions[0]?.status ?? null
  const gate = shouldGateBilling({
    plan: org.plan,
    planExpiresAt: org.plan_expires_at,
    subStatus,
  })

  if (gate) {
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') ?? ''
    const isAllowed = pathname.startsWith('/billing') || pathname.startsWith('/settings')

    if (!isAllowed) {
      redirect('/billing')
    }
  }
}
```

- [ ] **Step 5: Kør test + tsc + build**

```bash
npx vitest run src/__tests__/billing-past-due-gate.test.ts && npx tsc --noEmit && npm run build
```

Expected: Alle gate-tests PASS; tsc 0; build grøn (ingen Prisma-drift, query er gyldig mod schema — `subscriptions`-relationen findes på Organization).

- [ ] **Step 6: Commit**

```bash
git add src/lib/billing/access-gate.ts src/__tests__/billing-past-due-gate.test.ts "src/app/(dashboard)/layout.tsx"
git commit -m "feat(billing): past_due gater dashboard-adgang (redirect til /billing)"
```

---

## Task 6 (P2): Schema-felt + migration for processed_stripe_events

**Files:**

- Modify: `prisma/schema.prisma` (ny `ProcessedStripeEvent`-model)
- Create: `prisma/migrations/<timestamp>_add_processed_stripe_events/migration.sql`

**Forudsætning-check (kør FØRST):**

```bash
test -f prisma/migrations/0_init/migration.sql && test -f prisma/migrations/migration_lock.toml && echo "BASELINE OK" || echo "STOP: Stream A baseline mangler"
```

Expected: `BASELINE OK`. Hvis `STOP`, kør Stream A først.

- [ ] **Step 1: Tilføj model til schema.prisma**

Indsæt efter `Subscription`-modellen (efter linje 992):

```prisma
model ProcessedStripeEvent {
  event_id     String   @id
  event_type   String
  processed_at DateTime @default(now())

  @@index([processed_at])
}
```

- [ ] **Step 2: Generér migration OVENPÅ baseline (diff fra anvendt schema → ny schema)**

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_processed_stripe_events
DIR=$(ls -d prisma/migrations/*_add_processed_stripe_events | tail -1)
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$DIR/migration.sql"
cat "$DIR/migration.sql"
```

Expected output i `migration.sql` (kun den nye tabel — INGEN drop/recreate af eksisterende):

```sql
-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "ProcessedStripeEvent_processed_at_idx" ON "ProcessedStripeEvent"("processed_at");
```

Hvis diff'en indeholder DROP/ALTER på andre tabeller → STOP (baseline-drift); undersøg før du fortsætter.

- [ ] **Step 3: Verificér migration mod tom scratch-DB (samme mønster som Stream A Task 3)**

```bash
docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS chainhub_scratch;" -c "CREATE DATABASE chainhub_scratch;"
SCRATCH="postgresql://postgres:postgres@localhost:5432/chainhub_scratch"
DATABASE_URL="$SCRATCH" DIRECT_URL="$SCRATCH" npx prisma migrate deploy
DATABASE_URL="$SCRATCH" DIRECT_URL="$SCRATCH" npx prisma migrate status
docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS chainhub_scratch;"
```

Expected: `0_init` + `<ny>_add_processed_stripe_events` anvendes; status "up to date".

- [ ] **Step 4: Regenerér client + nulstil dev-DB onto historikken**

```bash
npx prisma generate
npx prisma migrate reset --force
```

Expected: client regenereret med `ProcessedStripeEvent`-typen; dev-DB grøn.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): processed_stripe_events-tabel til webhook-idempotens"
```

---

## Task 7 (P2): Webhook-idempotens-guard i route'en

**Files:**

- Modify: `src/app/api/webhooks/stripe/route.ts` (efter `constructEvent`, før switch)
- Modify: `src/__tests__/api/webhooks-stripe.test.ts` (idempotens-tests + mock-udvidelse)

Guard-design: efter signatur er verificeret, forsøg at indsætte `event.id` i `ProcessedStripeEvent`. Bruger `create` i en try/catch på Prismas unique-constraint-fejl (`P2002`) → hvis allerede set, returnér 200 tidligt uden at re-processere. Insert SKER før switch'en, så en crash midt i behandling ikke markerer eventet som processeret (Stripe retry får så lov at køre igen — men det er at foretrække frem for at miste et event; den eneste ikke-idempotente operation i route'en er `organization.update`/`subscription.upsert`, som alle er sidste-skrivning-vinder og dermed sikre at gentage). Dette er en bevidst at-least-once → effektivt-idempotent semantik.

- [ ] **Step 1: Udvid mocken i webhooks-stripe.test.ts**

Tilføj `processedStripeEvent` til `prismaMock` (efter `organization`-blokken):

```ts
  processedStripeEvent: {
    create: vi.fn(),
  },
```

…og i `beforeEach` default'er vi den til at lykkes (nyt event):

```ts
prismaMock.processedStripeEvent.create.mockResolvedValue({})
```

- [ ] **Step 2: Skriv fejlende idempotens-tests**

Tilføj til describe-blokken:

```ts
it('idempotens: allerede-processeret event returnerer 200 uden at re-processere', async () => {
  constructEvent.mockReturnValue({
    id: 'evt_dup',
    type: 'invoice.payment_failed',
    data: { object: { customer: 'cus_1' } },
  })
  // Simulér unique-constraint-violation (event allerede indsat)
  const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
  prismaMock.processedStripeEvent.create.mockRejectedValueOnce(p2002)

  const res = await POST(makeReq())
  expect(res.status).toBe(200)
  expect(prismaMock.subscription.updateMany).not.toHaveBeenCalled()
})

it('idempotens: nyt event registreres før behandling', async () => {
  constructEvent.mockReturnValue({
    id: 'evt_new',
    type: 'invoice.payment_failed',
    data: { object: { customer: 'cus_1' } },
  })

  const res = await POST(makeReq())
  expect(res.status).toBe(200)
  expect(prismaMock.processedStripeEvent.create).toHaveBeenCalledWith({
    data: { event_id: 'evt_new', event_type: 'invoice.payment_failed' },
  })
  expect(prismaMock.subscription.updateMany).toHaveBeenCalled()
})
```

- [ ] **Step 3: Kør — forvent FAIL**

```bash
npx vitest run src/__tests__/api/webhooks-stripe.test.ts
```

Expected: De 2 nye tests FEJLER (`create` kaldes ikke endnu / dup-event re-processerer).

- [ ] **Step 4: Impl guard i route'en**

Tilføj import øverst:

```ts
import { Prisma } from '@prisma/client'
```

Indsæt mellem `constructEvent`-try/catch-blokken (efter linje 58) og `try { switch... }` (linje 60):

```ts
// Idempotens: registrér event-ID før behandling. Allerede-set → 200 tidligt.
try {
  await prisma.processedStripeEvent.create({
    data: { event_id: event.id, event_type: event.type },
  })
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return NextResponse.json({ received: true, duplicate: true })
  }
  captureError(err, {
    namespace: 'api:webhooks:stripe',
    extra: { step: 'idempotency-insert', eventId: event.id },
  })
  return NextResponse.json({ error: 'Intern fejl ved idempotens-tjek' }, { status: 500 })
}
```

Bemærk: testens mock kaster et plain `Error` med `code: 'P2002'` (ikke en ægte `PrismaClientKnownRequestError`-instans). For at testen og prod-koden stemmer, brug en duck-typed check i stedet for `instanceof`:

```ts
  } catch (err) {
    const code = (err as { code?: string } | null)?.code
    if (code === 'P2002') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    captureError(err, {
      namespace: 'api:webhooks:stripe',
      extra: { step: 'idempotency-insert', eventId: event.id },
    })
    return NextResponse.json({ error: 'Intern fejl ved idempotens-tjek' }, { status: 500 })
  }
```

(Vælg duck-typed-varianten — den undgår `@prisma/client`-import-afhængighed i route'en og matcher testens mock 1:1. `instanceof`-varianten er kun listet som alternativ hvis teamet foretrækker den ægte Prisma-type og opdaterer testen til at kaste en rigtig `PrismaClientKnownRequestError`.)

- [ ] **Step 5: Kør test + tsc — forvent PASS**

```bash
npx vitest run src/__tests__/api/webhooks-stripe.test.ts && npx tsc --noEmit
```

Expected: Alle (12) tests PASS; tsc 0.

- [ ] **Step 6: Fuld suite + commit**

```bash
npm test
git add src/app/api/webhooks/stripe/route.ts src/__tests__/api/webhooks-stripe.test.ts
git commit -m "feat(billing): webhook-idempotens via processed_stripe_events (at-least-once guard)"
```

---

## Stream B exit-gate

- [ ] `STRIPE_BASIS/PLUS_PRICE_ID` kaster ved manglende værdi i prod (Task 1 bevist via test).
- [ ] Checkout skriver korrekt `org.plan` ('basis'/'plus') via lookup_key ELLER price-ID; ukendt price logger og skriver ikke forkert plan (Task 2+3+4).
- [ ] `invoice.payment_succeeded` rydder `past_due` → `active` uden at røre canceled (Task 3+4).
- [ ] `past_due` redirecter til `/billing` (Task 5).
- [ ] `src/__tests__/api/webhooks-stripe.test.ts` dækker: checkout.session.completed (lookup_key + price-ID + ukendt), subscription.updated, subscription.deleted, payment_failed, payment_succeeded, ugyldig signatur→400, manglende signatur→400, ukendt event→200, idempotens (Task 4+7).
- [ ] (P2) `ProcessedStripeEvent`-migration kører grønt ovenpå `0_init` mod tom DB; idempotens-guard aktiv (Task 6+7).
- [ ] `npm test` + `npx tsc --noEmit` + `npm run build` grønne.

---

## Self-review-noter

- **Spec-dækning:** Alle 6 scope-items dækket — (a) Task 1, (b) Task 2+3, (c) Task 3, (d) Task 5, (e) Task 4, (f) Task 6+7. ✅
- **Ikke-forhandlingsbare regler:** Alle webhook-Prisma-skriv beholder `organization_id`-scope (via subscription-lookup på `stripe_customer_id` → `organization_id`). Ingen `any` (kun `Stripe.*`-typer + duck-typed `code`-narrowing i ét catch). Env udelukkende via `src/lib/env.ts`. Server Actions ikke rørt (billing.ts uændret — `org_id` aldrig parameter). Danske commits. ✅
- **TDD-afvigelse i Task 3/4:** Route-ændringen (Task 3) committes IKKE før dens tests (Task 4) er grønne; de committes sammen i Task 4 Step 4. Dette er bevidst — webhook-route'en kan ikke meningsfuldt testes i isolerede mikro-trin uden hele mock-riggen, så RED/GREEN-cyklussen ligger på fil-niveau (Task 4-testene er RED indtil Task 3's impl er på plads). Alternativ overvejet og forkastet: skrive testene mod den UÆNDREDE route først (ville kræve at asserte den forkerte `'standard'`-adfærd, hvilket er meningsløst).
- **Soft-delete-undtagelse:** `Subscription` og `ProcessedStripeEvent` har bevidst INGEN `deleted_at` (de er ikke i soft-delete-listen i CLAUDE.md regel 4: contracts/cases/companies/persons/documents). Webhook-queries på subscriptions filtrerer derfor ikke på `deleted_at` — korrekt mod schema.
- **past_due-redirect-loop-risiko:** `/billing` og `/settings` er whitelisted i gate'en (uændret fra eksisterende kode), så en past_due-bruger kan stadig nå betalingssiden for at genoprette. ✅

---

## Åbne beslutninger (parent skal review'e)

### Beslutning 1 — `checkout`-upsert `create.plan` når plan er ukendt

Når `planFromPrice` returnerer `null` i `checkout.session.completed` OG der ikke findes en eksisterende subscription-række (create-grenen i upsert), kræver schema'et en ikke-null `plan`-streng. Planen bruger `plan ?? 'trial'` som create-default (Option A nedenfor). To konkret-kodede optioner:

- **Option A (valgt i Task 3 Step 2):** `create: { ..., plan: plan ?? 'trial', ... }` — falder tilbage til `'trial'`, en plan-streng `billing-client.tsx` allerede kender, og logger fejlen. Risiko: en betalende kunde med ukendt price vises som "Prøveperiode" indtil næste `subscription.updated` retter den.
- **Option B:** Drop hele subscription-skrivningen når plan er ukendt: `if (!plan) { captureError(...); break }` FØR upsert. Risiko: ingen subscription-række oprettes overhovedet → kunden har betalt men ingen DB-spor før manuelt indgreb. Mere "fail-loud" men efterlader betalt kunde uden adgang.

Anbefaling: Option A (defensiv + selvhelende via senere `subscription.updated`), men dette forudsætter at Philip faktisk sætter `lookup_key`/price-IDs korrekt i Stripe, hvilket gør `null`-grenen til en ren sikkerhedsnet-edge. Bekræft valg.

### Beslutning 2 — idempotens-insert-placering (før vs. efter behandling)

Planen indsætter `ProcessedStripeEvent` FØR switch-behandling (at-least-once: en crash midt i behandling markerer ikke eventet, så Stripe-retry kører igen). Alternativ: indsæt EFTER succesfuld behandling (at-most-once for selve insert, men så er der et vindue hvor to samtidige leverancer af samme event begge passerer guarden). Planen vælger før-placering fordi alle route-skrivninger er last-write-wins-idempotente (`upsert`/`updateMany` med fast data), så at gentage dem er harmløst, mens at TABE et event (canceled der aldrig registreres) er skadeligt. Bekræft at at-least-once-semantikken er acceptabel.
