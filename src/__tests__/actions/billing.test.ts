import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    NEXTAUTH_URL: 'http://localhost:3000',
    STRIPE_BASIS_PRICE_ID: 'price_basis',
    STRIPE_PLUS_PRICE_ID: 'price_plus',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
  },
  baseUrl: 'http://localhost:3000',
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

import { createCheckoutSession, createPortalSession } from '@/actions/billing'
import { auth } from '@/lib/auth'

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
