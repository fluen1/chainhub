import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTx = {
  user: { create: vi.fn().mockResolvedValue({ id: 'u-new' }) },
  userRoleAssignment: {
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
}

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      count: vi.fn().mockResolvedValue(2),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}))

import { getOrganizationUsers, createUser, updateUserRole, toggleUserActive } from '@/actions/users'

const UUID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('getOrganizationUsers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path returnerer brugerliste', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findMany).mockImplementation((() =>
      Promise.resolve([{ id: 'u-1', name: 'A', roles: [] }])) as never)
    const result = await getOrganizationUsers()
    expect('data' in result).toBe(true)
  })

  it('afviser uden module-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await getOrganizationUsers()
    expect('error' in result).toBe(true)
  })

  it('filtrerer deleted_at: null', async () => {
    const { prisma } = await import('@/lib/db')
    await getOrganizationUsers()
    const call = vi.mocked(prisma.user.findMany).mock.calls[0]
    expect(call![0]?.where).toMatchObject({ deleted_at: null })
  })
})

describe('createUser', () => {
  beforeEach(() => vi.clearAllMocks())

  const baseInput = {
    email: 'ny@chainhub.dk',
    name: 'Ny Bruger',
    password: 'password123',
    role: 'GROUP_ADMIN' as const,
    companyIds: [],
  }

  it('GROUP-rolle får scope=ALL og tomme companyIds', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await createUser(baseInput as never)
    expect('data' in result).toBe(true)
    const roleCall = mockTx.userRoleAssignment.create.mock.calls[0]
    expect(roleCall![0].data.scope).toBe('ALL')
    expect(roleCall![0].data.company_ids).toEqual([])
  })

  it('ASSIGNED-rolle får scope=ASSIGNED med companyIds', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await createUser({
      ...baseInput,
      role: 'COMPANY_MANAGER',
      companyIds: [UUID],
    } as never)
    expect('data' in result).toBe(true)
    const roleCall = mockTx.userRoleAssignment.create.mock.calls[0]
    expect(roleCall![0].data.scope).toBe('ASSIGNED')
    expect(roleCall![0].data.company_ids).toEqual([UUID])
  })

  it('afviser duplikeret email', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() =>
      Promise.resolve({ id: 'eksisterende' })) as never)
    const result = await createUser(baseInput as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden module-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await createUser(baseInput as never)
    expect('error' in result).toBe(true)
  })

  it('hasher password med bcrypt(12)', async () => {
    const { prisma } = await import('@/lib/db')
    const bcrypt = await import('bcryptjs')
    vi.mocked(prisma.user.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    await createUser(baseInput as never)
    expect(bcrypt.default.hash).toHaveBeenCalledWith('password123', 12)
  })
})

describe('updateUserRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GROUP-update sætter scope=ALL', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID })) as never)
    const result = await updateUserRole({
      userId: UUID,
      role: 'GROUP_LEGAL',
      companyIds: [],
    } as never)
    expect('data' in result).toBe(true)
    const roleCall = mockTx.userRoleAssignment.create.mock.calls[0]
    expect(roleCall![0].data.scope).toBe('ALL')
  })

  it('ASSIGNED-update sætter scope=ASSIGNED', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID })) as never)
    await updateUserRole({
      userId: UUID,
      role: 'COMPANY_LEGAL',
      companyIds: [UUID],
    } as never)
    const roleCall = mockTx.userRoleAssignment.create.mock.calls[0]
    expect(roleCall![0].data.scope).toBe('ASSIGNED')
  })

  it('returnerer fejl hvis user ikke fundet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateUserRole({
      userId: UUID,
      role: 'GROUP_ADMIN',
      companyIds: [],
    } as never)
    expect('error' in result).toBe(true)
  })

  it('transaction kører deleteMany + create atomisk', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID })) as never)
    await updateUserRole({
      userId: UUID,
      role: 'GROUP_ADMIN',
      companyIds: [],
    } as never)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(mockTx.userRoleAssignment.deleteMany).toHaveBeenCalled()
    expect(mockTx.userRoleAssignment.create).toHaveBeenCalled()
  })
})

describe('toggleUserActive', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deaktiverer anden bruger', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() =>
      Promise.resolve({ id: 'andet-user', active: true, roles: [] })) as never)
    const result = await toggleUserActive('andet-user')
    expect('data' in result).toBe(true)
  })

  it('afviser deaktivering af sig selv', async () => {
    const result = await toggleUserActive('user-1')
    expect(result).toEqual({ error: 'Du kan ikke deaktivere dig selv' })
  })

  it('afviser deaktivering af sidste GROUP_OWNER', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: 'andet-user',
        active: true,
        roles: [{ role: 'GROUP_OWNER' }],
      })) as never)
    vi.mocked(prisma.user.count).mockImplementation((() => Promise.resolve(0)) as never)
    const result = await toggleUserActive('andet-user')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/sidste kædeejer/)
    }
  })

  it('reaktiverer inaktiv bruger uden owner-tjek', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: 'andet-user',
        active: false,
        roles: [{ role: 'GROUP_OWNER' }],
      })) as never)
    const result = await toggleUserActive('andet-user')
    expect('data' in result).toBe(true)
    expect(prisma.user.count).not.toHaveBeenCalled()
  })
})
