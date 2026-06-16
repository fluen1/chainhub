import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() })),
}))

const prismaMock = vi.hoisted(() => ({
  person: { create: vi.fn() },
  ownership: {
    findFirst: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { addOwner, updateOwnership, endOwnership } from '@/actions/ownership'
import { auth } from '@/lib/auth'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'

const mockSession = {
  user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '',
}

const validOwnershipId = '00000000-0000-0000-0000-000000000001'
const validCompanyId = '00000000-0000-0000-0000-000000000002'
const validPersonId = '00000000-0000-0000-0000-000000000003'

// addOwnerSchema kræver ownerType
const validAddOwnerInput = {
  companyId: validCompanyId,
  personId: validPersonId,
  ownershipPct: 50,
  ownerType: 'PERSON' as const,
}

const fakeOwnership = {
  id: validOwnershipId,
  organization_id: 'org-1',
  company_id: validCompanyId,
  owner_person_id: validPersonId,
  ownership_pct: 50,
  effective_date: null,
  end_date: null,
  contract_id: null,
  created_by: 'u1',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  owner_company_id: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(mockSession as never)
  vi.mocked(canAccessCompany).mockResolvedValue(true)
  vi.mocked(canAccessSensitivity).mockResolvedValue(true)
  vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false } as never)
})

// ---------------------------------------------------------------------------
// addOwner
// ---------------------------------------------------------------------------

describe('addOwner', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await addOwner({
      companyId: validCompanyId,
      personId: validPersonId,
      ownershipPct: 50,
    } as any)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl ved ugyldigt input', async () => {
    const result = await addOwner({} as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden company-adgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await addOwner(validAddOwnerInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/adgang/)
  })

  it('returnerer fejl uden sensitivity-adgang', async () => {
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)
    const result = await addOwner(validAddOwnerInput)
    expect('error' in result).toBe(true)
  })

  it('happy path med eksisterende personId', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: Function) => {
      // Simulate the transaction calling aggregate + create
      const txMock = {
        ownership: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { ownership_pct: 30 } }),
          create: vi.fn().mockResolvedValue(fakeOwnership),
        },
      }
      return fn(txMock)
    })

    const result = await addOwner(validAddOwnerInput)
    expect('data' in result).toBe(true)
  })

  it('returnerer fejl ved rate limit', async () => {
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as never)
    const result = await addOwner(validAddOwnerInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/mange handlinger/)
  })

  it('opret ny person når personId mangler — returnerer fejl hvis fornavn/efternavn mangler', async () => {
    const result = await addOwner({
      companyId: validCompanyId,
      ownershipPct: 30,
      ownerType: 'PERSON',
      // personId, firstName, lastName mangler
    } as never)
    // Either validation error or missing name error
    expect('error' in result).toBe(true)
  })

  it('returnerer RangeError ved overskridelse af 100%', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: Function) => {
      const txMock = {
        ownership: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { ownership_pct: 80 } }),
          create: vi.fn(),
        },
      }
      return fn(txMock)
    })

    const result = await addOwner(validAddOwnerInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/100%/)
  })
})

// ---------------------------------------------------------------------------
// updateOwnership
// ---------------------------------------------------------------------------

describe('updateOwnership', () => {
  const existingRecord = {
    organization_id: 'org-1',
    company_id: validCompanyId,
    ownership_pct: 50,
    effective_date: null,
    contract_id: null,
  }

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await updateOwnership({ ownershipId: validOwnershipId, ownershipPct: 40 })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl ved ugyldigt input', async () => {
    const result = await updateOwnership({} as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden sensitivity-adgang', async () => {
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)
    const result = await updateOwnership({ ownershipId: validOwnershipId, ownershipPct: 40 })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl når ejerskab ikke tilhører org', async () => {
    prismaMock.ownership.findFirst.mockResolvedValue({
      ...existingRecord,
      organization_id: 'other-org',
    })
    const result = await updateOwnership({ ownershipId: validOwnershipId, ownershipPct: 40 })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/ikke fundet/)
  })

  it('returnerer fejl når ejerskab ikke eksisterer', async () => {
    prismaMock.ownership.findFirst.mockResolvedValue(null)
    const result = await updateOwnership({ ownershipId: validOwnershipId, ownershipPct: 40 })
    expect('error' in result).toBe(true)
  })

  it('happy path — opdaterer ejerskab', async () => {
    prismaMock.ownership.findFirst.mockResolvedValue(existingRecord)
    prismaMock.ownership.update.mockResolvedValue({ ...fakeOwnership, ownership_pct: 40 })

    const result = await updateOwnership({ ownershipId: validOwnershipId, ownershipPct: 40 })
    expect('data' in result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// endOwnership
// ---------------------------------------------------------------------------

describe('endOwnership', () => {
  const existingRecord = {
    organization_id: 'org-1',
    company_id: validCompanyId,
  }

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await endOwnership({ ownershipId: validOwnershipId, endDate: '2025-12-31' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl ved ugyldigt input', async () => {
    const result = await endOwnership({} as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden sensitivity-adgang', async () => {
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)
    const result = await endOwnership({ ownershipId: validOwnershipId, endDate: '2025-12-31' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl når ejerskab ikke tilhører org', async () => {
    prismaMock.ownership.findFirst.mockResolvedValue({
      ...existingRecord,
      organization_id: 'other-org',
    })
    const result = await endOwnership({ ownershipId: validOwnershipId, endDate: '2025-12-31' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl når ejerskab ikke eksisterer', async () => {
    prismaMock.ownership.findFirst.mockResolvedValue(null)
    const result = await endOwnership({ ownershipId: validOwnershipId, endDate: '2025-12-31' })
    expect('error' in result).toBe(true)
  })

  it('happy path — afregistrerer ejerskab', async () => {
    prismaMock.ownership.findFirst.mockResolvedValue(existingRecord)
    prismaMock.ownership.update.mockResolvedValue({
      ...fakeOwnership,
      end_date: new Date('2025-12-31'),
    })

    const result = await endOwnership({ ownershipId: validOwnershipId, endDate: '2025-12-31' })
    expect('data' in result).toBe(true)
  })
})
