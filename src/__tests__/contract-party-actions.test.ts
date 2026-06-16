import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    contract: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'c-1' }),
    },
    contractParty: {
      create: vi.fn().mockResolvedValue({ id: 'party-1', contract_id: 'c-1' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
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
vi.mock('@/lib/ai/invalidate-cache', () => ({ invalidateCompanyInsightsCache: vi.fn() }))

import { updateContract, addContractParty } from '@/actions/contracts'

const UUID_1 = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

const CONTRACT_FIXTURE = {
  id: UUID_1,
  status: 'AKTIV',
  sensitivity: 'INTERN',
  notes: '',
  company_id: UUID_1,
}

// ─── updateContract ───────────────────────────────────────────────────────────

describe('updateContract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opdaterer display_name', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve(CONTRACT_FIXTURE)) as never)
    const result = await updateContract({
      contractId: UUID_1,
      displayName: 'Nyt navn',
    })
    expect('data' in result).toBe(true)
    expect(prisma.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: UUID_1, organization_id: expect.any(String) },
        data: expect.objectContaining({ display_name: 'Nyt navn' }),
      })
    )
  })

  it('afviser uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve(CONTRACT_FIXTURE)) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await updateContract({ contractId: UUID_1, displayName: 'X' })
    expect('error' in result).toBe(true)
  })

  it('afviser uden sensitivity-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({ ...CONTRACT_FIXTURE, sensitivity: 'STRENGT_FORTROLIG' })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await updateContract({ contractId: UUID_1, displayName: 'X' })
    expect('error' in result).toBe(true)
  })

  it('afviser hvis kontrakt ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateContract({ contractId: UUID_1, displayName: 'X' })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/ikke fundet/)
    }
  })

  it('skriver auditLog ved opdatering', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve(CONTRACT_FIXTURE)) as never)
    await updateContract({ contractId: UUID_1, displayName: 'Opdateret navn' })
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })
})

// ─── addContractParty ─────────────────────────────────────────────────────────

describe('addContractParty', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path tilføjer person-part', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve(CONTRACT_FIXTURE)) as never)
    const result = await addContractParty({
      contractId: UUID_1,
      personId: 'person-1',
      roleInContract: 'Lejer',
    })
    expect('data' in result).toBe(true)
    expect(prisma.contractParty.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contract_id: UUID_1,
          person_id: 'person-1',
          role_in_contract: 'Lejer',
        }),
      })
    )
  })

  it('happy path tilføjer ekstern part', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve(CONTRACT_FIXTURE)) as never)
    const result = await addContractParty({
      contractId: UUID_1,
      counterpartyName: 'Udlejningsselskabet A/S',
      roleInContract: 'Udlejer',
    })
    expect('data' in result).toBe(true)
    expect(prisma.contractParty.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          counterparty_name: 'Udlejningsselskabet A/S',
        }),
      })
    )
  })

  it('afviser hvis hverken personId eller counterpartyName', async () => {
    const result = await addContractParty({ contractId: UUID_1 })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/person|navn/i)
    }
  })

  it('afviser uden module-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await addContractParty({
      contractId: UUID_1,
      counterpartyName: 'Ekstern A/S',
    })
    expect('error' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve(CONTRACT_FIXTURE)) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await addContractParty({
      contractId: UUID_1,
      counterpartyName: 'Ekstern A/S',
    })
    expect('error' in result).toBe(true)
  })

  it('afviser uden sensitivity-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve({ ...CONTRACT_FIXTURE, sensitivity: 'STRENGT_FORTROLIG' })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await addContractParty({
      contractId: UUID_1,
      counterpartyName: 'Ekstern A/S',
    })
    expect('error' in result).toBe(true)
  })

  it('skriver auditLog ved tilføjelse', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findFirst).mockImplementation((() =>
      Promise.resolve(CONTRACT_FIXTURE)) as never)
    await addContractParty({
      contractId: UUID_1,
      counterpartyName: 'Ekstern A/S',
    })
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('isolation: afviser forkert organisation (kontrakt ikke fundet)', async () => {
    const { prisma } = await import('@/lib/db')
    // findFirst returnerer null — kontrakt tilhører anden org
    vi.mocked(prisma.contract.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await addContractParty({
      contractId: UUID_1,
      counterpartyName: 'Ekstern A/S',
    })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/ikke fundet/)
    }
  })
})
