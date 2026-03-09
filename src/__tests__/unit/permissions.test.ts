import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

// Mock Prisma med vitest-mock-extended
const mockPrisma = mockDeep<PrismaClient>()

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

import {
  canAccessCompany,
  canAccessSensitivity,
  canAccessModule,
  getAccessibleCompanies,
  hasRole,
  hasAnyRole,
  canEdit,
  canManageUsers,
  canAccessBilling,
  getMaxSensitivityLevel,
} from '@/lib/permissions'

// ==================== TEST DATA ====================

const ORG_ID = 'org-test-001'
const USER_ID = 'user-test-001'
const COMPANY_A_ID = 'company-a-001'
const COMPANY_B_ID = 'company-b-001'

function makeRoleAssignment(overrides: Partial<{
  id: string
  organizationId: string
  userId: string
  role: string
  scope: string
  companyIds: string[]
  createdAt: Date
  createdBy: string
}> = {}) {
  return {
    id: 'role-001',
    organizationId: ORG_ID,
    userId: USER_ID,
    role: 'COMPANY_MANAGER' as const,
    scope: 'ALL' as const,
    companyIds: [],
    createdAt: new Date(),
    createdBy: 'system',
    ...overrides,
  }
}

// ==================== SETUP ====================

beforeEach(() => {
  mockReset(mockPrisma)
})

// ==================== canAccessCompany ====================

describe('canAccessCompany', () => {
  it('returnerer false for bruger uden roller', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])
    const result = await canAccessCompany(USER_ID, COMPANY_A_ID)
    expect(result).toBe(false)
  })

  it('GROUP_OWNER med scope ALL har adgang til alle selskaber', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER', scope: 'ALL', companyIds: [] }),
    ])
    const result = await canAccessCompany(USER_ID, COMPANY_A_ID)
    expect(result).toBe(true)
  })

  it('GROUP_ADMIN med scope ALL har adgang til alle selskaber', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_ADMIN', scope: 'ALL', companyIds: [] }),
    ])
    const result = await canAccessCompany(USER_ID, COMPANY_B_ID)
    expect(result).toBe(true)
  })

  it('GROUP_LEGAL med scope ALL har adgang til alle selskaber', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_LEGAL', scope: 'ALL', companyIds: [] }),
    ])
    const result = await canAccessCompany(USER_ID, COMPANY_A_ID)
    expect(result).toBe(true)
  })

  it('COMPANY_MANAGER med scope ASSIGNED har adgang til tildelte selskaber', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({
        role: 'COMPANY_MANAGER',
        scope: 'ASSIGNED',
        companyIds: [COMPANY_A_ID],
      }),
    ])
    const result = await canAccessCompany(USER_ID, COMPANY_A_ID)
    expect(result).toBe(true)
  })

  it('COMPANY_MANAGER med scope ASSIGNED har IKKE adgang til ikke-tildelte selskaber', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({
        role: 'COMPANY_MANAGER',
        scope: 'ASSIGNED',
        companyIds: [COMPANY_A_ID],
      }),
    ])
    const result = await canAccessCompany(USER_ID, COMPANY_B_ID)
    expect(result).toBe(false)
  })

  it('COMPANY_MANAGER med scope OWN har kun adgang til ét specifikt selskab', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({
        role: 'COMPANY_MANAGER',
        scope: 'OWN',
        companyIds: [COMPANY_A_ID],
      }),
    ])
    expect(await canAccessCompany(USER_ID, COMPANY_A_ID)).toBe(true)
    expect(await canAccessCompany(USER_ID, COMPANY_B_ID)).toBe(false)
  })

  it('COMPANY_MANAGER med tom companyIds og scope ASSIGNED har ingen adgang', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({
        role: 'COMPANY_MANAGER',
        scope: 'ASSIGNED',
        companyIds: [],
      }),
    ])
    const result = await canAccessCompany(USER_ID, COMPANY_A_ID)
    expect(result).toBe(false)
  })
})

// ==================== canAccessSensitivity ====================

describe('canAccessSensitivity', () => {
  it('returnerer false for bruger uden roller', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])
    const result = await canAccessSensitivity(USER_ID, 'STANDARD')
    expect(result).toBe(false)
  })

  describe('GROUP_OWNER — fuld adgang', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'GROUP_OWNER' }),
      ])
    })

    it('kan se PUBLIC', async () => {
      expect(await canAccessSensitivity(USER_ID, 'PUBLIC')).toBe(true)
    })

    it('kan se STANDARD', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STANDARD')).toBe(true)
    })

    it('kan se INTERN', async () => {
      expect(await canAccessSensitivity(USER_ID, 'INTERN')).toBe(true)
    })

    it('kan se FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'FORTROLIG')).toBe(true)
    })

    it('kan se STRENGT_FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')).toBe(true)
    })
  })

  describe('GROUP_LEGAL — kan se STRENGT_FORTROLIG', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'GROUP_LEGAL' }),
      ])
    })

    it('kan se STRENGT_FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')).toBe(true)
    })

    it('kan se FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'FORTROLIG')).toBe(true)
    })

    it('kan se INTERN', async () => {
      expect(await canAccessSensitivity(USER_ID, 'INTERN')).toBe(true)
    })
  })

  // IKKE-FORHANDLINGSBAR TEST
  describe('COMPANY_MANAGER — IKKE STRENGT_FORTROLIG', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'COMPANY_MANAGER' }),
      ])
    })

    it('COMPANY_MANAGER cannot see STRENGT_FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')).toBe(false)
    })

    it('kan se FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'FORTROLIG')).toBe(true)
    })

    it('kan se INTERN', async () => {
      expect(await canAccessSensitivity(USER_ID, 'INTERN')).toBe(true)
    })

    it('kan se STANDARD', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STANDARD')).toBe(true)
    })

    it('kan se PUBLIC', async () => {
      expect(await canAccessSensitivity(USER_ID, 'PUBLIC')).toBe(true)
    })
  })

  describe('COMPANY_LEGAL — ikke STRENGT_FORTROLIG eller FORTROLIG', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'COMPANY_LEGAL' }),
      ])
    })

    it('kan IKKE se STRENGT_FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')).toBe(false)
    })

    it('kan IKKE se FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'FORTROLIG')).toBe(false)
    })

    it('kan se INTERN', async () => {
      expect(await canAccessSensitivity(USER_ID, 'INTERN')).toBe(true)
    })
  })

  describe('COMPANY_READONLY — begrænset adgang', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'COMPANY_READONLY' }),
      ])
    })

    it('kan IKKE se STRENGT_FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')).toBe(false)
    })

    it('kan IKKE se FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'FORTROLIG')).toBe(false)
    })

    it('kan se INTERN', async () => {
      expect(await canAccessSensitivity(USER_ID, 'INTERN')).toBe(true)
    })

    it('kan se STANDARD', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STANDARD')).toBe(true)
    })

    it('kan se PUBLIC', async () => {
      expect(await canAccessSensitivity(USER_ID, 'PUBLIC')).toBe(true)
    })
  })

  describe('GROUP_FINANCE — ikke STRENGT_FORTROLIG', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'GROUP_FINANCE' }),
      ])
    })

    it('kan IKKE se STRENGT_FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')).toBe(false)
    })

    it('kan se FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'FORTROLIG')).toBe(true)
    })
  })

  describe('GROUP_READONLY — ikke STRENGT_FORTROLIG', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'GROUP_READONLY' }),
      ])
    })

    it('kan IKKE se STRENGT_FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')).toBe(false)
    })

    it('kan se FORTROLIG', async () => {
      expect(await canAccessSensitivity(USER_ID, 'FORTROLIG')).toBe(true)
    })
  })

  describe('Bruger med flere roller — OR-logik', () => {
    it('bruger med COMPANY_MANAGER OG GROUP_LEGAL kan se STRENGT_FORTROLIG via GROUP_LEGAL', async () => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'COMPANY_MANAGER', id: 'role-1' }),
        makeRoleAssignment({ role: 'GROUP_LEGAL', id: 'role-2' }),
      ])
      expect(await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')).toBe(true)
    })
  })
})

// ==================== canAccessModule ====================

describe('canAccessModule', () => {
  it('returnerer false for bruger uden roller', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])
    expect(await canAccessModule(USER_ID, 'contracts')).toBe(false)
  })

  describe('GROUP_OWNER — fuld modul-adgang', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'GROUP_OWNER' }),
      ])
    })

    it('har adgang til companies', async () => {
      expect(await canAccessModule(USER_ID, 'companies')).toBe(true)
    })

    it('har adgang til contracts', async () => {
      expect(await canAccessModule(USER_ID, 'contracts')).toBe(true)
    })

    it('har adgang til finance', async () => {
      expect(await canAccessModule(USER_ID, 'finance')).toBe(true)
    })

    it('har adgang til user_management', async () => {
      expect(await canAccessModule(USER_ID, 'user_management')).toBe(true)
    })
  })

  describe('GROUP_LEGAL — ingen finance-adgang', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'GROUP_LEGAL' }),
      ])
    })

    it('har adgang til contracts', async () => {
      expect(await canAccessModule(USER_ID, 'contracts')).toBe(true)
    })

    it('har adgang til cases', async () => {
      expect(await canAccessModule(USER_ID, 'cases')).toBe(true)
    })

    it('har IKKE adgang til finance', async () => {
      expect(await canAccessModule(USER_ID, 'finance')).toBe(false)
    })

    it('har IKKE adgang til user_management', async () => {
      expect(await canAccessModule(USER_ID, 'user_management')).toBe(false)
    })
  })

  describe('GROUP_FINANCE — ingen kontrakt-adgang', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'GROUP_FINANCE' }),
      ])
    })

    it('har adgang til finance', async () => {
      expect(await canAccessModule(USER_ID, 'finance')).toBe(true)
    })

    it('har IKKE adgang til contracts', async () => {
      expect(await canAccessModule(USER_ID, 'contracts')).toBe(false)
    })

    it('har IKKE adgang til cases', async () => {
      expect(await canAccessModule(USER_ID, 'cases')).toBe(false)
    })

    it('har IKKE adgang til user_management', async () => {
      expect(await canAccessModule(USER_ID, 'user_management')).toBe(false)
    })
  })

  describe('COMPANY_MANAGER — ingen user_management', () => {
    beforeEach(() => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'COMPANY_MANAGER' }),
      ])
    })

    it('har adgang til companies', async () => {
      expect(await canAccessModule(USER_ID, 'companies')).toBe(true)
    })

    it('har adgang til contracts', async () => {
      expect(await canAccessModule(USER_ID, 'contracts')).toBe(true)
    })

    it('har IKKE adgang til user_management', async () => {
      expect(await canAccessModule(USER_ID, 'user_management')).toBe(false)
    })
  })

  describe('GROUP_OWNER — ingen settings-adgang for COMPANY_READONLY', () => {
    it('COMPANY_READONLY har adgang til companies men ikke user_management', async () => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        makeRoleAssignment({ role: 'COMPANY_READONLY' }),
      ])
      expect(await canAccessModule(USER_ID, 'companies')).toBe(true)
      expect(await canAccessModule(USER_ID, 'user_management')).toBe(false)
    })
  })
})

// ==================== hasRole / hasAnyRole ====================

describe('hasRole', () => {
  it('returnerer true når bruger har den specifikke rolle', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER' }),
    ])
    expect(await hasRole(USER_ID, 'GROUP_OWNER')).toBe(true)
  })

  it('returnerer false når bruger ikke har rollen', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_MANAGER' }),
    ])
    expect(await hasRole(USER_ID, 'GROUP_OWNER')).toBe(false)
  })
})

describe('hasAnyRole', () => {
  it('returnerer true ved match med én af de angivne roller', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_LEGAL' }),
    ])
    expect(await hasAnyRole(USER_ID, ['GROUP_OWNER', 'GROUP_LEGAL'])).toBe(true)
  })

  it('returnerer false når ingen af rollerne matcher', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_READONLY' }),
    ])
    expect(await hasAnyRole(USER_ID, ['GROUP_OWNER', 'GROUP_ADMIN'])).toBe(false)
  })
})

// ==================== canEdit ====================

describe('canEdit', () => {
  it('GROUP_READONLY kan IKKE redigere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_READONLY' }),
    ])
    expect(await canEdit(USER_ID)).toBe(false)
  })

  it('COMPANY_READONLY kan IKKE redigere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_READONLY' }),
    ])
    expect(await canEdit(USER_ID)).toBe(false)
  })

  it('COMPANY_MANAGER kan redigere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_MANAGER' }),
    ])
    expect(await canEdit(USER_ID)).toBe(true)
  })

  it('GROUP_LEGAL kan redigere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_LEGAL' }),
    ])
    expect(await canEdit(USER_ID)).toBe(true)
  })

  it('bruger uden roller kan IKKE redigere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])
    expect(await canEdit(USER_ID)).toBe(false)
  })
})

// ==================== canManageUsers ====================

describe('canManageUsers', () => {
  it('GROUP_OWNER kan administrere brugere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER' }),
    ])
    expect(await canManageUsers(USER_ID)).toBe(true)
  })

  it('GROUP_ADMIN kan administrere brugere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_ADMIN' }),
    ])
    expect(await canManageUsers(USER_ID)).toBe(true)
  })

  it('GROUP_LEGAL kan IKKE administrere brugere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_LEGAL' }),
    ])
    expect(await canManageUsers(USER_ID)).toBe(false)
  })

  it('COMPANY_MANAGER kan IKKE administrere brugere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_MANAGER' }),
    ])
    expect(await canManageUsers(USER_ID)).toBe(false)
  })
})

// ==================== canAccessBilling ====================

describe('canAccessBilling', () => {
  it('GROUP_OWNER kan tilgå fakturering', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER' }),
    ])
    expect(await canAccessBilling(USER_ID)).toBe(true)
  })

  it('GROUP_ADMIN kan IKKE tilgå fakturering', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_ADMIN' }),
    ])
    expect(await canAccessBilling(USER_ID)).toBe(false)
  })
})

// ==================== getMaxSensitivityLevel ====================

describe('getMaxSensitivityLevel', () => {
  it('returnerer null for bruger uden roller', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])
    expect(await getMaxSensitivityLevel(USER_ID)).toBeNull()
  })

  it('GROUP_OWNER har STRENGT_FORTROLIG som maks-niveau', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER' }),
    ])
    expect(await getMaxSensitivityLevel(USER_ID)).toBe('STRENGT_FORTROLIG')
  })

  it('COMPANY_MANAGER har FORTROLIG som maks-niveau', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_MANAGER' }),
    ])
    expect(await getMaxSensitivityLevel(USER_ID)).toBe('FORTROLIG')
  })

  it('COMPANY_LEGAL har INTERN som maks-niveau', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_LEGAL' }),
    ])
    expect(await getMaxSensitivityLevel(USER_ID)).toBe('INTERN')
  })
})

// ==================== getAccessibleCompanies ====================

describe('getAccessibleCompanies', () => {
  it('returnerer tom liste for bruger uden roller', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])
    const result = await getAccessibleCompanies(USER_ID)
    expect(result).toEqual([])
  })

  it('GROUP_OWNER ser alle selskaber i organisationen', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER', scope: 'ALL' }),
    ])
    mockPrisma.user.findUnique.mockResolvedValue({
      id: USER_ID,
      organizationId: ORG_ID,
      email: 'owner@test.dk',
      name: 'Test Owner',
      avatarUrl: null,
      microsoftId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })
    const mockCompanies = [
      { id: COMPANY_A_ID, name: 'Selskab A' },
      { id: COMPANY_B_ID, name: 'Selskab B' },
    ]
    mockPrisma.company.findMany.mockResolvedValue(mockCompanies as never)

    const result = await getAccessibleCompanies(USER_ID)
    expect(result).toHaveLength(2)
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          deletedAt: null,
        }),
      })
    )
  })

  it('COMPANY_MANAGER med ASSIGNED kun ser tildelte selskaber', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({
        role: 'COMPANY_MANAGER',
        scope: 'ASSIGNED',
        companyIds: [COMPANY_A_ID],
      }),
    ])
    mockPrisma.user.findUnique.mockResolvedValue({
      id: USER_ID,
      organizationId: ORG_ID,
      email: 'manager@test.dk',
      name: 'Test Manager',
      avatarUrl: null,
      microsoftId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })
    mockPrisma.company.findMany.mockResolvedValue([
      { id: COMPANY_A_ID, name: 'Selskab A' },
    ] as never)

    const result = await getAccessibleCompanies(USER_ID)
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [COMPANY_A_ID] },
          organizationId: ORG_ID,
        }),
      })
    )
    expect(result).toHaveLength(1)
  })
})