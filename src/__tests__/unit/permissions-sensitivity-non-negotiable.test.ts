/**
 * IKKE-FORHANDLINGSBARE TESTS
 *
 * Disse tests MÅ ALDRIG fejle.
 * De tester de absolutte krav fra CONVENTIONS.md og roller-og-tilladelser.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

const mockPrisma = mockDeep<PrismaClient>()

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

import { canAccessSensitivity } from '@/lib/permissions'

const USER_ID = 'user-non-negotiable-test'
const ORG_ID = 'org-non-negotiable-test'

function makeRole(role: string) {
  return {
    id: `role-${role}-nn`,
    organizationId: ORG_ID,
    userId: USER_ID,
    role,
    scope: 'ALL',
    companyIds: [],
    createdAt: new Date(),
    createdBy: 'system',
  }
}

beforeEach(() => {
  mockReset(mockPrisma)
})

// ==================== IKKE-FORHANDLINGSBARE TESTS ====================

describe('IKKE-FORHANDLINGSBAR: COMPANY_MANAGER cannot see STRENGT_FORTROLIG', () => {
  it('COMPANY_MANAGER cannot see STRENGT_FORTROLIG', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRole('COMPANY_MANAGER'),
    ] as never)

    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')

    expect(result).toBe(false)
  })

  it('COMPANY_MANAGER kan heller ikke se STRENGT_FORTROLIG med OWN scope', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      { ...makeRole('COMPANY_MANAGER'), scope: 'OWN', companyIds: ['company-1'] },
    ] as never)

    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')
    expect(result).toBe(false)
  })

  it('COMPANY_MANAGER kan heller ikke se STRENGT_FORTROLIG med ASSIGNED scope', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      { ...makeRole('COMPANY_MANAGER'), scope: 'ASSIGNED', companyIds: ['company-1', 'company-2'] },
    ] as never)

    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')
    expect(result).toBe(false)
  })
})

describe('IKKE-FORHANDLINGSBAR: GROUP_LEGAL can see STRENGT_FORTROLIG', () => {
  it('GROUP_LEGAL can see STRENGT_FORTROLIG', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRole('GROUP_LEGAL'),
    ] as never)

    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')

    expect(result).toBe(true)
  })

  it('GROUP_LEGAL kan se alle sensitivitetsniveauer', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRole('GROUP_LEGAL'),
    ] as never)

    const levels = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'] as const
    for (const level of levels) {
      const result = await canAccessSensitivity(USER_ID, level)
      expect(result, `GROUP_LEGAL bør have adgang til ${level}`).toBe(true)
    }
  })
})

describe('IKKE-FORHANDLINGSBAR: unauthenticated user cannot access dashboard', () => {
  it('bruger uden roller returnerer false for alle sensitivitetsniveauer', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])

    const levels = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'] as const
    for (const level of levels) {
      const result = await canAccessSensitivity(USER_ID, level)
      expect(result, `Ingen roller → ingen adgang til ${level}`).toBe(false)
    }
  })
})

describe('IKKE-FORHANDLINGSBAR: tenant A cannot access tenant B companies (unit)', () => {
  it('canAccessCompany returnerer false for bruger uden nogen roller', async () => {
    const { canAccessCompany } = await import('@/lib/permissions')

    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])

    const result = await canAccessCompany(USER_ID, 'any-company-id')
    expect(result).toBe(false)
  })
})

describe('IKKE-FORHANDLINGSBAR: tenant A cannot access tenant B contracts (unit)', () => {
  it('getAccessibleCompanies returnerer tom liste for bruger uden roller', async () => {
    const { getAccessibleCompanies } = await import('@/lib/permissions')

    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([])

    const result = await getAccessibleCompanies(USER_ID)
    expect(result).toEqual([])
    expect(mockPrisma.company.findMany).not.toHaveBeenCalled()
  })
})