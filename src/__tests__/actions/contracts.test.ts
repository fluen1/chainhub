import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    contract: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    contractParty: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
    documentExtraction: {
      findFirst: vi.fn(),
    },
    case: {
      findMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
    },
    person: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(),
  canAccessSensitivity: vi.fn(),
  canAccessModule: vi.fn(),
  getAccessibleCompanies: vi.fn(),
  getAllowedSensitivityLevels: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/ai/invalidate-cache', () => ({
  invalidateCompanyInsightsCache: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/labels', () => ({
  formatDate: vi.fn(() => '01-01-2026'),
  getContractTypeLabel: vi.fn((t: string) => t),
  getContractStatusLabel: vi.fn((s: string) => s),
  getSensitivityLabel: vi.fn((s: string) => s),
}))
vi.mock('@/lib/date-helpers', () => ({
  formatShortDate: vi.fn((d: Date | null) => (d ? d.toISOString().split('T')[0] : '—')),
}))

import {
  createContract,
  updateContractStatus,
  deleteContract,
  updateContract,
  addContractParty,
} from '@/actions/contracts'
import { auth } from '@/lib/auth'
import { canAccessCompany, canAccessSensitivity, canAccessModule } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'

// Hjælpefunktioner
function makeSession(overrides?: Partial<{ id: string; organizationId: string }>) {
  return {
    user: {
      id: 'user-1',
      organizationId: 'org-1',
      email: 'test@test.dk',
      name: 'Test User',
      ...overrides,
    },
    expires: '2099-01-01',
  }
}

const baseContract = {
  id: 'contract-1',
  organization_id: 'org-1',
  company_id: 'company-1',
  system_type: 'LEJEKONTRAKT_ERHVERV',
  display_name: 'Lejekontrakt Test',
  sensitivity: 'INTERN' as const,
  status: 'UDKAST' as const,
  effective_date: null,
  expiry_date: null,
  notice_period_days: null,
  notes: null,
  reminder_90_days: true,
  reminder_30_days: true,
  reminder_7_days: true,
  parent_contract_id: null,
  created_by: 'user-1',
  termination_date: null,
  last_viewed_at: null,
  last_viewed_by: null,
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
}

const validCreateInput = {
  companyId: 'company-1',
  systemType: 'LEJEKONTRAKT_ERHVERV' as const,
  displayName: 'Lejekontrakt Test',
  sensitivity: 'INTERN' as const,
}

// ─── createContract ───────────────────────────────────────────────────────────

describe('createContract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createContract(validCreateInput)
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved ugyldigt input (manglende companyId)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    const result = await createContract({ ...validCreateInput, companyId: '' })
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl uden selskabs-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await createContract(validCreateInput)
    expect(result).toEqual({ error: 'Ingen adgang til dette selskab' })
  })

  it('returnerer fejl uden sensitivity-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)
    const result = await createContract(validCreateInput)
    expect(result).toEqual({ error: 'Du har ikke adgang til dette sensitivitetsniveau' })
  })

  it('returnerer fejl ved rate limiting', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true, remaining: 0 } as any)
    const result = await createContract(validCreateInput)
    expect(result).toEqual({ error: 'For mange handlinger. Vent venligst.' })
  })

  it('opretter kontrakt med korrekt organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    prismaMock.contract.create.mockResolvedValue(baseContract)
    prismaMock.auditLog.create.mockResolvedValue({})

    const result = await createContract(validCreateInput)
    expect(result).toEqual({ data: baseContract })
    expect(prismaMock.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })

  it('canAccessCompany og canAccessSensitivity kaldes med organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    prismaMock.contract.create.mockResolvedValue(baseContract)
    prismaMock.auditLog.create.mockResolvedValue({})

    await createContract(validCreateInput)
    expect(canAccessCompany).toHaveBeenCalledWith('user-1', 'company-1', 'org-1')
    expect(canAccessSensitivity).toHaveBeenCalledWith('user-1', 'INTERN', 'org-1')
  })

  it('returnerer fejl ved minimum sensitivity-krav (for lavt niveau)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    // EJERAFTALE kræver STRENGT_FORTROLIG — vi angiver INTERN (for lavt)
    const result = await createContract({
      companyId: 'company-1',
      systemType: 'EJERAFTALE' as const,
      displayName: 'Test Ejeraftale',
      sensitivity: 'INTERN' as const,
    })
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('STRENGT_FORTROLIG')
  })
})

// ─── updateContractStatus ─────────────────────────────────────────────────────

describe('updateContractStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateContractStatus({ contractId: 'contract-1', status: 'AKTIV' })
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl når kontrakt ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.contract.findFirst.mockResolvedValue(null)
    const result = await updateContractStatus({ contractId: 'ukendt', status: 'AKTIV' })
    expect(result).toEqual({ error: 'Kontrakt ikke fundet' })
  })

  it('returnerer fejl ved ugyldig status-transition', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.contract.findFirst.mockResolvedValue({ ...baseContract, status: 'OPSAGT' })
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    // OPSAGT → AKTIV er ikke tilladt
    const result = await updateContractStatus({ contractId: 'contract-1', status: 'AKTIV' })
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('OPSAGT')
  })

  it('opdaterer status fra UDKAST til AKTIV', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.contract.findFirst.mockResolvedValue({ ...baseContract, status: 'UDKAST' })
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    prismaMock.contract.update.mockResolvedValue({ ...baseContract, status: 'AKTIV' })
    prismaMock.auditLog.create.mockResolvedValue({})

    const result = await updateContractStatus({ contractId: 'contract-1', status: 'AKTIV' })
    expect(result).toHaveProperty('data')
  })

  it('tenant isolation: findFirst inkluderer organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.contract.findFirst.mockResolvedValue(null)

    await updateContractStatus({ contractId: 'contract-1', status: 'AKTIV' })
    expect(prismaMock.contract.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })
})

// ─── deleteContract ───────────────────────────────────────────────────────────

describe('deleteContract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await deleteContract('contract-1')
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl uden modul-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await deleteContract('contract-1')
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl når kontrakt ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.contract.findFirst.mockResolvedValue(null)
    const result = await deleteContract('ukendt')
    expect(result).toEqual({ error: 'Kontrakt ikke fundet' })
  })

  it('returnerer fejl når kontrakt ikke er UDKAST', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.contract.findFirst.mockResolvedValue({ ...baseContract, status: 'AKTIV' })
    const result = await deleteContract('contract-1')
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('kladde')
  })

  it('soft-deleter kontrakt i UDKAST-status', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.contract.findFirst.mockResolvedValue({ ...baseContract, status: 'UDKAST' })
    prismaMock.contract.update.mockResolvedValue({ ...baseContract, deleted_at: new Date() })

    const result = await deleteContract('contract-1')
    expect(result).toEqual({ data: undefined })
    expect(prismaMock.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      })
    )
  })
})

// ─── updateContract ───────────────────────────────────────────────────────────

describe('updateContract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateContract({ contractId: 'contract-1', displayName: 'Ny Navn' })
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved manglende contractId', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    const result = await updateContract({ contractId: '', displayName: 'Test' })
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl når kontrakt ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.contract.findFirst.mockResolvedValue(null)
    const result = await updateContract({ contractId: 'ukendt' })
    expect(result).toEqual({ error: 'Kontrakt ikke fundet' })
  })

  it('returnerer fejl uden selskabs-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.contract.findFirst.mockResolvedValue(baseContract)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    const result = await updateContract({ contractId: 'contract-1' })
    expect(result).toEqual({ error: 'Ingen adgang til dette selskab' })
  })

  it('opdaterer kontrakt og skriver audit log', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.contract.findFirst.mockResolvedValue(baseContract)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    prismaMock.contract.update.mockResolvedValue({ ...baseContract, display_name: 'Ny Navn' })
    prismaMock.auditLog.create.mockResolvedValue({})

    const result = await updateContract({ contractId: 'contract-1', displayName: 'Ny Navn' })
    expect(result).toHaveProperty('data')
    expect(prismaMock.auditLog.create).toHaveBeenCalled()
  })
})

// ─── mutation-WHERE invariant-tests ──────────────────────────────────────────

describe('mutation-WHERE: organization_id i alle update/soft-delete kald', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('updateContractStatus: update-WHERE indeholder organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.contract.findFirst.mockResolvedValue({ ...baseContract, status: 'UDKAST' })
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    prismaMock.contract.update.mockResolvedValue({ ...baseContract, status: 'AKTIV' })
    prismaMock.auditLog.create.mockResolvedValue({})

    await updateContractStatus({ contractId: 'contract-1', status: 'AKTIV' })

    expect(prismaMock.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'contract-1', organization_id: 'org-1' }),
      })
    )
  })

  it('deleteContract: update-WHERE indeholder organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.contract.findFirst.mockResolvedValue({ ...baseContract, status: 'UDKAST' })
    prismaMock.contract.update.mockResolvedValue({ ...baseContract, deleted_at: new Date() })

    await deleteContract('contract-1')

    expect(prismaMock.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'contract-1', organization_id: 'org-1' }),
      })
    )
  })

  it('updateContract: update-WHERE indeholder organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.contract.findFirst.mockResolvedValue(baseContract)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    prismaMock.contract.update.mockResolvedValue({ ...baseContract, display_name: 'Ny Navn' })
    prismaMock.auditLog.create.mockResolvedValue({})

    await updateContract({ contractId: 'contract-1', displayName: 'Ny Navn' })

    expect(prismaMock.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'contract-1', organization_id: 'org-1' }),
      })
    )
  })
})

// ─── addContractParty ─────────────────────────────────────────────────────────

describe('addContractParty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await addContractParty({ contractId: 'contract-1', counterpartyName: 'Test' })
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl når hverken personId eller counterpartyName er angivet', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.contract.findFirst.mockResolvedValue(baseContract)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    const result = await addContractParty({ contractId: 'contract-1' })
    expect(result).toEqual({ error: 'Angiv enten en person eller et ekstern navn' })
  })

  it('returnerer fejl uden modul-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await addContractParty({
      contractId: 'contract-1',
      counterpartyName: 'Ekstern Part',
    })
    expect(result).toEqual({ error: 'Ingen adgang til kontrakter' })
  })

  it('returnerer fejl når kontrakt ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.contract.findFirst.mockResolvedValue(null)
    const result = await addContractParty({
      contractId: 'ukendt',
      counterpartyName: 'Ekstern',
    })
    expect(result).toEqual({ error: 'Kontrakt ikke fundet' })
  })

  it('tilføjer part med korrekt organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.contract.findFirst.mockResolvedValue(baseContract)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)

    const mockParty = {
      id: 'party-1',
      organization_id: 'org-1',
      contract_id: 'contract-1',
      person_id: null,
      counterparty_name: 'Ekstern Part',
      role_in_contract: null,
      is_signer: false,
    }
    prismaMock.contractParty.create.mockResolvedValue(mockParty)
    prismaMock.auditLog.create.mockResolvedValue({})

    const result = await addContractParty({
      contractId: 'contract-1',
      counterpartyName: 'Ekstern Part',
    })
    expect(result).toEqual({ data: mockParty })
    expect(prismaMock.contractParty.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })
})
