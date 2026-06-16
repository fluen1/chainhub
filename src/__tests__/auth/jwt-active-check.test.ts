import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organization: { create: vi.fn() },
    userRoleAssignment: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { prismaMock }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
// next-auth er inline i vitest config — mock PrismaAdapter + providers separat
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: vi.fn().mockReturnValue({}) }))
vi.mock('next-auth/providers/credentials', () => ({ default: vi.fn().mockReturnValue({}) }))
vi.mock('next-auth/providers/google', () => ({ default: vi.fn().mockReturnValue({}) }))
vi.mock('next-auth', () => ({
  default: vi
    .fn()
    .mockReturnValue({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }),
}))
vi.mock('@/lib/auth/login-rate-limit', () => ({
  isLoginRateLimited: vi.fn().mockResolvedValue({ limited: false }),
  recordFailedLoginAttempt: vi.fn(),
}))

import { jwtCallback } from '@/lib/auth'

describe('jwtCallback — aktiv-tjek ved token-refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('nulstiller token.id når brugeren er deaktiveret (active: false)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      organization_id: 'org-1',
      active: false,
      deleted_at: null,
    })

    const token = await jwtCallback({
      token: { id: 'u1', organizationId: 'org-1', email: 'a@b.dk' },
      user: undefined,
      account: null,
    })

    expect(token.id).toBeUndefined()
    expect(token.organizationId).toBeUndefined()
  })

  it('nulstiller token.id når brugeren er soft-deleted (deleted_at sat)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      organization_id: 'org-1',
      active: true,
      deleted_at: new Date('2026-06-01'),
    })

    const token = await jwtCallback({
      token: { id: 'u1', organizationId: 'org-1', email: 'a@b.dk' },
      user: undefined,
      account: null,
    })

    expect(token.id).toBeUndefined()
    expect(token.organizationId).toBeUndefined()
  })

  it('nulstiller token.id når brugeren ikke længere eksisterer i DB', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const token = await jwtCallback({
      token: { id: 'u1', organizationId: 'org-1', email: 'a@b.dk' },
      user: undefined,
      account: null,
    })

    expect(token.id).toBeUndefined()
    expect(token.organizationId).toBeUndefined()
  })

  it('bevarer token.id og organizationId når brugeren er aktiv', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      organization_id: 'org-1',
      active: true,
      deleted_at: null,
    })

    const token = await jwtCallback({
      token: { id: 'u1', organizationId: 'org-1', email: 'a@b.dk' },
      user: undefined,
      account: null,
    })

    expect(token.id).toBe('u1')
    expect(token.organizationId).toBe('org-1')
  })

  it('foretager ikke DB-opslag hvis token.id ikke er sat (ingen session endnu)', async () => {
    const token = await jwtCallback({
      token: { email: 'a@b.dk' },
      user: undefined,
      account: null,
    })

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(token.id).toBeUndefined()
  })

  it('sætter token.id ved credentials-login (user er sat)', async () => {
    // DB-check kører EFTER login-sætningen — mock findUnique for den efterfølgende revalidering
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u2',
      organization_id: 'org-2',
      active: true,
      deleted_at: null,
    })

    const token = await jwtCallback({
      token: { email: 'b@c.dk' },
      user: { id: 'u2', organizationId: 'org-2' },
      account: { provider: 'credentials', type: 'credentials', providerAccountId: 'u2' },
    })

    expect(token.id).toBe('u2')
    expect(token.organizationId).toBe('org-2')
  })
})
