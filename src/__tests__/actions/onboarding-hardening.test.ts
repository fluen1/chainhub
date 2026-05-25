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
