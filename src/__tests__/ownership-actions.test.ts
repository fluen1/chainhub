import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: { create: vi.fn().mockResolvedValue({ id: 'p-1' }) },
    ownership: {
      create: vi.fn().mockResolvedValue({ id: 'o-1', ownership_pct: 50 }),
      findFirst: vi.fn(),
      update: vi
        .fn()
        .mockResolvedValue({
          id: 'o-1',
          ownership_pct: 60,
          effective_date: null,
          contract_id: null,
        }),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { addOwner, updateOwnership, endOwnership } from '@/actions/ownership'

const UUID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('addOwner', () => {
  beforeEach(() => vi.clearAllMocks())

  const baseInput = {
    companyId: UUID,
    personId: UUID,
    ownershipPct: 50,
    ownerType: 'PERSON' as const,
  }

  it('happy path med eksisterende personId', async () => {
    const result = await addOwner(baseInput as never)
    expect('data' in result).toBe(true)
  })

  it('opretter ny person hvis personId mangler', async () => {
    const { prisma } = await import('@/lib/db')
    const result = await addOwner({
      companyId: UUID,
      firstName: 'Ny',
      lastName: 'Person',
      ownershipPct: 25,
      ownerType: 'PERSON',
    } as never)
    expect('data' in result).toBe(true)
    expect(prisma.person.create).toHaveBeenCalled()
  })

  it('afviser hvis ny person mangler navn', async () => {
    const result = await addOwner({
      companyId: UUID,
      ownershipPct: 25,
      ownerType: 'PERSON',
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden company-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await addOwner(baseInput as never)
    expect('error' in result).toBe(true)
  })

  it('afviser uden STRENGT_FORTROLIG-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await addOwner(baseInput as never)
    expect('error' in result).toBe(true)
  })

  it('skriver audit-event med ownership_pct', async () => {
    const audit = await import('@/lib/audit')
    await addOwner(baseInput as never)
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        resourceType: 'ownership',
        sensitivity: 'STRENGT_FORTROLIG',
      })
    )
  })
})

describe('updateOwnership', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opdaterer pct og logger old/new', async () => {
    const { prisma } = await import('@/lib/db')
    const audit = await import('@/lib/audit')
    vi.mocked(prisma.ownership.findFirst).mockImplementation((() =>
      Promise.resolve({
        organization_id: 'org-1',
        company_id: UUID,
        ownership_pct: 50,
        effective_date: null,
        contract_id: null,
      })) as never)
    const result = await updateOwnership({ ownershipId: UUID, ownershipPct: 60 } as never)
    expect('data' in result).toBe(true)
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.objectContaining({ oldOwnershipPct: 50, newOwnershipPct: 60 }),
      })
    )
  })

  it('opdaterer effective_date fra acquiredAt', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.ownership.findFirst).mockImplementation((() =>
      Promise.resolve({
        organization_id: 'org-1',
        company_id: UUID,
        ownership_pct: 50,
        effective_date: null,
        contract_id: null,
      })) as never)
    await updateOwnership({ ownershipId: UUID, acquiredAt: '2026-04-01' } as never)
    expect(prisma.ownership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ effective_date: expect.any(Date) }),
      })
    )
  })

  it('afviser uden STRENGT_FORTROLIG-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await updateOwnership({ ownershipId: UUID, ownershipPct: 60 } as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis ejerskab ikke fundet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.ownership.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateOwnership({ ownershipId: UUID, ownershipPct: 60 } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser tenant mismatch', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.ownership.findFirst).mockImplementation((() =>
      Promise.resolve({
        organization_id: 'andet-org',
        company_id: UUID,
        ownership_pct: 50,
        effective_date: null,
        contract_id: null,
      })) as never)
    const result = await updateOwnership({ ownershipId: UUID, ownershipPct: 60 } as never)
    expect('error' in result).toBe(true)
  })
})

describe('endOwnership', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path sætter end_date', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.ownership.findFirst).mockImplementation((() =>
      Promise.resolve({ organization_id: 'org-1', company_id: UUID })) as never)
    const result = await endOwnership({ ownershipId: UUID, endDate: '2026-04-18' } as never)
    expect('data' in result).toBe(true)
    expect(prisma.ownership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { end_date: expect.any(Date) } })
    )
  })

  it('afviser uden STRENGT_FORTROLIG-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await endOwnership({ ownershipId: UUID, endDate: '2026-04-18' } as never)
    expect('error' in result).toBe(true)
  })

  it('logger action=END audit-event', async () => {
    const { prisma } = await import('@/lib/db')
    const audit = await import('@/lib/audit')
    vi.mocked(prisma.ownership.findFirst).mockImplementation((() =>
      Promise.resolve({ organization_id: 'org-1', company_id: UUID })) as never)
    await endOwnership({ ownershipId: UUID, endDate: '2026-04-18' } as never)
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'END' }))
  })
})
