/**
 * Komplet sensitivitets-matrix test
 * Verificerer ALLE kombinationer fra roller-og-tilladelser.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

const mockPrisma = mockDeep<PrismaClient>()

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

import { canAccessSensitivity } from '@/lib/permissions'

const USER_ID = 'user-matrix-test'
const ORG_ID = 'org-matrix-test'

function makeRole(role: string, overrides = {}) {
  return {
    id: `role-${role}`,
    organizationId: ORG_ID,
    userId: USER_ID,
    role,
    scope: 'ALL',
    companyIds: [],
    createdAt: new Date(),
    createdBy: 'system',
    ...overrides,
  }
}

beforeEach(() => {
  mockReset(mockPrisma)
})

// Matrix fra spec:
// ROLLE               STRENGT_FORTROLIG  FORTROLIG  INTERN  STANDARD  PUBLIC
// GROUP_OWNER         ✅                 ✅         ✅      ✅        ✅
// GROUP_ADMIN         ✅                 ✅         ✅      ✅        ✅
// GROUP_LEGAL         ✅                 ✅         ✅      ✅        ✅
// GROUP_FINANCE       ❌                 ✅         ✅      ✅        ✅
// GROUP_READONLY      ❌                 ✅         ✅      ✅        ✅
// COMPANY_MANAGER     ❌                 ✅         ✅      ✅        ✅
// COMPANY_LEGAL       ❌                 ❌         ✅      ✅        ✅
// COMPANY_READONLY    ❌                 ❌         ✅      ✅        ✅

const SENSITIVITY_LEVELS = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'] as const
type SensitivityLevel = typeof SENSITIVITY_LEVELS[number]

const ACCESS_MATRIX: Record<string, Record<SensitivityLevel, boolean>> = {
  GROUP_OWNER: {
    PUBLIC: true,
    STANDARD: true,
    INTERN: true,
    FORTROLIG: true,
    STRENGT_FORTROLIG: true,
  },
  GROUP_ADMIN: {
    PUBLIC: true,
    STANDARD: true,
    INTERN: true,
    FORTROLIG: true,
    STRENGT_FORTROLIG: true,
  },
  GROUP_LEGAL: {
    PUBLIC: true,
    STANDARD: true,
    INTERN: true,
    FORTROLIG: true,
    STRENGT_FORTROLIG: true,
  },
  GROUP_FINANCE: {
    PUBLIC: true,
    STANDARD: true,
    INTERN: true,
    FORTROLIG: true,
    STRENGT_FORTROLIG: false,
  },
  GROUP_READONLY: {
    PUBLIC: true,
    STANDARD: true,
    INTERN: true,
    FORTROLIG: true,
    STRENGT_FORTROLIG: false,
  },
  COMPANY_MANAGER: {
    PUBLIC: true,
    STANDARD: true,
    INTERN: true,
    FORTROLIG: true,
    STRENGT_FORTROLIG: false,
  },
  COMPANY_LEGAL: {
    PUBLIC: true,
    STANDARD: true,
    INTERN: true,
    FORTROLIG: false,
    STRENGT_FORTROLIG: false,
  },
  COMPANY_READONLY: {
    PUBLIC: true,
    STANDARD: true,
    INTERN: true,
    FORTROLIG: false,
    STRENGT_FORTROLIG: false,
  },
}

describe('Sensitivitets-matrix — alle roller og niveauer', () => {
  for (const [role, accessMap] of Object.entries(ACCESS_MATRIX)) {
    describe(`${role}`, () => {
      beforeEach(() => {
        mockPrisma.userRoleAssignment.findMany.mockResolvedValue([makeRole(role)] as never)
      })

      for (const [level, expected] of Object.entries(accessMap)) {
        const symbol = expected ? '✅' : '❌'
        it(`${symbol} ${level}`, async () => {
          const result = await canAccessSensitivity(USER_ID, level as SensitivityLevel)
          expect(result).toBe(expected)
        })
      }
    })
  }
})

// De ikke-forhandlingsbare tests som eksplicitte tests
describe('IKKE-FORHANDLINGSBARE sensitivity tests', () => {
  it('COMPANY_MANAGER cannot see STRENGT_FORTROLIG', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRole('COMPANY_MANAGER'),
    ] as never)
    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')
    expect(result).toBe(false)
  })

  it('GROUP_LEGAL can see STRENGT_FORTROLIG', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      makeRole('GROUP_LEGAL'),
    ] as never)
    const result = await canAccessSensitivity(USER_ID, 'STRENGT_FORTROLIG')
    expect(result).toBe(true)
  })
})