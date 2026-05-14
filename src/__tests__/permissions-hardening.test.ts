/**
 * Phase A audit-fixes — Permissions hærdning (Fase A #5-6)
 * Fix 5: getUserRoles kræver organization_id
 * Fix 6: canAccessModule fail-closed + eksplicitte cases for persons/documents
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    userRoleAssignment: {
      findMany: vi.fn(),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
}))

// ─────────────────────────────────────────────────────────
// Fix 5: getUserRoles sender organization_id til DB
// ─────────────────────────────────────────────────────────

describe('getUserRoles — organization_id filter forhindrer cross-tenant leak', () => {
  beforeEach(() => vi.clearAllMocks())

  it('canAccessModule sender organization_id til userRoleAssignment.findMany', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_OWNER', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    await canAccessModule('user-1', 'settings', 'org-1')

    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-1',
          organization_id: 'org-1',
        }),
      })
    )
  })

  it('canAccessCompany sender organization_id til userRoleAssignment.findMany', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_OWNER', scope: 'ALL', company_ids: [] },
    ] as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: 'company-1' }] as never)

    const { canAccessCompany } = await import('@/lib/permissions')
    await canAccessCompany('user-1', 'company-1', 'org-1')

    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
        }),
      })
    )
  })

  it('canAccessSensitivity sender organization_id til userRoleAssignment.findMany', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_LEGAL', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessSensitivity } = await import('@/lib/permissions')
    await canAccessSensitivity('user-1', 'STRENGT_FORTROLIG', 'org-1')

    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
        }),
      })
    )
  })

  it('cross-tenant isolation: bruger med rolle i org-A har INGEN adgang i org-B', async () => {
    const { prisma } = await import('@/lib/db')
    // Bruger har rolle i org-A men vi spørger med org-B — skal returnere []
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    const result = await canAccessModule('user-1', 'settings', 'org-B')

    // Ingen roller → ingen adgang
    expect(result).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────
// Fix 6: canAccessModule fail-closed + persons/documents spec
// ─────────────────────────────────────────────────────────

describe('canAccessModule — fail-closed og spec-konforme module cases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ukendt modul returnerer false (fail-closed)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_OWNER', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    const result = await canAccessModule('user-1', 'unknown_module_xyz', 'org-1')
    expect(result).toBe(false)
  })

  it('GROUP_OWNER kan tilgå documents-modulet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_OWNER', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'documents', 'org-1')).toBe(true)
  })

  it('GROUP_FINANCE kan tilgå documents-modulet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_FINANCE', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'documents', 'org-1')).toBe(true)
  })

  it('GROUP_OWNER kan tilgå persons-modulet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_OWNER', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'persons', 'org-1')).toBe(true)
  })

  it('COMPANY_LEGAL kan tilgå persons-modulet (spec linje 139-156)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'COMPANY_LEGAL', scope: 'ASSIGNED', company_ids: ['c1'] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'persons', 'org-1')).toBe(true)
  })

  it('COMPANY_READONLY kan tilgå documents-modulet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'COMPANY_READONLY', scope: 'OWN', company_ids: ['c1'] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'documents', 'org-1')).toBe(true)
  })

  it('GROUP_OWNER kan tilgå settings-modulet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_OWNER', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'settings', 'org-1')).toBe(true)
  })

  it('GROUP_FINANCE BLOKERES fra settings (spec)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_FINANCE', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'settings', 'org-1')).toBe(false)
  })

  it('GROUP_FINANCE BLOKERES fra billing (spec)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_FINANCE', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'billing', 'org-1')).toBe(false)
  })

  it('ingen roller returnerer false for alle moduler (fail-closed)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    const modules = ['settings', 'documents', 'persons', 'cases', 'contracts', 'finance', 'unknown']
    for (const m of modules) {
      const result = await canAccessModule('user-1', m, 'org-1')
      expect(result, `module '${m}' bør være false for bruger uden roller`).toBe(false)
    }
  })
})
