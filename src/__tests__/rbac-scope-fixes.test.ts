/**
 * Phase A audit-fixes — RBAC scope-tests for commit 1
 * Verificerer at tasks/cases/activity/søgning er korrekt company-scopet
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────
// FÆLLES MOCKS
// ─────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    contract: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    case: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    visit: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    document: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    person: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    financialMetric: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    userRoleAssignment: {
      findMany: vi.fn().mockResolvedValue([{ role: 'GROUP_READONLY' }]),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['company-1', 'company-2']),
  canAccessSensitivity: vi.fn().mockResolvedValue(false),
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// react.cache er RSC-only — brug noop i test-miljø
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: (fn: unknown) => fn }
})

// ─────────────────────────────────────────────────────────
// Fix 1: dashboard.ts — overdue/upcoming tasks company-scope
// ─────────────────────────────────────────────────────────

describe('dashboard.ts — task queries er company-scopet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('overdue tasks query inkluderer OR company_id scope', async () => {
    const { getDashboardData } = await import('@/actions/dashboard')
    const { prisma } = await import('@/lib/db')
    await getDashboardData('user-1', 'org-1')

    const taskFindManyCalls = vi.mocked(prisma.task.findMany).mock.calls
    // Første findMany er overdue tasks
    const overdueTasks = taskFindManyCalls[0]?.[0]
    expect(overdueTasks?.where).toHaveProperty('OR')
    const orClause = overdueTasks?.where?.OR as Array<Record<string, unknown>>
    const hasCompanyIn = orClause.some(
      (clause) =>
        typeof clause.company_id === 'object' &&
        clause.company_id !== null &&
        'in' in (clause.company_id as object)
    )
    const hasCompanyNull = orClause.some((clause) => clause.company_id === null)
    expect(hasCompanyIn).toBe(true)
    expect(hasCompanyNull).toBe(true)
  })

  it('upcoming tasks query inkluderer OR company_id scope', async () => {
    const { getDashboardData } = await import('@/actions/dashboard')
    const { prisma } = await import('@/lib/db')
    await getDashboardData('user-1', 'org-1')

    const taskFindManyCalls = vi.mocked(prisma.task.findMany).mock.calls
    // Anden findMany er upcoming tasks
    const upcomingTasks = taskFindManyCalls[1]?.[0]
    expect(upcomingTasks?.where).toHaveProperty('OR')
    const orClause = upcomingTasks?.where?.OR as Array<Record<string, unknown>>
    const hasCompanyNull = orClause.some((c) => c.company_id === null)
    expect(hasCompanyNull).toBe(true)
  })

  it('overdueTasksCount badge query inkluderer OR company_id scope', async () => {
    const { getDashboardData } = await import('@/actions/dashboard')
    const { prisma } = await import('@/lib/db')
    await getDashboardData('user-1', 'org-1')

    const countCalls = vi.mocked(prisma.task.count).mock.calls
    // count-kaldet for overdue badge
    const overdueBadgeCount = countCalls.find((call) => call[0]?.where?.due_date !== undefined)
    expect(overdueBadgeCount).toBeDefined()
    expect(overdueBadgeCount?.[0]?.where).toHaveProperty('OR')
  })

  it('GROUP_READONLY med 0 accessible companies giver tom dashboard', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.getAccessibleCompanies).mockResolvedValueOnce([])
    const { getDashboardData } = await import('@/actions/dashboard')
    const data = await getDashboardData('readonly-user', 'org-1')
    expect(data.heatmap).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────
// Fix 2: sidebar-data.ts — cases/tasks company-scope
// ─────────────────────────────────────────────────────────

describe('sidebar-data.ts — cases og tasks er company-scopet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('casesCount query inkluderer case_companies filter', async () => {
    const { getSidebarData } = await import('@/lib/sidebar-data')
    const { prisma } = await import('@/lib/db')
    await getSidebarData('user-1', 'org-1')

    const caseCounts = vi.mocked(prisma.case.count).mock.calls
    expect(caseCounts.length).toBeGreaterThan(0)
    const caseCountWhere = caseCounts[0]?.[0]?.where
    expect(caseCountWhere).toHaveProperty('case_companies')
    expect(caseCountWhere?.case_companies).toHaveProperty('some')
  })

  it('tasksCount query inkluderer OR company_id scope', async () => {
    const { getSidebarData } = await import('@/lib/sidebar-data')
    const { prisma } = await import('@/lib/db')
    await getSidebarData('user-1', 'org-1')

    const taskCounts = vi.mocked(prisma.task.count).mock.calls
    // Begge task count-kald (total + overdue) skal have OR scope
    taskCounts.forEach((call) => {
      expect(call[0]?.where).toHaveProperty('OR')
    })
  })

  it('overdueTasksCount query inkluderer OR company_id scope', async () => {
    const { getSidebarData } = await import('@/lib/sidebar-data')
    const { prisma } = await import('@/lib/db')
    await getSidebarData('user-1', 'org-1')

    const taskCounts = vi.mocked(prisma.task.count).mock.calls
    const overdueCount = taskCounts.find((call) => call[0]?.where?.due_date !== undefined)
    expect(overdueCount).toBeDefined()
    const orClause = overdueCount?.[0]?.where?.OR as Array<Record<string, unknown>>
    const hasNull = orClause.some((c) => c.company_id === null)
    expect(hasNull).toBe(true)
  })

  it('GROUP_READONLY med 0 selskaber returnerer 0 counts', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.getAccessibleCompanies).mockResolvedValueOnce([])
    const { getSidebarData } = await import('@/lib/sidebar-data')
    const data = await getSidebarData('readonly-user', 'org-1')
    expect(data.companiesCount).toBe(0)
    expect(data.contractsCount).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────
// Fix 3: activity-feed.ts — RBAC scope på audit-events
// ─────────────────────────────────────────────────────────

describe('activity-feed.ts — audit events er company-scopet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getRecentActivity kræver userId parameter (+ optional preloadedCompanyIds)', async () => {
    const { getRecentActivity } = await import('@/actions/activity-feed')
    // Funktionen eksisterer med mindst 2 påkrævede parametre (userId tilføjet i Phase A)
    // preloadedCompanyIds er optional (Phase L), så length >= 2
    expect(typeof getRecentActivity).toBe('function')
    expect(getRecentActivity.length).toBeGreaterThanOrEqual(2)
  })

  it('audit query inkluderer OR resource_company_id scope', async () => {
    const { getRecentActivity } = await import('@/actions/activity-feed')
    const { prisma } = await import('@/lib/db')
    await getRecentActivity('org-1', 'user-1')

    const auditCalls = vi.mocked(prisma.auditLog.findMany).mock.calls
    expect(auditCalls.length).toBeGreaterThan(0)
    const where = auditCalls[0]?.[0]?.where
    expect(where).toHaveProperty('OR')
    const orClause = where?.OR as Array<Record<string, unknown>>
    // Skal indeholde resource_company_id: null (org-brede events)
    const hasNullScope = orClause.some((c) => c.resource_company_id === null)
    expect(hasNullScope).toBe(true)
  })

  it('bruger med 0 accessible companies ser kun org-brede events', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.getAccessibleCompanies).mockResolvedValueOnce([])
    const { getRecentActivity } = await import('@/actions/activity-feed')
    const { prisma } = await import('@/lib/db')
    await getRecentActivity('org-1', 'restricted-user')

    const auditCalls = vi.mocked(prisma.auditLog.findMany).mock.calls
    const where = auditCalls[0]?.[0]?.where
    expect(where).toHaveProperty('OR')
  })

  it('returnerer [] når der ikke er logs', async () => {
    const { getRecentActivity } = await import('@/actions/activity-feed')
    const result = await getRecentActivity('org-1', 'user-1')
    expect(result).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────
// Fix 4: search.ts — sensitivity + persons company-scope
// ─────────────────────────────────────────────────────────

describe('search.ts — sensitivity og persons er korrekt scopet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GROUP_FINANCE (ingen STRENGT_FORTROLIG) får notIn filter med STRENGT_FORTROLIG', async () => {
    const perms = await import('@/lib/permissions')
    // canSeeFortrolig = true, canSeeStrengtFortrolig = false
    vi.mocked(perms.canAccessSensitivity).mockImplementation(async (_userId, level) => {
      if (level === 'STRENGT_FORTROLIG') return false
      if (level === 'FORTROLIG') return true
      return true
    })

    const { runSearch } = await import('@/actions/search')
    const { prisma } = await import('@/lib/db')
    await runSearch('test', 'finance-user', 'org-1')

    const contractCalls = vi.mocked(prisma.contract.findMany).mock.calls
    const where = contractCalls[0]?.[0]?.where
    // Tjek via JSON for at undgå Prisma type-kompleksitet i tests
    const sensitivityFilter = where?.sensitivity as { notIn: string[] } | undefined
    expect(sensitivityFilter?.notIn).toEqual(['STRENGT_FORTROLIG'])
  })

  it('COMPANY_LEGAL (ingen FORTROLIG) får notIn med begge niveauer', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValue(false)

    const { runSearch } = await import('@/actions/search')
    const { prisma } = await import('@/lib/db')
    await runSearch('test', 'legal-user', 'org-1')

    const contractCalls = vi.mocked(prisma.contract.findMany).mock.calls
    const where = contractCalls[0]?.[0]?.where
    const sensitivityFilter = where?.sensitivity as { notIn: string[] } | undefined
    expect(sensitivityFilter?.notIn).toContain('FORTROLIG')
    expect(sensitivityFilter?.notIn).toContain('STRENGT_FORTROLIG')
  })

  it('GROUP_OWNER (fuld adgang) får ingen sensitivity filter', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValue(true)

    const { runSearch } = await import('@/actions/search')
    const { prisma } = await import('@/lib/db')
    await runSearch('test', 'owner-user', 'org-1')

    const contractCalls = vi.mocked(prisma.contract.findMany).mock.calls
    const where = contractCalls[0]?.[0]?.where
    expect(where?.sensitivity).toBeUndefined()
  })

  it('person søgning inkluderer company_persons scope filter', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValue(true)

    const { runSearch } = await import('@/actions/search')
    const { prisma } = await import('@/lib/db')
    await runSearch('test', 'user-1', 'org-1')

    const personCalls = vi.mocked(prisma.person.findMany).mock.calls
    expect(personCalls.length).toBeGreaterThan(0)
    const where = personCalls[0]?.[0]?.where
    // AND-filter skal indeholde company_persons scope
    const andClause = where?.AND as Array<Record<string, unknown>> | undefined
    expect(andClause).toBeDefined()
    const scopeClause = andClause?.[0]?.OR as Array<Record<string, unknown>> | undefined
    expect(scopeClause).toBeDefined()
    const hasSomeFilter = scopeClause?.some(
      (c) => (c.company_persons as Record<string, unknown>)?.some !== undefined
    )
    expect(hasSomeFilter).toBe(true)
  })

  it('person søgning inkluderer fallback for personer uden selskabstilknytning', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValue(true)

    const { runSearch } = await import('@/actions/search')
    const { prisma } = await import('@/lib/db')
    await runSearch('test', 'user-1', 'org-1')

    const personCalls = vi.mocked(prisma.person.findMany).mock.calls
    const where = personCalls[0]?.[0]?.where
    const andClause = where?.AND as Array<Record<string, unknown>> | undefined
    const scopeClause = andClause?.[0]?.OR as Array<Record<string, unknown>> | undefined
    const hasNoneFilter = scopeClause?.some(
      (c) => (c.company_persons as Record<string, unknown>)?.none !== undefined
    )
    expect(hasNoneFilter).toBe(true)
  })

  it('returnerer null for kort query', async () => {
    const { runSearch } = await import('@/actions/search')
    const result = await runSearch('a', 'user-1', 'org-1')
    expect(result).toBeNull()
  })
})
