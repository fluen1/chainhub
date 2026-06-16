import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock() hejses, så variabler skal erklæres via vi.hoisted()
const { constructEvent, subscriptionsRetrieve, prismaMock } = vi.hoisted(() => {
  const constructEvent = vi.fn()
  const subscriptionsRetrieve = vi.fn()
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
  return { constructEvent, subscriptionsRetrieve, prismaMock }
})

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
