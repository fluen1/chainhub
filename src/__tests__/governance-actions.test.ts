import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    companyPerson: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'cp-1' }),
      update: vi.fn().mockResolvedValue({ id: 'cp-1' }),
    },
    person: { create: vi.fn().mockResolvedValue({ id: 'p-1' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
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

// Import after mocks are set up
import { addCompanyPerson, endCompanyPerson } from '@/actions/governance'

const VALID_UUID_1 = 'a1b2c3d4-e5f6-4789-9abc-def012345678'
const VALID_UUID_2 = 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789'
const VALID_UUID_3 = 'c3d4e5f6-a7b8-4901-9cde-f01234567890'

describe('addCompanyPerson', () => {
  beforeEach(() => {
    // Reset call counters but preserve module mocks
    vi.clearAllMocks()
    // Re-establish default mocks that beforeEach wipes
  })

  it('happy path opretter tilknytning', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockImplementation(async () => null)
    const result = await addCompanyPerson({
      companyId: VALID_UUID_1,
      personId: VALID_UUID_2,
      role: 'ansat',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser anden direktør hvis allerede aktiv', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockImplementation(
      async () => ({ id: 'existing-director' }) as never
    )
    const result = await addCompanyPerson({
      companyId: VALID_UUID_1,
      personId: VALID_UUID_2,
      role: 'direktoer',
    } as never)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/aktiv direktør/)
    }
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await addCompanyPerson({
      companyId: VALID_UUID_1,
      personId: VALID_UUID_2,
      role: 'ansat',
    } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser uden selskab-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await addCompanyPerson({
      companyId: VALID_UUID_1,
      personId: VALID_UUID_2,
      role: 'ansat',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('opretter ny person hvis ingen personId angivet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockImplementation(async () => null)
    await addCompanyPerson({
      companyId: VALID_UUID_1,
      firstName: 'Ny',
      lastName: 'Person',
      role: 'ansat',
    } as never)
    expect(prisma.person.create).toHaveBeenCalled()
  })

  it('skriver audit-event ved oprettelse', async () => {
    const { prisma } = await import('@/lib/db')
    const audit = await import('@/lib/audit')
    vi.mocked(prisma.companyPerson.findFirst).mockImplementation(async () => null)
    await addCompanyPerson({
      companyId: VALID_UUID_1,
      personId: VALID_UUID_2,
      role: 'direktoer',
    } as never)
    expect(audit.recordAuditEvent).toHaveBeenCalled()
  })
})

describe('endCompanyPerson', () => {
  beforeEach(() => {
    // Reset call counters but preserve module mocks
    vi.clearAllMocks()
    // Re-establish default mocks that beforeEach wipes
  })

  it('happy path soft-sletter med end_date', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockImplementation(
      async () =>
        ({
          organization_id: 'org-1',
          company_id: 'c-1',
          person_id: 'p-1',
          role: 'direktoer',
        }) as never
    )
    const result = await endCompanyPerson({
      companyPersonId: VALID_UUID_3,
      endDate: '2026-04-18',
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser tenant mismatch', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockImplementation(
      async () =>
        ({
          organization_id: 'andet-org',
          company_id: 'c-1',
          person_id: 'p-1',
          role: 'direktoer',
        }) as never
    )
    const result = await endCompanyPerson({
      companyPersonId: VALID_UUID_3,
      endDate: '2026-04-18',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden selskab-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.companyPerson.findFirst).mockImplementation(
      async () =>
        ({
          organization_id: 'org-1',
          company_id: 'c-1',
          person_id: 'p-1',
          role: 'direktoer',
        }) as never
    )
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await endCompanyPerson({
      companyPersonId: VALID_UUID_3,
      endDate: '2026-04-18',
    } as never)
    expect('error' in result).toBe(true)
  })
})
