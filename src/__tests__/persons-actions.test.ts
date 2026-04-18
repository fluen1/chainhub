import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      create: vi.fn().mockResolvedValue({ id: 'p-1', first_name: 'Test' }),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'p-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    companyPerson: { count: vi.fn().mockResolvedValue(0) },
    ownership: { count: vi.fn().mockResolvedValue(0) },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createPerson, updatePerson, deletePerson, searchPersons } from '@/actions/persons'

describe('createPerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opretter person', async () => {
    const result = await createPerson({
      firstName: 'Anders',
      lastName: 'Andersen',
      email: 'anders@example.dk',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await createPerson({
      firstName: 'Anders',
      lastName: 'Andersen',
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser tomt firstName', async () => {
    const result = await createPerson({
      firstName: '',
      lastName: 'Andersen',
    } as never)
    expect('error' in result).toBe(true)
  })
})

describe('updatePerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opdaterer person', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation(
      async () => ({ id: 'p-1', organization_id: 'org-1' }) as never
    )
    const result = await updatePerson({
      personId: 'p-1',
      firstName: 'Opdateret',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('returnerer fejl hvis person ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation(async () => null)
    const result = await updatePerson({
      personId: 'nonexistent',
      firstName: 'X',
    } as never)
    expect('error' in result).toBe(true)
  })
})

describe('deletePerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path soft-sletter', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation(
      async () => ({ id: 'p-1', organization_id: 'org-1' }) as never
    )
    const result = await deletePerson('p-1')
    expect('data' in result).toBe(true)
  })

  it('afviser uden settings-modul-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await deletePerson('p-1')
    expect('error' in result).toBe(true)
  })

  it('afviser hvis aktiv companyPerson eksisterer', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.count).mockImplementation(async () => 1)
    const result = await deletePerson('p-1')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/aktive records/)
    }
  })

  it('afviser hvis aktiv ownership eksisterer', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.ownership.count).mockImplementation(async () => 1)
    const result = await deletePerson('p-1')
    expect('error' in result).toBe(true)
  })
})

describe('searchPersons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer matches for query med 2+ tegn', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findMany).mockImplementation(async () => [
      { id: 'p-1', first_name: 'Anders' } as never,
    ])
    const result = await searchPersons('And', 'org-1')
    if ('data' in result) {
      expect(result.data.length).toBe(1)
    }
  })

  it('returnerer tom array for query under 2 tegn', async () => {
    const { prisma } = await import('@/lib/db')
    const result = await searchPersons('a', 'org-1')
    if ('data' in result) {
      expect(result.data).toEqual([])
    }
    expect(prisma.person.findMany).not.toHaveBeenCalled()
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await searchPersons('test', 'org-1')
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })
})
