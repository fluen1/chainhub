import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    company: { findMany: vi.fn().mockResolvedValue([]) },
    contract: { findMany: vi.fn().mockResolvedValue([]) },
    case: { findMany: vi.fn().mockResolvedValue([]) },
    task: { findMany: vi.fn().mockResolvedValue([]) },
    person: { findMany: vi.fn().mockResolvedValue([]) },
    visit: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import {
  fetchCompaniesForExport,
  fetchContractsForExport,
  fetchCasesForExport,
  fetchTasksForExport,
  fetchPersonsForExport,
  fetchVisitsForExport,
  fetchEntityForExport,
  type ExportScope,
} from '@/lib/export/entities'

const scope: ExportScope = { organizationId: 'org-1' }

describe('fetchCompaniesForExport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer filename + columns + rows', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.company.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 'c-1',
          name: 'Acme',
          cvr: '12345678',
          address: null,
          city: null,
          postal_code: null,
          founded_date: null,
          created_at: new Date('2026-01-01'),
        },
      ])) as never)
    const result = await fetchCompaniesForExport(scope)
    expect(result.filename).toMatch(/^chainhub-selskaber-\d{4}-\d{2}-\d{2}$/)
    expect(result.rows).toHaveLength(1)
    expect(result.columns.find((c) => c.header === 'Navn')).toBeDefined()
    expect(result.columns.find((c) => c.header === 'CVR')).toBeDefined()
  })

  it('filtrerer via visibleCompanyIds', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchCompaniesForExport({ organizationId: 'org-1', visibleCompanyIds: ['c-1', 'c-2'] })
    const call = vi.mocked(prisma.company.findMany).mock.calls[0]
    expect(call?.[0]?.where).toMatchObject({ id: { in: ['c-1', 'c-2'] } })
  })

  it('ingen visibleCompanyIds → ingen id-filter', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchCompaniesForExport(scope)
    const call = vi.mocked(prisma.company.findMany).mock.calls[0]
    const where = call?.[0]?.where as Record<string, unknown> | undefined
    expect(where).toMatchObject({ organization_id: 'org-1', deleted_at: null })
    expect(where).not.toHaveProperty('id')
  })

  it('formatter Date via formatDate', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.company.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 'c-1',
          name: 'Acme',
          cvr: null,
          address: null,
          city: null,
          postal_code: null,
          founded_date: new Date('2026-01-15'),
          created_at: new Date('2026-01-15'),
        },
      ])) as never)
    const result = await fetchCompaniesForExport(scope)
    const foundedCol = result.columns.find((c) => c.header === 'Stiftet')!
    const formatted = foundedCol.format!(result.rows[0]!.founded_date, result.rows[0]!)
    expect(formatted).toBeTruthy()
    expect(formatted).not.toBe('')
  })
})

describe('fetchContractsForExport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inkluderer company name via join-formatter', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 'k-1',
          display_name: 'Lejekontrakt',
          system_type: 'LEJEKONTRAKT_ERHVERV',
          status: 'AKTIV',
          sensitivity: 'INTERN',
          company: { name: 'Acme' },
          effective_date: null,
          expiry_date: null,
          notice_period_days: null,
          created_at: new Date(),
        },
      ])) as never)
    const result = await fetchContractsForExport(scope)
    expect(result.rows).toHaveLength(1)
    const companyCol = result.columns.find((c) => c.header === 'Selskab')!
    const row = result.rows[0]!
    expect(companyCol.format!(row.company, row)).toBe('Acme')
  })

  it('filtrerer contracts via visibleCompanyIds (company_id)', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchContractsForExport({ organizationId: 'org-1', visibleCompanyIds: ['c-1'] })
    const call = vi.mocked(prisma.contract.findMany).mock.calls[0]
    expect(call?.[0]?.where).toMatchObject({ company_id: { in: ['c-1'] } })
  })
})

describe('fetchCasesForExport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flatterer case_companies til company_names-streng', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 's-1',
          case_number: 'S-001',
          title: 'Husleje-tvist',
          case_type: 'TVIST',
          case_subtype: null,
          status: 'AABEN',
          sensitivity: 'INTERN',
          due_date: null,
          closed_at: null,
          created_at: new Date(),
          case_companies: [{ company: { name: 'Acme' } }, { company: { name: 'Foo ApS' } }],
        },
      ])) as never)
    const result = await fetchCasesForExport(scope)
    expect(result.rows[0]!.company_names).toBe('Acme; Foo ApS')
    expect(result.columns.find((c) => c.header === 'Selskaber')).toBeDefined()
  })
})

describe('fetchTasksForExport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('joinerser company-navne manuelt via company_id-lookup', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 't-1',
          title: 'Gennemgå lejekontrakt',
          status: 'I_GANG',
          priority: 'HOEJ',
          company_id: 'c-1',
          due_date: new Date('2026-05-01'),
          completed_at: null,
          created_at: new Date(),
          assignee: { name: 'Maria', email: 'maria@chainhub.dk' },
        },
      ])) as never)
    vi.mocked(prisma.company.findMany).mockImplementation((() =>
      Promise.resolve([{ id: 'c-1', name: 'Acme' }])) as never)

    const result = await fetchTasksForExport(scope)
    expect(result.rows[0]!.company_name).toBe('Acme')
    const assigneeCol = result.columns.find((c) => c.header === 'Tildelt')!
    expect(assigneeCol.format!(result.rows[0]!.assignee, result.rows[0]!)).toBe('Maria')
  })

  it('tasks uden company_id → tom company_name + intet secondary lookup', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 't-2',
          title: 'Generisk opgave',
          status: 'NY',
          priority: 'MELLEM',
          company_id: null,
          due_date: null,
          completed_at: null,
          created_at: new Date(),
          assignee: null,
        },
      ])) as never)

    const result = await fetchTasksForExport(scope)
    expect(result.rows[0]!.company_name).toBe('')
    expect(vi.mocked(prisma.company.findMany)).not.toHaveBeenCalled()
  })
})

describe('fetchPersonsForExport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer personer sorteret + korrekt filnavn', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 'p-1',
          first_name: 'Maria',
          last_name: 'Jensen',
          email: 'maria@x.dk',
          phone: null,
          created_at: new Date(),
        },
      ])) as never)
    const result = await fetchPersonsForExport(scope)
    expect(result.filename).toMatch(/^chainhub-personer-\d{4}-\d{2}-\d{2}$/)
    expect(result.rows).toHaveLength(1)
    const call = vi.mocked(prisma.person.findMany).mock.calls[0]
    expect(call?.[0]?.orderBy).toEqual([{ last_name: 'asc' }, { first_name: 'asc' }])
  })
})

describe('fetchVisitsForExport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inkluderer visitor + company som join', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.visit.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 'v-1',
          company: { name: 'Acme' },
          visit_type: 'SITE_VISIT',
          status: 'UDFOERT',
          visit_date: new Date('2026-04-01'),
          visitor: { name: 'Philip' },
          created_at: new Date(),
        },
      ])) as never)
    const result = await fetchVisitsForExport(scope)
    const visitorCol = result.columns.find((c) => c.header === 'Besøgende')!
    const row = result.rows[0]!
    expect(visitorCol.format!(row.visitor, row)).toBe('Philip')
    const companyCol = result.columns.find((c) => c.header === 'Selskab')!
    expect(companyCol.format!(row.company, row)).toBe('Acme')
  })
})

describe('fetchEntityForExport dispatcher', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatcher → persons kalder prisma.person.findMany', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchEntityForExport('persons', scope)
    expect(prisma.person.findMany).toHaveBeenCalled()
  })

  it('dispatcher → companies kalder prisma.company.findMany', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchEntityForExport('companies', scope)
    expect(prisma.company.findMany).toHaveBeenCalled()
  })

  it('dispatcher → contracts kalder prisma.contract.findMany', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchEntityForExport('contracts', scope)
    expect(prisma.contract.findMany).toHaveBeenCalled()
  })

  it('dispatcher → cases kalder prisma.case.findMany', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchEntityForExport('cases', scope)
    expect(prisma.case.findMany).toHaveBeenCalled()
  })

  it('dispatcher → tasks kalder prisma.task.findMany', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchEntityForExport('tasks', scope)
    expect(prisma.task.findMany).toHaveBeenCalled()
  })

  it('dispatcher → visits kalder prisma.visit.findMany', async () => {
    const { prisma } = await import('@/lib/db')
    await fetchEntityForExport('visits', scope)
    expect(prisma.visit.findMany).toHaveBeenCalled()
  })
})
