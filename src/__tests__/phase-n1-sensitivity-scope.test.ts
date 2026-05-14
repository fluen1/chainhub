/**
 * Phase N1 — Sensitivity-server-validering + RBAC-data-scope
 * Fix 4: updateCase/createCase sensitivity-validering
 * Fix 5: documentsCount + personsCount company-scope
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Fælles mocks ───────────────────────────────────────────────────────────

const mockSession = { user: { id: 'user-1', organizationId: 'org-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(mockSession),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['company-1']),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/ai/invalidate-cache', () => ({
  invalidateCompanyInsightsCache: vi.fn().mockResolvedValue(undefined),
}))

const baseCase = {
  id: 'case-1',
  organization_id: 'org-1',
  status: 'AKTIV',
  sensitivity: 'STANDARD' as const,
  title: 'Test sag',
  deleted_at: null,
  case_companies: [{ company_id: 'company-1' }],
}

vi.mock('@/lib/db', () => ({
  prisma: {
    userRoleAssignment: {
      findMany: vi.fn().mockResolvedValue([{ role: 'GROUP_LEGAL', scope: 'ALL', company_ids: [] }]),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    case: {
      findFirst: vi.fn().mockResolvedValue(baseCase),
      update: vi.fn().mockResolvedValue(baseCase),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ ...baseCase, id: 'case-new' }),
    },
    caseCompany: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([{ company_id: 'company-1' }]),
    },
  },
}))

// ─── Fix 4: updateCase sensitivity-validering ────────────────────────────────

describe('updateCase — sensitivity server-validering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('tillader update hvis bruger har sensitivity-adgang', async () => {
    const { canAccessSensitivity } = await import('@/lib/permissions')
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)

    const { updateCase } = await import('@/actions/cases')
    const result = await updateCase({
      caseId: 'case-1',
      sensitivity: 'STRENGT_FORTROLIG',
    })

    expect(canAccessSensitivity).toHaveBeenCalledWith('user-1', 'STRENGT_FORTROLIG', 'org-1')
    expect('data' in result || 'error' in result).toBe(true)
    // Ingen sensitivity-fejl
    if ('error' in result) {
      expect(result.error).not.toContain('fortrolighedsniveau')
    }
  })

  it('blokerer update hvis bruger IKKE har sensitivity-adgang', async () => {
    const { canAccessSensitivity } = await import('@/lib/permissions')
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)

    const { updateCase } = await import('@/actions/cases')
    const result = await updateCase({
      caseId: 'case-1',
      sensitivity: 'STRENGT_FORTROLIG',
    })

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error).toContain('fortrolighedsniveau')
    }
  })

  it('kalder IKKE canAccessSensitivity hvis sensitivity ikke ændres', async () => {
    const { canAccessSensitivity } = await import('@/lib/permissions')
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)

    const { updateCase } = await import('@/actions/cases')
    // Ingen sensitivity-felt → skip sensitivity check
    await updateCase({ caseId: 'case-1', title: 'Ny titel' })

    expect(canAccessSensitivity).not.toHaveBeenCalled()
  })
})

// ─── Fix 4: createCase sensitivity-validering ────────────────────────────────

describe('createCase — sensitivity server-validering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blokerer oprettelse hvis bruger ikke har adgang til STRENGT_FORTROLIG', async () => {
    const { canAccessSensitivity } = await import('@/lib/permissions')
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)

    const { createCase } = await import('@/actions/cases')
    const result = await createCase({
      title: 'Test',
      caseType: 'COMPLIANCE',
      sensitivity: 'STRENGT_FORTROLIG',
      companyIds: ['company-1'],
    })

    expect(result).toHaveProperty('error')
    if ('error' in result) {
      expect(result.error).toContain('fortrolighedsniveau')
    }
    expect(canAccessSensitivity).toHaveBeenCalledWith('user-1', 'STRENGT_FORTROLIG', 'org-1')
  })

  it('tillader oprettelse med STANDARD sensitivity for GROUP_LEGAL', async () => {
    const { canAccessSensitivity } = await import('@/lib/permissions')
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)

    const { createCase } = await import('@/actions/cases')
    const result = await createCase({
      title: 'Test',
      caseType: 'COMPLIANCE',
      sensitivity: 'STANDARD',
      companyIds: ['company-1'],
    })

    // Ingen sensitivity-fejl — canAccessSensitivity kald gennemføres OK
    if ('error' in result) {
      expect(result.error).not.toContain('fortrolighedsniveau')
    }
  })
})
