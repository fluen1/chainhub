/**
 * Tests for Stripe webhook håndtering.
 * Verificerer at alle kritiske events synkroniseres korrekt til databasen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleWebhookEvent } from '@/lib/stripe/webhook'
import { validateWebhookUrl } from '@/lib/billing/validate-env'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

const mockSubscription = {
  id: 'sub_test123',
  customer: 'cus_test123',
  status: 'active',
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  trial_end: null,
  items: {
    data: [
      {
        id: 'si_test123',
        price: {
          id: 'price_starter_test',
          nickname: 'Starter',
        },
        quantity: 3,
      },
    ],
  },
}

const mockExistingSubscription = {
  id: 'internal_sub_id',
  organizationId: 'org_test123',
  stripeCustomerId: 'cus_test123',
  stripeSubscriptionId: 'sub_old',
  plan: 'trial',
  status: 'trialing',
  seatCount: 1,
}

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_test'
    process.env.STRIPE_BUSINESS_PRICE_ID = 'price_business_test'
    process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise_test'
  })

  describe('customer.subscription.created', () => {
    it('opdaterer subscription ved oprettelse', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(
        mockExistingSubscription as never
      )
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never)
      vi.mocked(prisma.organization.update).mockResolvedValue({} as never)

      await handleWebhookEvent({
        type: 'customer.subscription.created',
        data: { object: mockSubscription },
      } as never)

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeCustomerId: 'cus_test123' },
          data: expect.objectContaining({
            stripeSubscriptionId: 'sub_test123',
            status: 'active',
            seatCount: 3,
            plan: 'starter',
          }),
        })
      )
    })

    it('logger fejl hvis ingen organisation findes', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await handleWebhookEvent({
        type: 'customer.subscription.created',
        data: { object: mockSubscription },
      } as never)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ingen organisation fundet')
      )
      expect(prisma.subscription.update).not.toHaveBeenCalled()
    })
  })

  describe('customer.subscription.updated', () => {
    it('synkroniserer status og seat count ved opdatering', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(
        mockExistingSubscription as never
      )
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never)
      vi.mocked(prisma.organization.update).mockResolvedValue({} as never)

      const updatedSubscription = {
        ...mockSubscription,
        status: 'past_due',
        items: {
          data: [
            {
              ...mockSubscription.items.data[0],
              quantity: 5,
              price: { id: 'price_business_test', nickname: 'Business' },
            },
          ],
        },
      }

      await handleWebhookEvent({
        type: 'customer.subscription.updated',
        data: { object: updatedSubscription },
      } as never)

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'past_due',
            seatCount: 5,
            plan: 'business',
          }),
        })
      )
    })
  })

  describe('customer.subscription.deleted', () => {
    it('sætter status til canceled og plan til trial', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(
        mockExistingSubscription as never
      )
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never)
      vi.mocked(prisma.organization.update).mockResolvedValue({} as never)

      await handleWebhookEvent({
        type: 'customer.subscription.deleted',
        data: { object: mockSubscription },
      } as never)

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'canceled' }),
        })
      )
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { plan: 'trial' },
        })
      )
    })
  })

  describe('invoice.payment_succeeded', () => {
    it('sætter status til active ved vellykket betaling', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        ...mockExistingSubscription,
        status: 'past_due',
      } as never)
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never)

      await handleWebhookEvent({
        type: 'invoice.payment_succeeded',
        data: {
          object: { customer: 'cus_test123', id: 'in_test' },
        },
      } as never)

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'active' }),
        })
      )
    })
  })

  describe('invoice.payment_failed', () => {
    it('sætter status til past_due ved fejlet betaling', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(
        mockExistingSubscription as never
      )
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never)

      await handleWebhookEvent({
        type: 'invoice.payment_failed',
        data: {
          object: { customer: 'cus_test123', id: 'in_test' },
        },
      } as never)

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'past_due' }),
        })
      )
    })
  })
})

describe('Webhook URL validering', () => {
  it('accepterer korrekt URL med www-prefix', () => {
    const result = validateWebhookUrl('https://www.chainhub.dk/api/webhooks/stripe')
    expect(result.valid).toBe(true)
  })

  it('afviser URL uden www-prefix', () => {
    const result = validateWebhookUrl('https://chainhub.dk/api/webhooks/stripe')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('www-prefix')
  })

  it('afviser URL med forkert sti', () => {
    const result = validateWebhookUrl('https://www.chainhub.dk/webhooks/stripe')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('/api/webhooks/stripe')
  })
})