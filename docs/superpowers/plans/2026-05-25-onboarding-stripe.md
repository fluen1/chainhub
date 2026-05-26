# Onboarding + Stripe Billing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-service signup with 14-day trial + Stripe billing so new organizations can onboard without manual provisioning.

**Architecture:** 2-step signup wizard creates Organization+User, auto-starts 14-day trial. Stripe Checkout for plan selection, webhooks for status sync, Customer Portal for self-service. Subscription gate in layout blocks expired trials.

**Tech Stack:** Next.js 16, Prisma 6, Stripe (checkout + webhooks + portal), NextAuth 4, Resend

**Spec:** `docs/superpowers/specs/2026-05-25-onboarding-stripe-design.md`

**Existing infrastructure:**

- `Subscription` model already in `prisma/schema.prisma` (line 892) with `stripe_customer_id`, `stripe_subscription_id`, `status`, `trial_ends_at`
- `Organization.plan` (String, default "trial") + `Organization.plan_expires_at` (DateTime?) already exist
- `OnboardingPanel` component built but not mounted
- `FakturaSection` placeholder in settings ready for billing portal link

---

## Task 1: Schema Updates + Stripe Package

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `src/lib/env.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Stripe packages**

```bash
npm install stripe @stripe/stripe-js
```

- [ ] **Step 2: Add Stripe env vars to src/lib/env.ts**

Add to the Zod schema:

```typescript
STRIPE_SECRET_KEY: z.string().optional(),
STRIPE_WEBHOOK_SECRET: z.string().optional(),
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
STRIPE_STARTER_PRICE_ID: z.string().optional(),
STRIPE_PROFESSIONAL_PRICE_ID: z.string().optional(),
```

- [ ] **Step 3: Add industry and estimated_locations to Organization**

In `prisma/schema.prisma`, add to the Organization model (after `chain_structure`):

```prisma
industry             String?
estimated_locations  String?
```

- [ ] **Step 4: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma src/lib/env.ts
git commit -m "feat(onboarding): Stripe packages + schema prep"
```

---

## Task 2: Signup Wizard (2 Steps)

**Files:**

- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(auth)/signup/organization/page.tsx`
- Create: `src/actions/signup.ts`
- Create: `src/__tests__/actions/signup.test.ts`

- [ ] **Step 1: Write failing test for createAccount**

```typescript
// src/__tests__/actions/signup.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn().mockResolvedValue({
      user: { id: 'u1', email: 'test@test.dk' },
      organization: { id: 'org1', name: 'Test Org' },
    }),
  },
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed') },
}))

import { createAccount } from '@/actions/signup'

describe('createAccount', () => {
  it('returnerer success med user og org id', async () => {
    const result = await createAccount({
      name: 'Test User',
      email: 'test@test.dk',
      password: 'password123',
    })
    expect(result.data).toBeDefined()
    expect(result.error).toBeUndefined()
  })

  it('afviser for kort password', async () => {
    const result = await createAccount({
      name: 'Test',
      email: 'test@test.dk',
      password: '123',
    })
    expect(result.error).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/__tests__/actions/signup.test.ts`

- [ ] **Step 3: Implement createAccount action**

```typescript
// src/actions/signup.ts
'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types'

const createAccountSchema = z.object({
  name: z.string().min(2, 'Navn skal være mindst 2 tegn'),
  email: z.string().email('Ugyldig e-mail'),
  password: z.string().min(8, 'Adgangskode skal være mindst 8 tegn'),
})

const updateOrgSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1, 'Organisationsnavn er påkrævet'),
  industry: z.string().optional(),
  estimatedLocations: z.string().optional(),
})

export async function createAccount(
  input: z.infer<typeof createAccountSchema>
): Promise<ActionResult<{ userId: string; organizationId: string }>> {
  const parsed = createAccountSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }
  }

  const { name, email, password } = parsed.data
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const existing = await prisma.user.findFirst({
      where: { email: normalizedEmail, deleted_at: null },
    })
    if (existing) {
      return { error: 'En konto med denne e-mail findes allerede' }
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `${name.split(' ').pop() ?? name} Holding`,
          plan: 'trial',
          plan_expires_at: trialEndsAt,
        },
      })

      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          password_hash: passwordHash,
          organization_id: organization.id,
          active: true,
        },
      })

      await tx.userRoleAssignment.create({
        data: {
          user_id: user.id,
          organization_id: organization.id,
          role: 'GROUP_OWNER',
        },
      })

      return { user, organization }
    })

    return {
      data: {
        userId: result.user.id,
        organizationId: result.organization.id,
      },
    }
  } catch (err) {
    captureError(err, { namespace: 'action:createAccount', extra: { email: normalizedEmail } })
    return { error: 'Kunne ikke oprette konto — prøv igen' }
  }
}

export async function updateOrganizationOnboarding(
  input: z.infer<typeof updateOrgSchema>
): Promise<ActionResult<{ success: boolean }>> {
  const parsed = updateOrgSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }
  }

  try {
    await prisma.organization.update({
      where: { id: parsed.data.organizationId },
      data: {
        name: parsed.data.name,
        industry: parsed.data.industry ?? null,
        estimated_locations: parsed.data.estimatedLocations ?? null,
      },
    })
    return { data: { success: true } }
  } catch (err) {
    captureError(err, { namespace: 'action:updateOrganizationOnboarding' })
    return { error: 'Kunne ikke opdatere organisation' }
  }
}
```

- [ ] **Step 4: Create signup step 1 page**

```typescript
// src/app/(auth)/signup/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { createAccount } from '@/actions/signup'
import { toast } from 'sonner'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const name = form.get('name') as string
    const email = form.get('email') as string
    const password = form.get('password') as string

    const result = await createAccount({ name, email, password })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Auto-login
    const signInResult = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (signInResult?.error) {
      toast.error('Konto oprettet — log ind manuelt')
      router.push('/login')
    } else {
      router.push('/signup/organization')
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-b-canvas p-4">
      <div className="w-full max-w-md rounded-xl border border-b-border bg-b-panel p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-b-1">Opret konto</h1>
          <p className="mt-1 text-sm text-b-3">14 dages gratis prøveperiode — intet kreditkort</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-b-2">
              Fuldt navn
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded-md border border-b-border bg-white px-3 py-2 text-sm"
              placeholder="Dit fulde navn"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-b-2">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-b-border bg-white px-3 py-2 text-sm"
              placeholder="din@virksomhed.dk"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-b-2">
              Adgangskode
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-b-border bg-white px-3 py-2 text-sm"
              placeholder="Mindst 8 tegn"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-b-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-b-accent/90 disabled:opacity-50"
          >
            {loading ? 'Opretter...' : 'Opret gratis konto'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-b-3">
          Har du allerede en konto?{' '}
          <Link href="/login" className="text-b-accent hover:underline">
            Log ind
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create signup step 2 page**

```typescript
// src/app/(auth)/signup/organization/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { updateOrganizationOnboarding } from '@/actions/signup'
import { toast } from 'sonner'

const INDUSTRIES = [
  { value: '', label: 'Vælg branche (valgfrit)' },
  { value: 'dental', label: 'Tandlæge' },
  { value: 'optician', label: 'Optiker' },
  { value: 'physio', label: 'Fysioterapi' },
  { value: 'restaurant', label: 'Restauration' },
  { value: 'retail', label: 'Detailhandel' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'other', label: 'Andet' },
]

export default function OrganizationSetupPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!session?.user?.organizationId) return

    setLoading(true)
    const form = new FormData(e.currentTarget)

    const result = await updateOrganizationOnboarding({
      organizationId: session.user.organizationId,
      name: form.get('orgName') as string,
      industry: (form.get('industry') as string) || undefined,
      estimatedLocations: (form.get('locations') as string) || undefined,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-b-canvas p-4">
      <div className="w-full max-w-md rounded-xl border border-b-border bg-b-panel p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-b-1">Din organisation</h1>
          <p className="mt-1 text-sm text-b-3">Vi tilpasser oplevelsen til dig</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="orgName" className="mb-1 block text-sm font-medium text-b-2">
              Organisationsnavn
            </label>
            <input
              id="orgName"
              name="orgName"
              type="text"
              required
              className="w-full rounded-md border border-b-border bg-white px-3 py-2 text-sm"
              placeholder="Fx MitHolding ApS"
            />
          </div>

          <div>
            <label htmlFor="industry" className="mb-1 block text-sm font-medium text-b-2">
              Branche
            </label>
            <select
              id="industry"
              name="industry"
              className="w-full rounded-md border border-b-border bg-white px-3 py-2 text-sm"
            >
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="locations" className="mb-1 block text-sm font-medium text-b-2">
              Antal lokationer
            </label>
            <select
              id="locations"
              name="locations"
              className="w-full rounded-md border border-b-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Vælg (valgfrit)</option>
              <option value="1-5">1-5 lokationer</option>
              <option value="6-25">6-25 lokationer</option>
              <option value="26+">26+ lokationer</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-b-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-b-accent/90 disabled:opacity-50"
          >
            {loading ? 'Gemmer...' : 'Fortsæt til dashboard'}
          </button>
        </form>

        <button
          onClick={() => router.push('/dashboard')}
          className="mt-3 w-full text-center text-sm text-b-3 hover:text-b-2"
        >
          Spring over
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Add "Opret konto" link to login page**

In `src/app/(auth)/login/page.tsx`, find the bottom section and add:

```tsx
<p className="mt-4 text-center text-sm text-b-3">
  Ingen konto endnu?{' '}
  <Link href="/signup" className="text-b-accent hover:underline">
    Opret gratis konto
  </Link>
</p>
```

- [ ] **Step 7: Run tests + typecheck**

```bash
npx vitest run && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/app/\(auth\)/signup/ src/actions/signup.ts src/__tests__/ src/app/\(auth\)/login/
git commit -m "feat(onboarding): 2-step signup wizard med auto-login + 14d trial"
```

---

## Task 3: Mount OnboardingPanel in Dashboard

**Files:**

- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Read current dashboard page**

Read `src/app/(dashboard)/dashboard/page.tsx` to find where to import and render `OnboardingPanel`.

- [ ] **Step 2: Add OnboardingPanel import and render**

At the top of the dashboard page component, before or after the KPI cards:

```typescript
import { OnboardingPanel } from '@/components/dashboard/b/OnboardingPanel'

// Inside the return JSX, before the main content:
<OnboardingPanel />
```

The `OnboardingPanel` is an async Server Component that internally calls `getOnboardingStatus()` and returns `null` if it shouldn't show. No conditional needed in the parent.

- [ ] **Step 3: Run typecheck + build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/
git commit -m "feat(onboarding): mount OnboardingPanel i dashboard"
```

---

## Task 4: Stripe Integration (Checkout + Webhooks + Portal)

**Files:**

- Create: `src/lib/stripe.ts`
- Create: `src/actions/billing.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`
- Create: `src/__tests__/actions/billing.test.ts`

- [ ] **Step 1: Create Stripe client singleton**

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  stripeInstance = new Stripe(key, { apiVersion: '2025-12-18.acacia' })
  return stripeInstance
}
```

Check the latest Stripe API version at import time and use it. If `2025-12-18.acacia` doesn't exist in the installed Stripe package's TypeScript types, use whatever version the installed `stripe` package exports as its latest.

- [ ] **Step 2: Create billing actions**

```typescript
// src/actions/billing.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types'

export async function createCheckoutSession(
  priceId: string
): Promise<ActionResult<{ url: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const stripe = getStripe()
  if (!stripe) return { error: 'Betaling er ikke konfigureret' }

  const orgId = session.user.organizationId

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { subscriptions: true },
    })
    if (!org) return { error: 'Organisation ikke fundet' }

    let customerId = org.subscriptions[0]?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        name: org.name,
        metadata: { organization_id: orgId },
      })
      customerId = customer.id
    }

    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`,
      subscription_data: {
        trial_end: org.plan_expires_at
          ? Math.floor(org.plan_expires_at.getTime() / 1000)
          : undefined,
        metadata: { organization_id: orgId },
      },
    })

    if (!checkoutSession.url) return { error: 'Kunne ikke oprette betalingssession' }
    return { data: { url: checkoutSession.url } }
  } catch (err) {
    captureError(err, { namespace: 'action:createCheckoutSession' })
    return { error: 'Fejl ved oprettelse af betalingssession' }
  }
}

export async function createPortalSession(): Promise<ActionResult<{ url: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const stripe = getStripe()
  if (!stripe) return { error: 'Betaling er ikke konfigureret' }

  try {
    const sub = await prisma.subscription.findFirst({
      where: { organization_id: session.user.organizationId },
    })
    if (!sub?.stripe_customer_id) return { error: 'Intet aktivt abonnement' }

    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/settings?section=faktura`,
    })

    return { data: { url: portalSession.url } }
  } catch (err) {
    captureError(err, { namespace: 'action:createPortalSession' })
    return { error: 'Fejl ved oprettelse af administrationssession' }
  }
}
```

- [ ] **Step 3: Create webhook endpoint**

```typescript
// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { captureError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.subscription
          ? (await stripe.subscriptions.retrieve(session.subscription as string)).metadata
              .organization_id
          : null

        if (orgId && session.customer && session.subscription) {
          await prisma.subscription.upsert({
            where: { organization_id: orgId },
            create: {
              organization_id: orgId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              status: 'active',
              plan: 'starter',
            },
            update: {
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              status: 'active',
            },
          })

          await prisma.organization.update({
            where: { id: orgId },
            data: { plan: 'starter' },
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata.organization_id
        if (!orgId) break

        const status =
          subscription.status === 'active'
            ? 'active'
            : subscription.status === 'trialing'
              ? 'trialing'
              : subscription.status === 'past_due'
                ? 'past_due'
                : 'canceled'

        await prisma.subscription.updateMany({
          where: { organization_id: orgId },
          data: {
            status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
          },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata.organization_id
        if (orgId) {
          await prisma.subscription.updateMany({
            where: { organization_id: orgId },
            data: { status: 'canceled' },
          })
          await prisma.organization.update({
            where: { id: orgId },
            data: { plan: 'canceled' },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = invoice.subscription as string | null
        if (subId) {
          await prisma.subscription.updateMany({
            where: { stripe_subscription_id: subId },
            data: { status: 'past_due' },
          })
        }
        break
      }
    }
  } catch (err) {
    captureError(err, { namespace: 'webhook:stripe', extra: { eventType: event.type } })
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 4: Write billing test**

```typescript
// src/__tests__/actions/billing.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    subscription: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/stripe', () => ({ getStripe: vi.fn().mockReturnValue(null) }))

import { auth } from '@/lib/auth'
import { createCheckoutSession, createPortalSession } from '@/actions/billing'

describe('billing actions', () => {
  it('createCheckoutSession afviser uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createCheckoutSession('price_xxx')
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('createCheckoutSession returnerer fejl uden Stripe', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', organizationId: 'org1' },
    } as never)
    const result = await createCheckoutSession('price_xxx')
    expect(result.error).toBe('Betaling er ikke konfigureret')
  })

  it('createPortalSession afviser uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createPortalSession()
    expect(result.error).toBe('Ikke autoriseret')
  })
})
```

- [ ] **Step 5: Run tests + typecheck**

```bash
npx vitest run && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe.ts src/actions/billing.ts src/app/api/webhooks/stripe/ src/__tests__/actions/billing.test.ts
git commit -m "feat(billing): Stripe checkout + webhooks + portal actions"
```

---

## Task 5: Billing Page + Trial Banner

**Files:**

- Create: `src/app/(dashboard)/billing/page.tsx`
- Create: `src/components/layout/TrialBanner.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/settings/settings-b.tsx` (FakturaSection)

- [ ] **Step 1: Create billing page**

```typescript
// src/app/(dashboard)/billing/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { BillingClient } from './billing-client'

export default async function BillingPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    include: { subscriptions: true },
  })

  if (!org) redirect('/login')

  const sub = org.subscriptions[0]
  const trialDaysLeft = org.plan_expires_at
    ? Math.max(0, Math.ceil((org.plan_expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <BillingClient
      plan={org.plan}
      trialDaysLeft={trialDaysLeft}
      hasSubscription={!!sub?.stripe_subscription_id}
      starterPriceId={process.env.STRIPE_STARTER_PRICE_ID ?? ''}
      professionalPriceId={process.env.STRIPE_PROFESSIONAL_PRICE_ID ?? ''}
    />
  )
}
```

Create the client component `src/app/(dashboard)/billing/billing-client.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createCheckoutSession, createPortalSession } from '@/actions/billing'
import { toast } from 'sonner'

interface BillingClientProps {
  plan: string
  trialDaysLeft: number
  hasSubscription: boolean
  starterPriceId: string
  professionalPriceId: string
}

export function BillingClient({
  plan,
  trialDaysLeft,
  hasSubscription,
  starterPriceId,
  professionalPriceId,
}: BillingClientProps) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleSelectPlan(priceId: string) {
    setLoading(priceId)
    const result = await createCheckoutSession(priceId)
    if (result.error) {
      toast.error(result.error)
      setLoading(null)
      return
    }
    if (result.data?.url) {
      window.location.href = result.data.url
    }
  }

  async function handleManage() {
    const result = await createPortalSession()
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.data?.url) {
      window.location.href = result.data.url
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold text-b-1">Abonnement</h1>

      {plan === 'trial' && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Du har <strong>{trialDaysLeft} dage</strong> tilbage af din gratis prøveperiode.
            Vælg en plan for at fortsætte efter prøveperioden.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Starter */}
        <div className="rounded-xl border border-b-border bg-b-panel p-6">
          <h2 className="text-lg font-semibold text-b-1">Starter</h2>
          <p className="mt-1 text-sm text-b-3">Op til 5 lokationer, 5 brugere</p>
          <p className="mt-4 text-3xl font-bold text-b-1">799 kr<span className="text-base font-normal text-b-3">/md</span></p>
          <ul className="mt-4 space-y-2 text-sm text-b-2">
            <li>✓ Alle moduler inkluderet</li>
            <li>✓ AI-dokumentanalyse</li>
            <li>✓ Email-notifikationer</li>
          </ul>
          <button
            onClick={() => handleSelectPlan(starterPriceId)}
            disabled={!!loading || !starterPriceId}
            className="mt-6 w-full rounded-md bg-b-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-b-accent/90 disabled:opacity-50"
          >
            {loading === starterPriceId ? 'Åbner...' : 'Vælg Starter'}
          </button>
        </div>

        {/* Professional */}
        <div className="rounded-xl border-2 border-b-accent bg-b-panel p-6">
          <h2 className="text-lg font-semibold text-b-1">Professional</h2>
          <p className="mt-1 text-sm text-b-3">Op til 25 lokationer, ubegrænset brugere</p>
          <p className="mt-4 text-3xl font-bold text-b-1">1.999 kr<span className="text-base font-normal text-b-3">/md</span></p>
          <ul className="mt-4 space-y-2 text-sm text-b-2">
            <li>✓ Alt i Starter</li>
            <li>✓ Ubegrænset brugere</li>
            <li>✓ Prioriteret support</li>
          </ul>
          <button
            onClick={() => handleSelectPlan(professionalPriceId)}
            disabled={!!loading || !professionalPriceId}
            className="mt-6 w-full rounded-md bg-b-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-b-accent/90 disabled:opacity-50"
          >
            {loading === professionalPriceId ? 'Åbner...' : 'Vælg Professional'}
          </button>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-b-3">
          26+ lokationer?{' '}
          <a href="mailto:kontakt@chainhub.dk" className="text-b-accent hover:underline">
            Kontakt os for Enterprise-priser
          </a>
        </p>
      </div>

      {hasSubscription && (
        <div className="mt-8 border-t border-b-border pt-6">
          <button
            onClick={handleManage}
            className="text-sm text-b-accent hover:underline"
          >
            Administrér abonnement (faktura, betalingsmetode, opsigelse)
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create TrialBanner component**

```typescript
// src/components/layout/TrialBanner.tsx
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'

export async function TrialBanner() {
  const session = await auth()
  if (!session) return null

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { plan: true, plan_expires_at: true },
  })

  if (!org || org.plan !== 'trial' || !org.plan_expires_at) return null

  const daysLeft = Math.max(
    0,
    Math.ceil((org.plan_expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  )

  if (daysLeft > 7) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800">
      <span>
        {daysLeft === 0
          ? 'Din prøveperiode er udløbet.'
          : `${daysLeft} dag${daysLeft === 1 ? '' : 'e'} tilbage af din prøveperiode.`}
      </span>
      <Link
        href="/billing"
        className="font-medium text-amber-900 underline hover:no-underline"
      >
        Vælg plan
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Add TrialBanner to dashboard layout**

In `src/app/(dashboard)/layout.tsx`, import and render `TrialBanner` above the `BShell`:

```typescript
import { TrialBanner } from '@/components/layout/TrialBanner'

// In the return JSX, before <BShell>:
<TrialBanner />
<BShell sidebarData={sidebarData}>{children}</BShell>
```

- [ ] **Step 4: Update FakturaSection in settings**

In `src/app/(dashboard)/settings/settings-b.tsx`, find the `FakturaSection` placeholder and replace with a link to `/billing`:

```typescript
// Replace the placeholder text with:
<div className="space-y-4">
  <p className="text-sm text-b-2">
    Administrér dit abonnement, se fakturaer og opdatér betalingsmetode.
  </p>
  <Link
    href="/billing"
    className="inline-flex items-center rounded-md bg-b-accent px-4 py-2 text-sm font-medium text-white hover:bg-b-accent/90"
  >
    Gå til abonnement
  </Link>
</div>
```

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/billing/ src/components/layout/TrialBanner.tsx src/app/\(dashboard\)/layout.tsx src/app/\(dashboard\)/settings/
git commit -m "feat(billing): billing page + trial banner + faktura-link i settings"
```

---

## Task 6: Subscription Gate

**Files:**

- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add subscription check to dashboard layout**

In `src/app/(dashboard)/layout.tsx`, after the session check, add a subscription gate:

```typescript
// After: const session = await auth()
// After: if (!session) redirect('/login')

const org = await prisma.organization.findUnique({
  where: { id: session.user.organizationId },
  select: { plan: true, plan_expires_at: true },
})

// Check if trial has expired
if (org?.plan === 'trial' && org.plan_expires_at && org.plan_expires_at < new Date()) {
  // Allow access to billing and settings only
  // This check is in layout — individual pages still render
  // The TrialBanner handles the visual warning
  // For hard blocking: check the current pathname
}

// For hard blocking after grace period, use middleware or a client-side redirect
```

Actually, the simplest approach: in layout, check if expired and if the current page is NOT `/billing` or `/settings`, redirect:

```typescript
import { headers } from 'next/headers'

// After org query:
if (org?.plan === 'trial' && org.plan_expires_at && org.plan_expires_at < new Date()) {
  const headersList = await headers()
  const pathname = headersList.get('x-next-pathname') || ''
  if (!pathname.startsWith('/billing') && !pathname.startsWith('/settings')) {
    redirect('/billing')
  }
}

if (org?.plan === 'canceled') {
  const headersList = await headers()
  const pathname = headersList.get('x-next-pathname') || ''
  if (!pathname.startsWith('/billing') && !pathname.startsWith('/settings')) {
    redirect('/billing')
  }
}
```

Note: `x-next-pathname` may not be available. Alternative: use `next/navigation`'s `usePathname` in a client component wrapper, or put the gate in middleware. Read the current layout to find the best approach — the middleware already uses `withAuth` and can be extended.

The simplest reliable approach: add `/billing` to the middleware matcher (so it's auth-protected), and add the subscription gate as a separate middleware or in the layout using the URL from the request.

- [ ] **Step 2: Add billing to middleware matcher**

In `src/middleware.ts`, add `/billing/:path*` to the matcher array.

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx src/middleware.ts
git commit -m "feat(billing): subscription gate — redirect udløbne trials til /billing"
```

---

## Task 7: Invite Flow

**Files:**

- Create: `src/app/(auth)/invite/page.tsx`
- Modify: `src/actions/users.ts` (add inviteUser + acceptInvite)
- Modify: `src/lib/email/resend.ts` (add sendInviteEmail)

- [ ] **Step 1: Add InviteToken model to schema**

In `prisma/schema.prisma`, add:

```prisma
model InviteToken {
  id              String   @id @default(uuid())
  token           String   @unique
  email           String
  role            String
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  expires_at      DateTime
  used_at         DateTime?
  created_by      String
  created_at      DateTime @default(now())

  @@index([token])
  @@index([organization_id])
}
```

Add relation to Organization model: `invite_tokens InviteToken[]`

Run: `npx prisma generate`

- [ ] **Step 2: Add sendInviteEmail to resend.ts**

```typescript
export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  orgName: string,
  inviterName: string
) {
  if (!resend) {
    console.warn('RESEND_API_KEY ikke konfigureret — invite email springes over')
    return
  }

  await resend.emails.send({
    from: DIGEST_FROM,
    to,
    subject: `Du er inviteret til ${orgName} — ChainHub`,
    html: `
      <h2>Hej,</h2>
      <p>${inviterName} har inviteret dig til <strong>${orgName}</strong> på ChainHub.</p>
      <p><a href="${inviteUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Acceptér invitation</a></p>
      <p>Linket udløber om 7 dage.</p>
      <p>Venlig hilsen,<br/>ChainHub</p>
    `,
  })
}
```

- [ ] **Step 3: Add inviteUser action to users.ts**

```typescript
export async function inviteUser(input: {
  email: string
  role: string
}): Promise<ActionResult<{ success: boolean }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const schema = z.object({
    email: z.string().email('Ugyldig e-mail'),
    role: z.string().min(1),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const orgId = session.user.organizationId
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  try {
    await prisma.inviteToken.create({
      data: {
        token,
        email: parsed.data.email.trim().toLowerCase(),
        role: parsed.data.role,
        organization_id: orgId,
        expires_at: expiresAt,
        created_by: session.user.id,
      },
    })

    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const inviteUrl = `${appUrl}/invite?token=${token}`

    await sendInviteEmail(
      parsed.data.email,
      inviteUrl,
      org?.name ?? 'ChainHub',
      session.user.name ?? 'En kollega'
    )

    return { data: { success: true } }
  } catch (err) {
    captureError(err, { namespace: 'action:inviteUser' })
    return { error: 'Kunne ikke sende invitation' }
  }
}
```

- [ ] **Step 4: Create invite acceptance page**

```typescript
// src/app/(auth)/invite/page.tsx
'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { acceptInvite } from '@/actions/users'
import { toast } from 'sonner'

export default function InvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const name = form.get('name') as string
    const password = form.get('password') as string

    const result = await acceptInvite({ token, name, password })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    const email = result.data?.email
    if (email) {
      await signIn('credentials', { email, password, redirect: false })
      router.push('/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-b-canvas p-4">
      <div className="w-full max-w-md rounded-xl border border-b-border bg-b-panel p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-b-1">Acceptér invitation</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-b-2">Fuldt navn</label>
            <input id="name" name="name" type="text" required className="w-full rounded-md border border-b-border bg-white px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-b-2">Adgangskode</label>
            <input id="password" name="password" type="password" required minLength={8} className="w-full rounded-md border border-b-border bg-white px-3 py-2 text-sm" placeholder="Mindst 8 tegn" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-md bg-b-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-b-accent/90 disabled:opacity-50">
            {loading ? 'Opretter...' : 'Opret konto og log ind'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add acceptInvite action to users.ts**

```typescript
export async function acceptInvite(input: {
  token: string
  name: string
  password: string
}): Promise<ActionResult<{ email: string }>> {
  const schema = z.object({
    token: z.string().uuid(),
    name: z.string().min(2),
    password: z.string().min(8),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  try {
    const invite = await prisma.inviteToken.findUnique({
      where: { token: parsed.data.token },
    })

    if (!invite) return { error: 'Ugyldigt invitationslink' }
    if (invite.used_at) return { error: 'Denne invitation er allerede brugt' }
    if (invite.expires_at < new Date()) return { error: 'Invitationslinket er udløbet' }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12)

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: invite.email,
          password_hash: passwordHash,
          organization_id: invite.organization_id,
          active: true,
        },
      })

      await tx.userRoleAssignment.create({
        data: {
          user_id: user.id,
          organization_id: invite.organization_id,
          role: invite.role,
        },
      })

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { used_at: new Date() },
      })
    })

    return { data: { email: invite.email } }
  } catch (err) {
    captureError(err, { namespace: 'action:acceptInvite' })
    return { error: 'Kunne ikke oprette konto' }
  }
}
```

- [ ] **Step 6: Run tests + typecheck**

```bash
npx prisma generate && npx tsc --noEmit && npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/app/\(auth\)/invite/ src/actions/users.ts src/lib/email/resend.ts
git commit -m "feat(onboarding): invite-flow med token-email og accept-side"
```

---

# Final Verification

After all 7 tasks:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npx next build` — build succeeds
- [ ] Manual test: `/signup` → create account → land on dashboard → see OnboardingPanel
- [ ] Manual test: `/billing` → see plan selection (Stripe only works with real keys)
- [ ] Manual test: Trial banner shows when <7 days left
