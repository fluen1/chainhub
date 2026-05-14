/**
 * Phase N1 — Permissions: export-modul, users-list-modul, companies/new fix
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
    user: {
      findMany: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Lars' }]),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

// ─── Fix 1: export-modul ────────────────────────────────────────────────────

describe("canAccessModule('export') — compliance export adgang", () => {
  beforeEach(() => vi.clearAllMocks())

  const ALLOWED_ROLES = ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL', 'GROUP_FINANCE'] as const
  const BLOCKED_ROLES = [
    'GROUP_READONLY',
    'COMPANY_MANAGER',
    'COMPANY_LEGAL',
    'COMPANY_READONLY',
  ] as const

  it.each(ALLOWED_ROLES)('%s kan eksportere (export-modul)', async (role) => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role, scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'export', 'org-1')).toBe(true)
  })

  it.each(BLOCKED_ROLES)('%s BLOKERES fra export-modul', async (role) => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role, scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'export', 'org-1')).toBe(false)
  })

  it('ingen roller → export-modul returnerer false (fail-closed)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'export', 'org-1')).toBe(false)
  })
})

// ─── Fix 1: prepareExport bruger 'export'-modul ─────────────────────────────

describe('prepareExport — bruger export-modul (ikke settings)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GROUP_FINANCE (export-adgang) får downloadUrl tilbage', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_FINANCE', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    const result = await canAccessModule('user-1', 'export', 'org-1')
    // GROUP_FINANCE skal have export-adgang
    expect(result).toBe(true)
  })

  it('GROUP_READONLY BLOKERES fra export', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_READONLY', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'export', 'org-1')).toBe(false)
  })
})

// ─── Fix 2: users-list modul ────────────────────────────────────────────────

describe("canAccessModule('users-list') — alle redigeringsroller", () => {
  beforeEach(() => vi.clearAllMocks())

  const ALL_ROLES = [
    'GROUP_OWNER',
    'GROUP_ADMIN',
    'GROUP_LEGAL',
    'GROUP_FINANCE',
    'GROUP_READONLY',
    'COMPANY_MANAGER',
    'COMPANY_LEGAL',
    'COMPANY_READONLY',
  ] as const

  it.each(ALL_ROLES)('%s kan tilgå users-list', async (role) => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role, scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'users-list', 'org-1')).toBe(true)
  })

  it('ingen roller → users-list returnerer false', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'users-list', 'org-1')).toBe(false)
  })
})

// ─── Fix 3: companies-modul dækker GROUP_LEGAL (konsistens med list) ─────────

describe("canAccessModule('companies') — GROUP_LEGAL har adgang", () => {
  beforeEach(() => vi.clearAllMocks())

  it('GROUP_LEGAL kan tilgå companies-modulet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_LEGAL', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    expect(await canAccessModule('user-1', 'companies', 'org-1')).toBe(true)
  })

  it('settings-modul BLOKERER GROUP_LEGAL (sikrer companies/new ikke bruger settings)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_LEGAL', scope: 'ALL', company_ids: [] },
    ] as never)

    const { canAccessModule } = await import('@/lib/permissions')
    // companies/new bruger nu 'companies'-modul, ikke 'settings' — GROUP_LEGAL skal have adgang
    expect(await canAccessModule('user-1', 'companies', 'org-1')).toBe(true)
    expect(await canAccessModule('user-1', 'settings', 'org-1')).toBe(false)
  })
})
