/**
 * Tests for Stripe Checkout og seat count synkronisering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/stripe/index', () => ({
  stripe: {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
    subscriptionItems: {
      update: vi.fn(),
    },
  },
  TRIAL_PERIOD_DAYS: 14,
  STRIPE_PRICE_IDS: {
    starter: 'price_starter_test',
    business: 'price_business_test',
    enterprise: 'price_enterprise_test',
  },
}))

import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe/index'
import { syncSeatCount, createCheckoutSession } from '@/lib/stripe/checkout'

describe('syncSeatCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opdaterer ikke Stripe når seat count er uændret', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      stripeSubscriptionId: 'sub_test',
      seatCount: 5,
    } as never)
    vi.mocked(prisma.user.count).mockResolvedValue(5)

    await syncSeatCount('org_test')

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('opdaterer Stripe når seat count har ændret sig', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      stripeSubscriptionId: 'sub_test',
      seatCount: 3,
    } as never)
    vi.mocked(prisma.user.count).mockResolvedValue(5)
    vi.mocked(stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: { data: [{ id: 'si_test' }] },
    })
    vi.mocked(stripe.subscriptionItems.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    vi.mocked(prisma.subscription.update).mockResolvedValue({} as never)

    await syncSeatCount('org_test')

    expect(stripe.subscriptionItems.update).toHaveBeenCalledWith('si_test', {
      quantity: 5,
    })
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ seatCount: 5 }),
      })
    )
  })

  it('springer over hvis ingen Stripe subscription', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

    await syncSeatCount('org_test')

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('bruger minimum 1 seat selvom der er 0 aktive brugere', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      stripeSubscriptionId: 'sub_test',
      seatCount: 3,
    } as never)
    vi.mocked(prisma.user.count).mockResolvedValue(0)
    vi.mocked(stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: { data: [{ id: 'si_test' }] },
    })
    vi.mocked(stripe.subscriptionItems.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    vi.mocked(prisma.subscription.update).mockResolvedValue({} as never)

    await syncSeatCount('org_test')

    expect(stripe.subscriptionItems.update).toHaveBeenCalledWith('si_test', {
      quantity: 1,
    })
  })
})

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_test'
  })

  it('opretter checkout session med 14 dages trial', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org_test',
      name: 'Test Org',
    } as never)
    vi.mocked(stripe.customers.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'cus_new',
    })
    vi.mocked(stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
      id: 'cs_test',
    })

    const result = await createCheckoutSession({
      organizationId: 'org_test',
      plan: 'starter',
      seatCount: 3,
      userEmail: 'test@example.com',
      successUrl: 'https://www.chainhub.dk/settings/billing?success=true',
      cancelUrl: 'https://www.chainhub.dk/settings/billing?canceled=true',
    })

    expect(result.url).toBe('https://checkout.stripe.com/test')
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_starter_test', quantity: 3 }],
        subscription_data: expect.objectContaining({
          trial_period_days: 14,
        }),
      })
    )
  })

  it('kaster fejl ved ugyldig plan', async () => {
    await expect(
      createCheckoutSession({
        organizationId: 'org_test',
        plan: 'invalid' as 'starter',
        seatCount: 1,
        userEmail: 'test@example.com',
        successUrl: 'https://example.com',
        cancelUrl: 'https://example.com',
      })
    ).rejects.toThrow()
  })
})