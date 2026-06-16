import { describe, it, expect, vi, beforeEach } from 'vitest'

// â”€â”€â”€ Hoisted mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    case: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    caseCompany: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(),
  canAccessCompanies: vi.fn().mockResolvedValue(new Set(['company-1', 'company-2'])),
  canAccessModule: vi.fn(),
  canAccessSensitivity: vi.fn(),
  getAccessibleCompanies: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/ai/invalidate-cache', () => ({
  invalidateCompanyInsightsCache: vi.fn().mockResolvedValue(undefined),
}))

import {
  createCase,
  updateCaseStatus,
  closeCase,
  escalateCase,
  updateCase,
  deleteCase,
} from '@/actions/cases'
import { recordAuditEvent } from '@/lib/audit'
import { auth } from '@/lib/auth'
import {
  canAccessCompany,
  canAccessCompanies,
  canAccessModule,
  canAccessSensitivity,
  getAccessibleCompanies,
} from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'

// HjÃ¦lpefunktioner
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

const baseCase = {
  id: 'case-1',
  organization_id: 'org-1',
  title: 'Test Sag',
  case_type: 'TVIST',
  case_subtype: null,
  case_number: 'CAS-2026-0001',
  status: 'NY' as const,
  sensitivity: 'INTERN' as const,
  description: null,
  responsible_id: null,
  created_by: 'user-1',
  deleted_at: null,
  closed_at: null,
  due_date: null,
  created_at: new Date(),
  updated_at: new Date(),
}

const baseCaseWithCompanies = {
  ...baseCase,
  case_companies: [{ company_id: 'company-1' }],
}

// â”€â”€â”€ createCase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('createCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
    prismaMock.case.count.mockResolvedValue(0)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createCase({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: ['company-1'],
      sensitivity: 'INTERN',
    })
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved ugyldigt input (tom titel)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    const result = await createCase({
      title: '',
      caseType: 'TVIST',
      companyIds: ['company-1'],
      sensitivity: 'INTERN',
    })
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl ved tomt companyIds-array', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    const result = await createCase({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: [],
      sensitivity: 'INTERN',
    })
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl uden modul-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await createCase({
      title: 'Test Sag',
      caseType: 'TVIST',
      companyIds: ['company-1'],
      sensitivity: 'INTERN',
    })
    expect(result).toEqual({ error: 'Ingen adgang til sagsstyring' })
  })

  it('returnerer fejl uden adgang til tilknyttet selskab', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(canAccessCompanies).mockResolvedValueOnce(new Set()) // tom Set = ingen adgang
    const result = await createCase({
      title: 'Test Sag',
      caseType: 'TVIST',
      companyIds: ['company-1'],
      sensitivity: 'INTERN',
    })
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('company-1')
  })

  it('returnerer fejl uden sensitivity-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(canAccessCompanies).mockResolvedValue(new Set(['company-1']))
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)
    const result = await createCase({
      title: 'Test Sag',
      caseType: 'TVIST',
      companyIds: ['company-1'],
      sensitivity: 'STRENGT_FORTROLIG',
    })
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl ved rate limiting', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(canAccessCompanies).mockResolvedValue(new Set(['company-1']))
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true, remaining: 0 } as any)
    const result = await createCase({
      title: 'Test Sag',
      caseType: 'TVIST',
      companyIds: ['company-1'],
      sensitivity: 'INTERN',
    })
    expect(result).toEqual({ error: 'For mange handlinger. Vent venligst.' })
  })

  it('opretter sag med korrekt organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(canAccessCompanies).mockResolvedValue(new Set(['company-1']))
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    prismaMock.case.create.mockResolvedValue(baseCase)
    prismaMock.caseCompany.create.mockResolvedValue({})

    const result = await createCase({
      title: 'Test Sag',
      caseType: 'TVIST',
      companyIds: ['company-1'],
      sensitivity: 'INTERN',
    })
    expect(result).toEqual({ data: baseCase })
    expect(prismaMock.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })

  it('opretter CaseCompany-records for hvert tilknyttet selskab', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(canAccessCompanies).mockResolvedValue(new Set(['company-1', 'company-2']))
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    prismaMock.case.create.mockResolvedValue(baseCase)
    prismaMock.caseCompany.create.mockResolvedValue({})

    await createCase({
      title: 'Test Sag',
      caseType: 'TVIST',
      companyIds: ['company-1', 'company-2'],
      sensitivity: 'INTERN',
    })
    expect(prismaMock.caseCompany.create).toHaveBeenCalledTimes(2)
  })
})

// â”€â”€â”€ updateCaseStatus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('updateCaseStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateCaseStatus({ caseId: 'case-1', status: 'AKTIV' })
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl nÃ¥r sag ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.case.findFirst.mockResolvedValue(null)
    const result = await updateCaseStatus({ caseId: 'ukendt', status: 'AKTIV' })
    expect(result).toEqual({ error: 'Sag ikke fundet' })
  })

  it('returnerer fejl ved ugyldig status-transition', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.case.findFirst.mockResolvedValue({ ...baseCase, status: 'ARKIVERET' })
    // ARKIVERET â†’ AKTIV er ikke tilladt
    const result = await updateCaseStatus({ caseId: 'case-1', status: 'AKTIV' })
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('status')
  })

  it('opdaterer status fra NY til AKTIV', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.case.findFirst.mockResolvedValue({ ...baseCaseWithCompanies, status: 'NY' })
    prismaMock.case.update.mockResolvedValue({ ...baseCase, status: 'AKTIV' })
    prismaMock.caseCompany.findFirst.mockResolvedValue({ company_id: 'company-1' })
    prismaMock.caseCompany.findMany.mockResolvedValue([{ company_id: 'company-1' }])

    const result = await updateCaseStatus({ caseId: 'case-1', status: 'AKTIV' })
    expect(result).toHaveProperty('data')
    expect((result as { data: typeof baseCase }).data.status).toBe('AKTIV')
  })

  it('sÃ¦tter closed_at ved status LUKKET', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.case.findFirst.mockResolvedValue({ ...baseCaseWithCompanies, status: 'AKTIV' })
    prismaMock.case.update.mockResolvedValue({
      ...baseCase,
      status: 'LUKKET',
      closed_at: new Date(),
    })
    prismaMock.caseCompany.findFirst.mockResolvedValue({ company_id: 'company-1' })
    prismaMock.caseCompany.findMany.mockResolvedValue([{ company_id: 'company-1' }])

    await updateCaseStatus({ caseId: 'case-1', status: 'LUKKET' })
    expect(prismaMock.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closed_at: expect.any(Date) }),
      })
    )
  })

  it('tenant isolation: findFirst inkluderer organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.case.findFirst.mockResolvedValue(null)

    await updateCaseStatus({ caseId: 'case-1', status: 'AKTIV' })
    expect(prismaMock.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })

  it('recordAuditEvent kaldes efter status-Ã¦ndring', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.case.findFirst.mockResolvedValue({ ...baseCaseWithCompanies, status: 'NY' })
    prismaMock.case.update.mockResolvedValue({ ...baseCase, status: 'AKTIV' })
    prismaMock.caseCompany.findFirst.mockResolvedValue({ company_id: 'company-1' })
    prismaMock.caseCompany.findMany.mockResolvedValue([{ company_id: 'company-1' }])

    await updateCaseStatus({ caseId: 'case-1', status: 'AKTIV' })
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'STATUS_CHANGE', resourceType: 'case' })
    )
  })
})

// â”€â”€â”€ closeCase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('closeCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await closeCase('case-1')
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl uden modul-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await closeCase('case-1')
    expect(result).toEqual({ error: 'Ingen adgang til sagsstyring' })
  })

  it('returnerer fejl nÃ¥r sag ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(null)
    const result = await closeCase('ukendt')
    expect(result).toEqual({ error: 'Sag ikke fundet' })
  })

  it('returnerer fejl nÃ¥r sag allerede er lukket', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue({
      ...baseCaseWithCompanies,
      status: 'LUKKET',
    })
    const result = await closeCase('case-1')
    expect(result).toEqual({ error: 'Sagen er allerede lukket' })
  })

  it('returnerer fejl uden adgang til tilknyttet selskab', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCaseWithCompanies)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await closeCase('case-1')
    expect(result).toEqual({ error: 'Ingen adgang til denne sag' })
  })

  it('lukker sag og sÃ¦tter closed_at', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCaseWithCompanies)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.case.update.mockResolvedValue({
      ...baseCase,
      status: 'LUKKET',
      closed_at: new Date(),
    })

    const result = await closeCase('case-1', 'Afsluttet')
    expect(result).toHaveProperty('data')
    expect(prismaMock.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'LUKKET', closed_at: expect.any(Date) }),
      })
    )
  })
})

// â”€â”€â”€ escalateCase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('escalateCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await escalateCase('case-1')
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved tomt caseId', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    const result = await escalateCase('')
    expect(result).toEqual({ error: 'Sags-ID mangler' })
  })

  it('returnerer fejl uden modul-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await escalateCase('case-1')
    expect(result).toEqual({ error: 'Ingen adgang til sagsstyring' })
  })

  it('returnerer fejl nÃ¥r sag ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(null)
    const result = await escalateCase('ukendt')
    expect(result).toEqual({ error: 'Sag ikke fundet' })
  })

  it('returnerer fejl for lukket sag', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue({ ...baseCaseWithCompanies, status: 'LUKKET' })
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    const result = await escalateCase('case-1')
    expect(result).toEqual({ error: 'Lukkede sager kan ikke eskaleres' })
  })

  it('opretter eskalerings-kommentar', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCaseWithCompanies)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue({ name: 'Test Bruger', email: 'test@test.dk' })
    prismaMock.comment.create.mockResolvedValue({ id: 'comment-1' })

    const result = await escalateCase('case-1')
    expect(result).toEqual({ data: undefined })
    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          case_id: 'case-1',
          organization_id: 'org-1',
          content: expect.stringContaining('Eskaleret af'),
        }),
      })
    )
  })
})

// â”€â”€â”€ updateCase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('updateCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateCase({ caseId: 'case-1', title: 'Ny Titel' })
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl uden modul-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await updateCase({ caseId: 'case-1', title: 'Ny Titel' })
    expect(result).toEqual({ error: 'Ingen adgang til sagsstyring' })
  })

  it('returnerer fejl nÃ¥r sag ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(null)
    const result = await updateCase({ caseId: 'ukendt', title: 'Test' })
    expect(result).toEqual({ error: 'Sag ikke fundet' })
  })

  it('returnerer fejl uden adgang til tilknyttet selskab', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCaseWithCompanies)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await updateCase({ caseId: 'case-1', title: 'Test' })
    expect(result).toEqual({ error: 'Ingen adgang til denne sag' })
  })

  it('opdaterer sag og skriver audit-event', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCaseWithCompanies)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.case.update.mockResolvedValue({ ...baseCase, title: 'Ny Titel' })

    const result = await updateCase({ caseId: 'case-1', title: 'Ny Titel' })
    expect(result).toHaveProperty('data')
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', resourceType: 'case' })
    )
  })

  it('returnerer fejl ved sensitivity-niveauÃ¦ndring uden adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCaseWithCompanies)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)

    const result = await updateCase({ caseId: 'case-1', sensitivity: 'STRENGT_FORTROLIG' })
    expect(result).toHaveProperty('error')
  })
})

// â”€â”€â”€ deleteCase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('deleteCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
  })

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await deleteCase('case-1')
    expect(result).toEqual({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl uden settings-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await deleteCase('case-1')
    expect(result).toHaveProperty('error')
  })

  it('returnerer fejl nÃ¥r sag ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(null)
    const result = await deleteCase('ukendt')
    expect(result).toEqual({ error: 'Sag ikke fundet' })
  })

  it('soft-deleter sag (sÃ¦tter deleted_at)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCase)
    prismaMock.case.update.mockResolvedValue({ ...baseCase, deleted_at: new Date() })
    prismaMock.caseCompany.findMany.mockResolvedValue([{ company_id: 'company-1' }])

    const result = await deleteCase('case-1')
    expect(result).toEqual({ data: undefined })
    expect(prismaMock.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      })
    )
  })

  it('tenant isolation: findFirst inkluderer organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(null)

    await deleteCase('case-1')
    expect(prismaMock.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-1' }),
      })
    )
  })
})

// ─── mutation-WHERE invariant-tests ──────────────────────────────────────────

describe('mutation-WHERE: organization_id i alle update/soft-delete kald', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false, remaining: 59 } as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
  })

  it('updateCaseStatus: update-WHERE indeholder organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    prismaMock.case.findFirst.mockResolvedValue({ ...baseCaseWithCompanies, status: 'NY' })
    prismaMock.case.update.mockResolvedValue({ ...baseCase, status: 'AKTIV' })
    prismaMock.caseCompany.findFirst.mockResolvedValue({ company_id: 'company-1' })
    prismaMock.caseCompany.findMany.mockResolvedValue([{ company_id: 'company-1' }])

    await updateCaseStatus({ caseId: 'case-1', status: 'AKTIV' })

    expect(prismaMock.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'case-1', organization_id: 'org-1' }),
      })
    )
  })

  it('closeCase: update-WHERE indeholder organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCaseWithCompanies)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.case.update.mockResolvedValue({
      ...baseCase,
      status: 'LUKKET',
      closed_at: new Date(),
    })

    await closeCase('case-1')

    expect(prismaMock.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'case-1', organization_id: 'org-1' }),
      })
    )
  })

  it('updateCase: update-WHERE indeholder organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCaseWithCompanies)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.case.update.mockResolvedValue({ ...baseCase, title: 'Ny Titel' })

    await updateCase({ caseId: 'case-1', title: 'Ny Titel' })

    expect(prismaMock.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'case-1', organization_id: 'org-1' }),
      })
    )
  })

  it('deleteCase: update-WHERE indeholder organization_id', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession())
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.findFirst.mockResolvedValue(baseCase)
    prismaMock.case.update.mockResolvedValue({ ...baseCase, deleted_at: new Date() })
    prismaMock.caseCompany.findMany.mockResolvedValue([{ company_id: 'company-1' }])

    await deleteCase('case-1')

    expect(prismaMock.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'case-1', organization_id: 'org-1' }),
      })
    )
  })
})
