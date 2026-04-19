import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'p-1' }),
    },
    companyPerson: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ownership: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    contractParty: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    casePerson: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    comment: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        person: {
          update: vi.fn().mockResolvedValue({ id: 'p-1' }),
        },
        companyPerson: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        ownership: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        contractParty: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        casePerson: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      })
    ),
  },
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

import { gdprExportPerson, gdprDeletePerson } from '@/lib/export/gdpr'

describe('gdprExportPerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aggregerer person + relations til JSON', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: 'p-1',
        first_name: 'Jens',
        last_name: 'Hansen',
        email: 'jens@test.dk',
        organization_id: 'org-1',
      })) as never)
    vi.mocked(prisma.companyPerson.findMany).mockImplementation((() =>
      Promise.resolve([{ id: 'cp-1', role: 'direktoer' }])) as never)
    const result = await gdprExportPerson('p-1', 'org-1')
    expect(result).not.toBeNull()
    expect(result!.person.first_name).toBe('Jens')
    expect(result!.companyPersons).toHaveLength(1)
    expect(result!.exportedAt).toBeInstanceOf(Date)
    expect(result!.metadata.note).toMatch(/Article 15/)
  })

  it('returnerer null hvis person ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await gdprExportPerson('p-nope', 'org-1')
    expect(result).toBeNull()
  })

  it('afviser tenant-leak (organization_id filter)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    await gdprExportPerson('p-1', 'wrong-org')
    const call = vi.mocked(prisma.person.findFirst).mock.calls[0]
    expect(call![0]?.where).toMatchObject({ id: 'p-1', organization_id: 'wrong-org' })
  })
})

describe('gdprDeletePerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pseudonymiserer person + sletter/soft-sletter relations atomisk', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() =>
      Promise.resolve({
        id: 'p-1',
        organization_id: 'org-1',
      })) as never)
    const result = await gdprDeletePerson('p-1', 'org-1')
    expect(result.deleted).toBe(true)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(result.summary.personUpdated).toBe(1)
    expect(result.summary.companyPersonsEnded).toBe(1)
    expect(result.summary.ownershipsEnded).toBe(1)
  })

  it('returnerer deleted=false hvis person ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await gdprDeletePerson('p-nope', 'org-1')
    expect(result.deleted).toBe(false)
    expect(result.summary.personUpdated).toBe(0)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('tenant-filter på person-lookup før sletning', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    await gdprDeletePerson('p-1', 'wrong-org')
    const call = vi.mocked(prisma.person.findFirst).mock.calls[0]
    expect(call![0]?.where).toMatchObject({ id: 'p-1', organization_id: 'wrong-org' })
  })
})
