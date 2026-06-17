import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    case: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    // CaseCompany bør IKKE kaldes i den nye kode
    caseCompany: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['company-1', 'company-2']),
  getAllowedSensitivityLevels: vi
    .fn()
    .mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']),
}))

import { getCasesPageData } from '@/actions/cases'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

describe('getCasesPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-1',
        organizationId: 'org-1',
        email: 'test@test.dk',
        name: 'Test',
      },
      expires: '2099-01-01',
    } as never)
    vi.mocked(prisma.case.findMany).mockResolvedValue([])
    vi.mocked(prisma.case.count).mockResolvedValue(0)
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
  })

  it('bruger case_companies: { some: ... } i WHERE — kalder IKKE caseCompany.findMany', async () => {
    await getCasesPageData(1, 25)

    // Ny implementering: ingen separat CaseCompany pre-fetch
    expect(prisma.caseCompany.findMany).not.toHaveBeenCalled()

    // Case.findMany skal have case_companies: { some: ... } i WHERE
    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          deleted_at: null,
          case_companies: {
            some: { company_id: { in: ['company-1', 'company-2'] } },
          },
        }),
      })
    )
  })

  it('returnerer tom liste ved tom companyIds', async () => {
    const { getAccessibleCompanies } = await import('@/lib/permissions')
    vi.mocked(getAccessibleCompanies).mockResolvedValueOnce([])

    const result = await getCasesPageData(1, 25)

    expect(result).toEqual({ cases: [], totalCount: 0, page: 1, pageSize: 25 })
    expect(prisma.case.findMany).not.toHaveBeenCalled()
  })

  it('paginerer korrekt — skip og take beregnes fra page/pageSize', async () => {
    await getCasesPageData(3, 10)

    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    )
  })
})
