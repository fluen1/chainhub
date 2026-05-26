import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock, logMock } = vi.hoisted(() => {
  const prismaMock = {
    alert: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    contract: {
      findMany: vi.fn(),
    },
    company: {
      findMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
    },
  }
  const logMock = {
    info: vi.fn(),
    error: vi.fn(),
  }
  return { prismaMock, logMock }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/ai/logger', () => ({
  createLogger: vi.fn(() => logMock),
}))

import { runPortfolioScan } from '@/lib/ai/jobs/portfolio-scan'

const ORG_ID = 'org-test-1'

function makeDate(daysFromNow: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runPortfolioScan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.alert.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.alert.createMany.mockResolvedValue({ count: 0 })
    prismaMock.contract.findMany.mockResolvedValue([])
    prismaMock.company.findMany.mockResolvedValue([])
    prismaMock.task.findMany.mockResolvedValue([])
  })

  it('returnerer ScanResult med inserted og deleted', async () => {
    const result = await runPortfolioScan(ORG_ID)
    expect(result).toMatchObject({ organizationId: ORG_ID, inserted: 0, deleted: 0 })
  })

  it('sletter stale alerts over 24 timer', async () => {
    prismaMock.alert.deleteMany.mockResolvedValue({ count: 3 })
    const result = await runPortfolioScan(ORG_ID)
    expect(prismaMock.alert.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG_ID,
          dismissed_at: null,
        }),
      })
    )
    expect(result.deleted).toBe(3)
  })

  // ── Deadline-detektering ────────────────────────────────────────────────────

  describe('DEADLINE-alerts', () => {
    it('genererer CRITICAL alert for kontrakt udløbende ≤7 dage', async () => {
      prismaMock.contract.findMany.mockResolvedValue([
        {
          id: 'c1',
          display_name: 'Ejeraftale Test ApS',
          expiry_date: makeDate(3),
          company: { name: 'Test ApS' },
        },
      ])

      const result = await runPortfolioScan(ORG_ID)

      expect(result.inserted).toBe(1)
      const call = prismaMock.alert.createMany.mock.calls[0]?.[0]
      const data = call?.data as Array<{ severity: string; category: string }>
      expect(data[0]).toMatchObject({ severity: 'CRITICAL', category: 'DEADLINE' })
    })

    it('genererer WARNING alert for kontrakt udløbende >7 og ≤30 dage', async () => {
      prismaMock.contract.findMany.mockResolvedValue([
        {
          id: 'c2',
          display_name: 'Lejekontrakt',
          expiry_date: makeDate(20),
          company: { name: 'Test ApS' },
        },
      ])

      const result = await runPortfolioScan(ORG_ID)

      expect(result.inserted).toBe(1)
      const call = prismaMock.alert.createMany.mock.calls[0]?.[0]
      const data = call?.data as Array<{ severity: string }>
      expect(data[0]).toMatchObject({ severity: 'WARNING' })
    })

    it('springer kontrakter uden expiry_date over', async () => {
      prismaMock.contract.findMany.mockResolvedValue([
        {
          id: 'c3',
          display_name: 'Ingen udløb',
          expiry_date: null,
          company: { name: 'Test ApS' },
        },
      ])

      const result = await runPortfolioScan(ORG_ID)
      expect(result.inserted).toBe(0)
    })
  })

  // ── Manglende dokumenter ────────────────────────────────────────────────────

  describe('MISSING-alerts', () => {
    it('genererer INFO alert for selskab uden ejeraftale', async () => {
      prismaMock.company.findMany.mockResolvedValue([
        {
          id: 'comp-1',
          name: 'Selskab Uden Ejeraftale ApS',
          contracts: [{ system_type: 'VEDTAEGTER' }],
        },
      ])

      const result = await runPortfolioScan(ORG_ID)

      expect(result.inserted).toBe(1)
      const call = prismaMock.alert.createMany.mock.calls[0]?.[0]
      const data = call?.data as Array<{ severity: string; category: string; details: unknown }>
      expect(data[0]).toMatchObject({
        severity: 'INFO',
        category: 'MISSING',
        details: { missingDocType: 'EJERAFTALE' },
      })
    })

    it('genererer INFO alert for selskab uden vedtægter', async () => {
      prismaMock.company.findMany.mockResolvedValue([
        {
          id: 'comp-2',
          name: 'Selskab Uden Vedtægter ApS',
          contracts: [{ system_type: 'EJERAFTALE' }],
        },
      ])

      const result = await runPortfolioScan(ORG_ID)

      expect(result.inserted).toBe(1)
      const call = prismaMock.alert.createMany.mock.calls[0]?.[0]
      const data = call?.data as Array<{ details: unknown }>
      expect(data[0]).toMatchObject({ details: { missingDocType: 'VEDTAEGTER' } })
    })

    it('genererer 2 alerts for selskab der mangler begge dokumenter', async () => {
      prismaMock.company.findMany.mockResolvedValue([
        {
          id: 'comp-3',
          name: 'Tomt Selskab ApS',
          contracts: [],
        },
      ])

      const result = await runPortfolioScan(ORG_ID)
      expect(result.inserted).toBe(2)
    })

    it('ingen alerts for selskab med begge dokumenter', async () => {
      prismaMock.company.findMany.mockResolvedValue([
        {
          id: 'comp-4',
          name: 'Komplet ApS',
          contracts: [{ system_type: 'EJERAFTALE' }, { system_type: 'VEDTAEGTER' }],
        },
      ])

      const result = await runPortfolioScan(ORG_ID)
      expect(result.inserted).toBe(0)
    })
  })

  // ── Forfaldne opgaver ───────────────────────────────────────────────────────

  describe('COMPLIANCE-alerts for overdue tasks', () => {
    it('genererer CRITICAL alert for opgave forfaldne >14 dage', async () => {
      prismaMock.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Gammel opgave',
          due_date: makeDate(-20),
        },
      ])

      const result = await runPortfolioScan(ORG_ID)

      expect(result.inserted).toBe(1)
      const call = prismaMock.alert.createMany.mock.calls[0]?.[0]
      const data = call?.data as Array<{ severity: string; category: string }>
      expect(data[0]).toMatchObject({ severity: 'CRITICAL', category: 'COMPLIANCE' })
    })

    it('genererer WARNING alert for opgave forfaldne ≤14 dage', async () => {
      prismaMock.task.findMany.mockResolvedValue([
        {
          id: 'task-2',
          title: 'Ny forfalden opgave',
          due_date: makeDate(-5),
        },
      ])

      const result = await runPortfolioScan(ORG_ID)

      expect(result.inserted).toBe(1)
      const call = prismaMock.alert.createMany.mock.calls[0]?.[0]
      const data = call?.data as Array<{ severity: string }>
      expect(data[0]).toMatchObject({ severity: 'WARNING' })
    })

    it('springer opgaver uden due_date over', async () => {
      prismaMock.task.findMany.mockResolvedValue([
        {
          id: 'task-3',
          title: 'Ingen frist',
          due_date: null,
        },
      ])

      const result = await runPortfolioScan(ORG_ID)
      expect(result.inserted).toBe(0)
    })
  })

  it('kalder ikke createMany hvis ingen alerts', async () => {
    await runPortfolioScan(ORG_ID)
    expect(prismaMock.alert.createMany).not.toHaveBeenCalled()
  })
})
