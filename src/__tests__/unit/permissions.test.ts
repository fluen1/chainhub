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
    ] as any)
    const result = await canAccessCompany(USER_ID, COMPANY_A_ID)
    expect(result).toBe(true)
  })

  it('GROUP_ADMIN med scope ALL har adgang til alle selskaber', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_ADMIN', scope: 'ALL', companyIds: [] }),
    ] as any)
    const result = await canAccessCompany(USER_ID, COMPANY_B_ID)
    expect(result).toBe(true)
  })

  it('GROUP_LEGAL med scope ALL har adgang til alle selskaber', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_LEGAL', scope: 'ALL', companyIds: [] }),
    ] as any)
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
    ] as any)
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
    ] as any)
    const result = await canAccessCompany(USER_ID, COMPANY_B_ID)
    expect(result).toBe(false)
  })
})

// ==================== canAccessSensitivity ====================

describe('canAccessSensitivity', () => {
  it('returnerer false for bruger uden roller', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])
    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')
    expect(result).toBe(false)
  })

  it('GROUP_OWNER kan se STRENGT_FORTROLIG', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER', scope: 'ALL' }),
    ] as any)
    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')
    expect(result).toBe(true)
  })

  it('GROUP_ADMIN kan se STRENGT_FORTROLIG', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_ADMIN', scope: 'ALL' }),
    ] as any)
    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')
    expect(result).toBe(true)
  })

  it('COMPANY_MANAGER cannot see STRENGT_FORTROLIG', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_MANAGER', scope: 'ALL' }),
    ] as any)
    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')
    expect(result).toBe(false)
  })

  it('COMPANY_MANAGER kan se FORTROLIG', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_MANAGER', scope: 'ALL' }),
    ] as any)
    const result = await canAccessSensitivity(USER_ID, 'FORTROLIG')
    expect(result).toBe(true)
  })

  it('COMPANY_READONLY kan se INTERN', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_READONLY', scope: 'ALL' }),
    ] as any)
    const result = await canAccessSensitivity(USER_ID, 'INTERN')
    expect(result).toBe(true)
  })

  it('COMPANY_READONLY kan IKKE se FORTROLIG', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_READONLY', scope: 'ALL' }),
    ] as any)
    const result = await canAccessSensitivity(USER_ID, 'FORTROLIG')
    expect(result).toBe(false)
  })
})

// ==================== canAccessModule ====================

describe('canAccessModule', () => {
  it('GROUP_OWNER har adgang til alle moduler', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER', scope: 'ALL' }),
    ] as any)
    const modules = ['companies', 'contracts', 'cases', 'tasks', 'persons', 'documents', 'finance', 'settings', 'user_management', 'dashboard'] as const
    for (const mod of modules) {
      const result = await canAccessModule(USER_ID, mod)
      expect(result).toBe(true)
    }
  })

  it('GROUP_FINANCE har IKKE adgang til contracts-modulet', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_FINANCE', scope: 'ALL' }),
    ] as any)
    const result = await canAccessModule(USER_ID, 'contracts')
    expect(result).toBe(false)
  })

  it('COMPANY_MANAGER har adgang til companies-modulet', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_MANAGER', scope: 'ALL' }),
    ] as any)
    const result = await canAccessModule(USER_ID, 'companies')
    expect(result).toBe(true)
  })
})

// ==================== hasRole ====================

describe('hasRole', () => {
  it('returnerer true når bruger har den givne rolle', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_ADMIN', scope: 'ALL' }),
    ] as any)
    const result = await hasRole(USER_ID, 'GROUP_ADMIN')
    expect(result).toBe(true)
  })

  it('returnerer false når bruger ikke har den givne rolle', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_READONLY', scope: 'ALL' }),
    ] as any)
    const result = await hasRole(USER_ID, 'GROUP_ADMIN')
    expect(result).toBe(false)
  })
})

// ==================== hasAnyRole ====================

describe('hasAnyRole', () => {
  it('returnerer true når bruger har én af de givne roller', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_LEGAL', scope: 'ALL' }),
    ] as any)
    const result = await hasAnyRole(USER_ID, ['GROUP_ADMIN', 'GROUP_LEGAL'])
    expect(result).toBe(true)
  })

  it('returnerer false når bruger ikke har nogen af de givne roller', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_READONLY', scope: 'ALL' }),
    ] as any)
    const result = await hasAnyRole(USER_ID, ['GROUP_ADMIN', 'GROUP_LEGAL'])
    expect(result).toBe(false)
  })
})

// ==================== canEdit ====================

describe('canEdit', () => {
  it('GROUP_OWNER kan redigere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER', scope: 'ALL' }),
    ] as any)
    const result = await canEdit(USER_ID)
    expect(result).toBe(true)
  })

  it('GROUP_READONLY kan IKKE redigere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_READONLY', scope: 'ALL' }),
    ] as any)
    const result = await canEdit(USER_ID)
    expect(result).toBe(false)
  })

  it('COMPANY_READONLY kan IKKE redigere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_READONLY', scope: 'ALL' }),
    ] as any)
    const result = await canEdit(USER_ID)
    expect(result).toBe(false)
  })
})

// ==================== canManageUsers ====================

describe('canManageUsers', () => {
  it('GROUP_OWNER kan styre brugere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER', scope: 'ALL' }),
    ] as any)
    const result = await canManageUsers(USER_ID)
    expect(result).toBe(true)
  })

  it('GROUP_ADMIN kan styre brugere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_ADMIN', scope: 'ALL' }),
    ] as any)
    const result = await canManageUsers(USER_ID)
    expect(result).toBe(true)
  })

  it('COMPANY_MANAGER kan IKKE styre brugere', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_MANAGER', scope: 'ALL' }),
    ] as any)
    const result = await canManageUsers(USER_ID)
    expect(result).toBe(false)
  })
})

// ==================== canAccessBilling ====================

describe('canAccessBilling', () => {
  it('GROUP_OWNER har adgang til fakturering', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER', scope: 'ALL' }),
    ] as any)
    const result = await canAccessBilling(USER_ID)
    expect(result).toBe(true)
  })

  it('GROUP_ADMIN har IKKE adgang til fakturering', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_ADMIN', scope: 'ALL' }),
    ] as any)
    const result = await canAccessBilling(USER_ID)
    expect(result).toBe(false)
  })
})

// ==================== getMaxSensitivityLevel ====================

describe('getMaxSensitivityLevel', () => {
  it('GROUP_OWNER får STRENGT_FORTROLIG som max niveau', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER', scope: 'ALL' }),
    ] as any)
    const result = await getMaxSensitivityLevel(USER_ID)
    expect(result).toBe('STRENGT_FORTROLIG')
  })

  it('COMPANY_MANAGER får FORTROLIG som max niveau', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_MANAGER', scope: 'ALL' }),
    ] as any)
    const result = await getMaxSensitivityLevel(USER_ID)
    expect(result).toBe('FORTROLIG')
  })

  it('COMPANY_READONLY får INTERN som max niveau', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'COMPANY_READONLY', scope: 'ALL' }),
    ] as any)
    const result = await getMaxSensitivityLevel(USER_ID)
    expect(result).toBe('INTERN')
  })

  it('bruger uden roller får null', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])
    const result = await getMaxSensitivityLevel(USER_ID)
    expect(result).toBeNull()
  })
})

// ==================== getAccessibleCompanies ====================

describe('getAccessibleCompanies', () => {
  it('GROUP_OWNER med ALL scope returnerer tom liste (betyder alle)', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({ role: 'GROUP_OWNER', scope: 'ALL', companyIds: [] }),
    ] as any)
    const result = await getAccessibleCompanies(USER_ID)
    // ALL scope = adgang til alt, returnerer null/undefined eller tom liste som signal
    expect(result).toBeNull()
  })

  it('COMPANY_MANAGER med ASSIGNED scope returnerer tildelte selskaber', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRoleAssignment({
        role: 'COMPANY_MANAGER',
        scope: 'ASSIGNED',
        companyIds: [COMPANY_A_ID, COMPANY_B_ID],
      }),
    ] as any)
    const result = await getAccessibleCompanies(USER_ID)
    expect(result).toContain(COMPANY_A_ID)
    expect(result).toContain(COMPANY_B_ID)
  })
})