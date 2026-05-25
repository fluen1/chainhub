import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    NEXTAUTH_URL: 'http://localhost:3000',
    STRIPE_STARTER_PRICE_ID: 'price_starter',
    STRIPE_PROFESSIONAL_PRICE_ID: 'price_pro',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    subscription: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/stripe', () => ({ getStripe: vi.fn().mockReturnValue(null) }))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

import { auth } from '@/lib/auth'
import { createCheckoutSession, createPortalSession } from '@/actions/billing'

describe('billing actions', () => {
  it('createCheckoutSession afviser uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createCheckoutSession('price_xxx')
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('createCheckoutSession returnerer fejl uden Stripe', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', organizationId: 'org1' } } as never)
    const result = await createCheckoutSession('price_xxx')
    expect(result.error).toBe('Betaling er ikke konfigureret')
  })

  it('createPortalSession afviser uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createPortalSession()
    expect(result.error).toBe('Ikke autoriseret')
  })
})
