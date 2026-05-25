/**
 * Zod-valideringstest — verificerer at actions afviser ugyldigt input
 * uden at kalde databasen. Auth mockes til at returnere en gyldig session
 * så vi kan nå valideringslaget.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock alle tunge deps FØR imports af actions
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
    company: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    contract: { findMany: vi.fn().mockResolvedValue([]) },
    task: {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    visit: { findMany: vi.fn().mockResolvedValue([]) },
    case: { findMany: vi.fn().mockResolvedValue([]) },
    document: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    person: { count: vi.fn().mockResolvedValue(0) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    userRoleAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    financialMetric: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue([]),
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
  captureError: vi.fn(),
}))
vi.mock('@/lib/export/gdpr', () => ({ gdprDeletePerson: vi.fn() }))
vi.mock('@/lib/search/constants', () => ({ MIN_SEARCH_LENGTH: 2, RESULTS_PER_TYPE: 10 }))
vi.mock('@/lib/labels', () => ({
  formatDate: (d: Date) => d.toISOString().slice(0, 10),
  getContractTypeLabel: (t: string) => t,
  getVisitTypeLabel: (t: string) => t,
}))
vi.mock('@/lib/dashboard-helpers', () => ({
  buildInlineKpis: vi.fn().mockReturnValue([]),
  buildTimelineSections: vi.fn().mockReturnValue([]),
  deriveHealth: vi.fn().mockReturnValue('green'),
  emptyDashboardData: vi.fn((role: string) => ({
    role,
    badges: {},
    inlineKpis: [],
    timelineSections: [],
    heatmap: [],
    coverage: [],
    portfolioTotals: { totalOmsaetning: 0, totalEbitda: 0, avgEbitdaMargin: 0 },
    underperformingCount: 0,
  })),
  filterLatestPerCompany: vi.fn().mockReturnValue([]),
  pickHighestPriorityRole: vi.fn().mockReturnValue('GROUP_READONLY'),
  sumMetric: vi.fn().mockReturnValue(0),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { auth } from '@/lib/auth'
import { getRecentActivity } from '@/actions/activity-feed'
import { getCalendarEvents } from '@/actions/calendar'
import { getCompanyDetailData } from '@/actions/company-detail'
import { getDashboardData } from '@/actions/dashboard'
import { deleteDocument } from '@/actions/documents'
import { prepareExport } from '@/actions/export'
import { prepareGdprExport, executeGdprDelete } from '@/actions/gdpr'
import { getPersonAIExtractions } from '@/actions/person-ai'
import { runSearch } from '@/actions/search'
import { getTaskDetailData } from '@/actions/task-detail'

const MOCK_SESSION = {
  user: {
    id: 'user-1',
    organizationId: 'org-1',
    email: 'test@example.com',
    name: 'Test',
    role: 'GROUP_OWNER',
  },
  expires: '9999-01-01',
}

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(
    MOCK_SESSION as ReturnType<typeof auth> extends Promise<infer T> ? T : never
  )
})

// ─────────────────────────────────────────────────────────────
// activity-feed — ugyldig since (ikke Date)
// ─────────────────────────────────────────────────────────────
describe('getRecentActivity', () => {
  it('returnerer [] ved ugyldigt preloadedCompanyIds (ikke-UUID strings)', async () => {
    const result = await getRecentActivity(['not-a-uuid'])
    expect(result).toEqual([])
  })

  it('returnerer [] ved ugyldigt since-parameter (non-Date)', async () => {
    // @ts-expect-error — tester runtime med forkert type
    const result = await getRecentActivity(undefined, 'invalid-date')
    expect(result).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
// calendar — ugyldigt år og måned
// ─────────────────────────────────────────────────────────────
describe('getCalendarEvents', () => {
  it('returnerer [] ved år under 2020', async () => {
    const result = await getCalendarEvents(2019, 6)
    expect(result).toEqual([])
  })

  it('returnerer [] ved år over 2100', async () => {
    const result = await getCalendarEvents(2101, 6)
    expect(result).toEqual([])
  })

  it('returnerer [] ved måned 0', async () => {
    const result = await getCalendarEvents(2025, 0)
    expect(result).toEqual([])
  })

  it('returnerer [] ved måned 13', async () => {
    const result = await getCalendarEvents(2025, 13)
    expect(result).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
// company-detail — ugyldigt UUID
// ─────────────────────────────────────────────────────────────
describe('getCompanyDetailData', () => {
  it('returnerer null ved tomt companyId', async () => {
    const result = await getCompanyDetailData('')
    expect(result).toBeNull()
  })

  it('returnerer null ved non-UUID companyId', async () => {
    const result = await getCompanyDetailData('not-a-uuid')
    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// dashboard — ugyldige preloadedCompanyIds
// ─────────────────────────────────────────────────────────────
describe('getDashboardData', () => {
  it('returnerer emptyDashboardData ved ikke-UUID i preloadedCompanyIds', async () => {
    const result = await getDashboardData(['not-a-uuid'])
    // emptyDashboardData mock returnerer object med role-felt
    expect(result).toHaveProperty('role')
  })
})

// ─────────────────────────────────────────────────────────────
// documents — ugyldigt UUID til deleteDocument
// ─────────────────────────────────────────────────────────────
describe('deleteDocument', () => {
  it('returnerer { error: "Ugyldigt input" } ved non-UUID', async () => {
    const result = await deleteDocument('not-a-uuid')
    expect(result).toEqual({ error: 'Ugyldigt input' })
  })

  it('returnerer { error: "Ugyldigt input" } ved tom streng', async () => {
    const result = await deleteDocument('')
    expect(result).toEqual({ error: 'Ugyldigt input' })
  })
})

// ─────────────────────────────────────────────────────────────
// export — ugyldig entity
// ─────────────────────────────────────────────────────────────
describe('prepareExport', () => {
  it('returnerer { error: "Ugyldigt input" } ved ugyldig entity', async () => {
    // @ts-expect-error — tester runtime med forkert type
    const result = await prepareExport({ entity: 'invalid_entity' })
    expect(result).toEqual({ error: 'Ugyldigt input' })
  })
})

// ─────────────────────────────────────────────────────────────
// gdpr — ugyldigt UUID
// ─────────────────────────────────────────────────────────────
describe('prepareGdprExport', () => {
  it('returnerer { error: "Ugyldigt input" } ved non-UUID personId', async () => {
    const result = await prepareGdprExport('not-a-uuid')
    expect(result).toEqual({ error: 'Ugyldigt input' })
  })
})

describe('executeGdprDelete', () => {
  it('returnerer { error: "Ugyldigt input" } ved non-UUID personId', async () => {
    const result = await executeGdprDelete('not-a-uuid')
    expect(result).toEqual({ error: 'Ugyldigt input' })
  })
})

// ─────────────────────────────────────────────────────────────
// person-ai — ugyldigt UUID
// ─────────────────────────────────────────────────────────────
describe('getPersonAIExtractions', () => {
  it('returnerer { error: "Ugyldigt input" } ved non-UUID personId', async () => {
    const result = await getPersonAIExtractions('not-a-uuid')
    expect(result).toEqual({ error: 'Ugyldigt input' })
  })
})

// ─────────────────────────────────────────────────────────────
// search — for lang query
// ─────────────────────────────────────────────────────────────
describe('runSearch', () => {
  it('returnerer null ved query over 200 tegn', async () => {
    const result = await runSearch('a'.repeat(201))
    expect(result).toBeNull()
  })

  it('returnerer null ved tom query', async () => {
    const result = await runSearch('')
    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// task-detail — ugyldigt UUID
// ─────────────────────────────────────────────────────────────
describe('getTaskDetailData', () => {
  it('returnerer null ved non-UUID taskId', async () => {
    const result = await getTaskDetailData('not-a-uuid')
    expect(result).toBeNull()
  })

  it('returnerer null ved tom streng', async () => {
    const result = await getTaskDetailData('')
    expect(result).toBeNull()
  })
})
