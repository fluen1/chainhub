import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAccount } from '@/actions/signup'

// Prisma-mock
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed') } }))

import { prisma } from '@/lib/db'
import { vi as viAlias } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createAccount — accept-sporing', () => {
  it('afviser signup uden termsAccepted=true', async () => {
    const result = await createAccount({
      name: 'Test Bruger',
      email: 'test@example.com',
      password: 'password123',
      termsAccepted: false,
    } as unknown as Parameters<typeof createAccount>[0])
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/vilkår/i)
    }
  })

  it('afviser signup uden dpaAccepted=true', async () => {
    const result = await createAccount({
      name: 'Test Bruger',
      email: 'test@example.com',
      password: 'password123',
      termsAccepted: true,
      dpaAccepted: false,
    } as unknown as Parameters<typeof createAccount>[0])
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/databehandler/i)
    }
  })

  it('persisterer terms_accepted_at og dpa_accepted_at ved gyldig signup', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const now = new Date('2026-06-16T10:00:00.000Z')
    vi.setSystemTime(now)

    const orgCreateSpy = vi.fn().mockResolvedValue({ id: 'org-1' })
    const userCreateSpy = vi.fn().mockResolvedValue({ id: 'user-1' })
    const roleCreateSpy = vi.fn().mockResolvedValue({})

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return fn({
        organization: { create: orgCreateSpy },
        user: { create: userCreateSpy },
        userRoleAssignment: { create: roleCreateSpy },
      } as unknown as Parameters<typeof fn>[0])
    })

    await createAccount({
      name: 'Test Bruger',
      email: 'test@example.com',
      password: 'password123',
      termsAccepted: true,
      dpaAccepted: true,
    })

    expect(orgCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          terms_accepted_at: now,
          dpa_accepted_at: now,
        }),
      })
    )
    vi.useRealTimers()
  })
})
