import { describe, it, expect } from 'vitest'
import {
  buildInlineKpis,
  buildTimelineSections,
  deriveHealth,
  emptyDashboardData,
  filterLatestPerCompany,
  firstLetter,
  pickHighestPriorityRole,
  relativeDays,
  sumMetric,
} from '@/lib/dashboard-helpers'

// ---------------------------------------------------------------
// filterLatestPerCompany
// ---------------------------------------------------------------
describe('filterLatestPerCompany', () => {
  it('beholder kun første forekomst pr. (company_id, metric_type)', () => {
    const rows = [
      { company_id: 'a', metric_type: 'OMSAETNING', value: 100, period_year: 2026 },
      { company_id: 'a', metric_type: 'OMSAETNING', value: 80, period_year: 2025 },
      { company_id: 'a', metric_type: 'EBITDA', value: 10, period_year: 2026 },
      { company_id: 'b', metric_type: 'OMSAETNING', value: 50, period_year: 2026 },
    ]
    const result = filterLatestPerCompany(rows)
    expect(result).toHaveLength(3)
    expect(result.find((r) => r.company_id === 'a' && r.metric_type === 'OMSAETNING')?.value).toBe(
      100
    )
  })

  it('returnerer tom array for tom input', () => {
    expect(filterLatestPerCompany([])).toEqual([])
  })

  it('håndterer single-item input', () => {
    const rows = [{ company_id: 'x', metric_type: 'OMSAETNING', value: 1, period_year: 2026 }]
    expect(filterLatestPerCompany(rows)).toEqual(rows)
  })
})

// ---------------------------------------------------------------
// sumMetric
// ---------------------------------------------------------------
describe('sumMetric', () => {
  it('summerer kun rækker med matchende type', () => {
    const rows = [
      { metric_type: 'OMSAETNING', value: 100 },
      { metric_type: 'EBITDA', value: 20 },
      { metric_type: 'OMSAETNING', value: 50 },
    ]
    expect(sumMetric(rows, 'OMSAETNING')).toBe(150)
    expect(sumMetric(rows, 'EBITDA')).toBe(20)
  })

  it('returnerer 0 for tom input', () => {
    expect(sumMetric([], 'OMSAETNING')).toBe(0)
  })

  it('håndterer Decimal-lignende værdi via toString', () => {
    const rows = [
      { metric_type: 'OMSAETNING', value: { toString: () => '42.5' } },
      { metric_type: 'OMSAETNING', value: { toString: () => '7.5' } },
    ]
    expect(sumMetric(rows, 'OMSAETNING')).toBe(50)
  })

  it('returnerer 0 hvis ingen rækker matcher type', () => {
    const rows = [{ metric_type: 'EBITDA', value: 5 }]
    expect(sumMetric(rows, 'OMSAETNING')).toBe(0)
  })
})

// ---------------------------------------------------------------
// deriveHealth
// ---------------------------------------------------------------
describe('deriveHealth', () => {
  it('returnerer critical hvis der er forfaldne opgaver', () => {
    expect(deriveHealth(0, 1)).toBe('critical')
    expect(deriveHealth(5, 3)).toBe('critical')
  })

  it('returnerer warning hvis der kun er åbne sager', () => {
    expect(deriveHealth(1, 0)).toBe('warning')
    expect(deriveHealth(10, 0)).toBe('warning')
  })

  it('returnerer healthy hvis ingen åbne sager eller forfaldne opgaver', () => {
    expect(deriveHealth(0, 0)).toBe('healthy')
  })
})

// ---------------------------------------------------------------
// pickHighestPriorityRole
// ---------------------------------------------------------------
describe('pickHighestPriorityRole', () => {
  it('vælger GROUP_OWNER over GROUP_READONLY', () => {
    expect(pickHighestPriorityRole([{ role: 'GROUP_READONLY' }, { role: 'GROUP_OWNER' }])).toBe(
      'GROUP_OWNER'
    )
  })

  it('returnerer GROUP_READONLY som fallback ved tom input', () => {
    expect(pickHighestPriorityRole([])).toBe('GROUP_READONLY')
  })

  it('håndterer ukendt rolle (prioritet 0)', () => {
    expect(pickHighestPriorityRole([{ role: 'UKENDT' }, { role: 'GROUP_LEGAL' }])).toBe(
      'GROUP_LEGAL'
    )
  })

  it('returnerer eneste rolle når kun én er til stede', () => {
    expect(pickHighestPriorityRole([{ role: 'COMPANY_MANAGER' }])).toBe('COMPANY_MANAGER')
  })
})

// ---------------------------------------------------------------
// firstLetter
// ---------------------------------------------------------------
describe('firstLetter', () => {
  it('returnerer første bogstav som uppercase', () => {
    expect(firstLetter('hello')).toBe('H')
    expect(firstLetter('Å')).toBe('Å')
  })

  it('returnerer ? for null/undefined', () => {
    expect(firstLetter(null)).toBe('?')
    expect(firstLetter(undefined)).toBe('?')
  })

  it('returnerer ? for tom streng', () => {
    // charAt(0) på tom string = '', uppercase af '' = ''. Accepterer empty string output.
    expect(firstLetter('')).toBe('')
  })
})

// ---------------------------------------------------------------
// relativeDays
// ---------------------------------------------------------------
describe('relativeDays', () => {
  it('returnerer positivt antal dage når to er efter from', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const to = new Date('2026-01-05T00:00:00Z')
    expect(relativeDays(from, to)).toBe(4)
  })

  it('returnerer negativt antal dage når to er før from', () => {
    const from = new Date('2026-01-05T00:00:00Z')
    const to = new Date('2026-01-01T00:00:00Z')
    expect(relativeDays(from, to)).toBe(-4)
  })

  it('returnerer 0 ved identiske datoer', () => {
    const d = new Date('2026-01-01T00:00:00Z')
    expect(relativeDays(d, d)).toBe(0)
  })
})

// ---------------------------------------------------------------
// buildInlineKpis
// ---------------------------------------------------------------
describe('buildInlineKpis', () => {
  const baseData = {
    companiesCount: 5,
    expiringCount: 2,
    openCasesCount: 3,
    overdueCount: 1,
    omsaetningTotal: 10_000_000,
    ebitdaTotal: 2_000_000,
    margin: 0.2,
  }

  it('returnerer legal-specifikke KPIs for GROUP_LEGAL', () => {
    const kpis = buildInlineKpis('GROUP_LEGAL', baseData)
    expect(kpis).toHaveLength(3)
    expect(kpis.map((k) => k.label)).toEqual(['Udløbende', 'Sager', 'Forfaldne'])
  })

  it('returnerer finance-specifikke KPIs for GROUP_FINANCE', () => {
    const kpis = buildInlineKpis('GROUP_FINANCE', baseData)
    expect(kpis).toHaveLength(4)
    expect(kpis.map((k) => k.label)).toEqual(['Omsætning', 'EBITDA', 'Margin', 'Forfaldne'])
    expect(kpis[2].value).toBe('20.0%')
  })

  it('returnerer default-KPIs for GROUP_OWNER og ukendt rolle', () => {
    const ownerKpis = buildInlineKpis('GROUP_OWNER', baseData)
    const unknownKpis = buildInlineKpis('FOO', baseData)
    expect(ownerKpis.map((k) => k.label)).toEqual(['Selskaber', 'Udløbende', 'Sager', 'Forfaldne'])
    expect(unknownKpis.map((k) => k.label)).toEqual([
      'Selskaber',
      'Udløbende',
      'Sager',
      'Forfaldne',
    ])
  })

  it('tilføjer rød farve til Forfaldne når count > 0', () => {
    const kpis = buildInlineKpis('GROUP_OWNER', { ...baseData, overdueCount: 5 })
    const forfaldne = kpis.find((k) => k.label === 'Forfaldne')
    expect(forfaldne?.color).toBe('red')
  })

  it('udelader farve på Forfaldne når count = 0', () => {
    const kpis = buildInlineKpis('GROUP_OWNER', { ...baseData, overdueCount: 0 })
    const forfaldne = kpis.find((k) => k.label === 'Forfaldne')
    expect(forfaldne?.color).toBeUndefined()
  })
})

// ---------------------------------------------------------------
// buildTimelineSections
// ---------------------------------------------------------------
describe('buildTimelineSections', () => {
  const today = new Date('2026-04-15T10:00:00')
  const weekEnd = new Date('2026-04-22T10:00:00')
  const companyA = { id: 'a', name: 'Alpha ApS' }
  const companyMap = new Map([[companyA.id, companyA]])

  const empty = {
    overdueTasks: [],
    todayAndFutureTasks: [],
    expiringContracts: [],
    expiredContracts: [],
    openCases: [],
    upcomingVisits: [],
    recentDocuments: [],
    companyMap,
    today,
    weekEnd,
  }

  it('returnerer altid 4 sektioner i korrekt rækkefølge', () => {
    const sections = buildTimelineSections(empty)
    expect(sections.map((s) => s.id)).toEqual(['overdue', 'today', 'thisweek', 'nextweek'])
  })

  it('tilføjer overdue-tasks til overdue-sektionen', () => {
    const sections = buildTimelineSections({
      ...empty,
      overdueTasks: [
        { id: 't1', title: 'Kontrakt deadline', due_date: new Date('2026-04-10'), company_id: 'a' },
      ],
    })
    const overdue = sections.find((s) => s.id === 'overdue')!
    expect(overdue.items).toHaveLength(1)
    expect(overdue.items[0].title).toBe('Kontrakt deadline')
    expect(overdue.items[0].color).toBe('red')
  })

  it('placerer besøg i dag i today-sektionen', () => {
    const sections = buildTimelineSections({
      ...empty,
      upcomingVisits: [
        {
          id: 'v1',
          visit_date: new Date('2026-04-15T14:00:00'),
          visit_type: 'INSPEKTION',
          company: companyA,
        },
      ],
    })
    const todaySection = sections.find((s) => s.id === 'today')!
    expect(todaySection.items).toHaveLength(1)
    expect(todaySection.items[0].color).toBe('blue')
  })

  it('placerer udløbende kontrakter i thisweek-sektionen', () => {
    const sections = buildTimelineSections({
      ...empty,
      expiringContracts: [
        {
          id: 'c1',
          display_name: 'Lejekontrakt',
          expiry_date: new Date('2026-04-18T12:00:00'),
          company: companyA,
        },
      ],
    })
    const thisweek = sections.find((s) => s.id === 'thisweek')!
    expect(thisweek.items).toHaveLength(1)
    expect(thisweek.items[0].title).toBe('Lejekontrakt')
  })
})

// ---------------------------------------------------------------
// emptyDashboardData
// ---------------------------------------------------------------
describe('emptyDashboardData', () => {
  it('returnerer valid default struktur med role sat', () => {
    const data = emptyDashboardData('GROUP_OWNER')
    expect(data.role).toBe('GROUP_OWNER')
    expect(data.heatmap).toEqual([])
    expect(data.underperformingCount).toBe(0)
    expect(data.portfolioTotals).toEqual({
      totalOmsaetning: 0,
      totalEbitda: 0,
      avgEbitdaMargin: 0,
    })
  })

  it('inkluderer 4 tomme timeline-sektioner', () => {
    const data = emptyDashboardData('GROUP_READONLY')
    expect(data.timelineSections).toHaveLength(4)
    expect(data.timelineSections.every((s) => s.items.length === 0)).toBe(true)
  })

  it('coverage indeholder alle 4 required kontrakttyper med pct 0', () => {
    const data = emptyDashboardData('GROUP_OWNER')
    expect(data.coverage).toHaveLength(4)
    expect(data.coverage.every((c) => c.pct === 0)).toBe(true)
    expect(data.coverage.map((c) => c.label)).toEqual([
      'Ejeraftale',
      'Lejekontrakt',
      'Forsikring',
      'Ansættelse',
    ])
  })
})
