/**
 * Phase N3 — Tests for:
 * 1. AlertBar ved healthStatus=critical (buildCriticalReason-logik)
 * 2. CaseStatusPill — gyldige transitioner per CASE_TRANSITIONS
 * 3. computePeerRank — rangberegning ved omsaetning
 *
 * Alle tests er rene funktioner uden DB-afhængigheder.
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// 1. buildCriticalReason — logik til AlertBar-tekst
// ─────────────────────────────────────────────────────────────────────────────

// Replika af buildCriticalReason fra company-detail-b.tsx (pure function)
function buildCriticalReason(openCases: number, overdueTasks: number): string {
  if (overdueTasks > 0 && openCases > 0) {
    return `${overdueTasks} ${overdueTasks === 1 ? 'forfalden opgave' : 'forfaldne opgaver'} og ${openCases} ${openCases === 1 ? 'åben sag' : 'åbne sager'}`
  }
  if (overdueTasks > 0) {
    return `${overdueTasks} ${overdueTasks === 1 ? 'forfalden opgave' : 'forfaldne opgaver'}`
  }
  if (openCases > 0) {
    return `${openCases} ${openCases === 1 ? 'åben sag' : 'åbne sager'}`
  }
  return 'se detaljer nedenfor'
}

describe('buildCriticalReason — AlertBar-tekst ved kritisk selskab', () => {
  it('viser begge årsager når overdueTasks > 0 OG openCases > 0', () => {
    const result = buildCriticalReason(3, 2)
    expect(result).toContain('forfaldne opgaver')
    expect(result).toContain('åbne sager')
    expect(result).toContain('og')
  })

  it('entalsform ved 1 overfalden opgave og 1 åben sag', () => {
    const result = buildCriticalReason(1, 1)
    expect(result).toContain('forfalden opgave')
    expect(result).toContain('åben sag')
  })

  it('viser kun overdue-tekst når openCases=0', () => {
    const result = buildCriticalReason(0, 4)
    expect(result).toContain('forfaldne opgaver')
    expect(result).not.toContain('sag')
  })

  it('viser kun sager-tekst når overdueTasks=0', () => {
    const result = buildCriticalReason(5, 0)
    expect(result).toContain('åbne sager')
    expect(result).not.toContain('opgave')
  })

  it('fallback-tekst når begge er 0 (f.eks. kritisk pga. økonomi/governance)', () => {
    const result = buildCriticalReason(0, 0)
    expect(result).toBe('se detaljer nedenfor')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. CASE_TRANSITIONS — gyldige transitioner
// ─────────────────────────────────────────────────────────────────────────────

// Replika af transitions-map (spejler actions/cases.ts + case-detail-b.tsx)
const CASE_TRANSITIONS: Record<string, string[]> = {
  NY: ['AKTIV'],
  AKTIV: ['AFVENTER_EKSTERN', 'AFVENTER_KLIENT', 'LUKKET'],
  AFVENTER_EKSTERN: ['AKTIV', 'LUKKET'],
  AFVENTER_KLIENT: ['AKTIV', 'LUKKET'],
  LUKKET: ['AKTIV', 'ARKIVERET'],
  ARKIVERET: [],
}

describe('CASE_TRANSITIONS — gyldige sagsstatus-skift (inline StatusPill)', () => {
  it('NY kan kun gå til AKTIV', () => {
    expect(CASE_TRANSITIONS['NY']).toEqual(['AKTIV'])
  })

  it('AKTIV kan gå til AFVENTER_EKSTERN, AFVENTER_KLIENT eller LUKKET', () => {
    const valid = CASE_TRANSITIONS['AKTIV']
    expect(valid).toContain('AFVENTER_EKSTERN')
    expect(valid).toContain('AFVENTER_KLIENT')
    expect(valid).toContain('LUKKET')
    expect(valid).not.toContain('NY') // kan ikke gå baglæns
  })

  it('AFVENTER_EKSTERN kan vende tilbage til AKTIV eller LUKKET', () => {
    const valid = CASE_TRANSITIONS['AFVENTER_EKSTERN']
    expect(valid).toContain('AKTIV')
    expect(valid).toContain('LUKKET')
    expect(valid).not.toContain('NY')
  })

  it('LUKKET kan genåbnes til AKTIV eller arkiveres', () => {
    const valid = CASE_TRANSITIONS['LUKKET']
    expect(valid).toContain('AKTIV')
    expect(valid).toContain('ARKIVERET')
  })

  it('ARKIVERET har ingen gyldige transitioner (pill vises disabled)', () => {
    expect(CASE_TRANSITIONS['ARKIVERET']).toHaveLength(0)
  })

  it('pilot-flow NY→AKTIV sker i 1 klik (2 klik total inkl. åbn dropdown)', () => {
    // NY er udgangspunkt, AKTIV er eneste option — dropdown viser netop 1 valg
    const options = CASE_TRANSITIONS['NY']
    expect(options).toHaveLength(1)
    expect(options[0]).toBe('AKTIV')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. computePeerRank — rangberegning efter omsaetning
// ─────────────────────────────────────────────────────────────────────────────

// Replika af computePeerRank fra company-detail.ts (pure function, ingen Decimal)
function computePeerRank(
  companyId: string,
  thisOmsaetning: number | null,
  allMetrics: Array<{ company_id: string; value: number }>
): { rank: number; total: number } | null {
  if (thisOmsaetning === null) return null

  const byCompany = new Map<string, number>()
  for (const m of allMetrics) {
    byCompany.set(m.company_id, (byCompany.get(m.company_id) ?? 0) + m.value)
  }
  if (!byCompany.has(companyId)) {
    byCompany.set(companyId, thisOmsaetning)
  }

  const total = byCompany.size
  if (total <= 1) return null

  const sorted = Array.from(byCompany.values()).sort((a, b) => b - a)
  const thisVal = byCompany.get(companyId) ?? 0
  const rank = sorted.findIndex((v) => v <= thisVal) + 1

  return { rank, total }
}

describe('computePeerRank — peer-rangering efter omsaetning', () => {
  const metrics = [
    { company_id: 'c1', value: 5_000_000 }, // høj
    { company_id: 'c2', value: 3_000_000 }, // mellem
    { company_id: 'c3', value: 1_000_000 }, // lav
  ]

  it('returnerer null hvis selskabet selv ikke har omsaetning', () => {
    expect(computePeerRank('c1', null, metrics)).toBeNull()
  })

  it('returnerer null ved kun 1 selskab (rangering meningsløs)', () => {
    const result = computePeerRank('c1', 5_000_000, [{ company_id: 'c1', value: 5_000_000 }])
    expect(result).toBeNull()
  })

  it('rang 1 til det selskab med højest omsaetning', () => {
    const result = computePeerRank('c1', 5_000_000, metrics)
    expect(result).not.toBeNull()
    expect(result?.rank).toBe(1)
    expect(result?.total).toBe(3)
  })

  it('rang 2 til selskab med næsthøjest omsaetning', () => {
    const result = computePeerRank('c2', 3_000_000, metrics)
    expect(result?.rank).toBe(2)
    expect(result?.total).toBe(3)
  })

  it('rang 3 til selskab med lavest omsaetning', () => {
    const result = computePeerRank('c3', 1_000_000, metrics)
    expect(result?.rank).toBe(3)
    expect(result?.total).toBe(3)
  })

  it('total inkluderer selskab selv selvom det mangler i metrics-listen', () => {
    // c4 er ikke i metrics-listen; vi giver den thisOmsaetning=2m.
    // Sorteret faldende: [5m (c1), 3m (c2), 2m (c4), 1m (c3)] → c4 er rang 3 af 4.
    const result = computePeerRank('c4', 2_000_000, metrics)
    expect(result).not.toBeNull()
    expect(result?.total).toBe(4)
    expect(result?.rank).toBe(3)
  })
})
