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
