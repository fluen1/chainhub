/**
 * Tests for reviveDates — cache-grænse-utility.
 * Fokus: G1-010-fix (Prisma Decimal → number ved cache-miss).
 */
import { describe, it, expect } from 'vitest'
import { reviveDates } from '@/lib/cache-dates'
import { sumMetric, filterLatestPerCompany, buildInlineKpis } from '@/lib/dashboard-helpers'

// ---------------------------------------------------------------
// Dato-genskabelse (eksisterende adfærd)
// ---------------------------------------------------------------
describe('reviveDates — dato-genskabelse', () => {
  it('konverterer ISO datetime-strenge til Date-objekter', () => {
    const result = reviveDates({ created_at: '2026-04-15T10:00:00.000Z' })
    expect(result.created_at).toBeInstanceOf(Date)
  })

  it('bevarer plain strings der ikke ligner ISO datoer', () => {
    const result = reviveDates({ name: 'Optik Nord' })
    expect(result.name).toBe('Optik Nord')
  })

  it('bevarer numeriske strings som strings (fx JSON-serialiseret Decimal)', () => {
    const result = reviveDates({ value: '42500000' })
    expect(result.value).toBe('42500000')
    expect(typeof result.value).toBe('string')
  })

  it('traverserer arrays rekursivt', () => {
    const input = [{ date: '2026-04-15T10:00:00.000Z' }, { date: '2026-05-01T00:00:00Z' }]
    const result = reviveDates(input)
    expect(result[0]!.date).toBeInstanceOf(Date)
    expect(result[1]!.date).toBeInstanceOf(Date)
  })

  it('håndterer null og primitive værdier', () => {
    expect(reviveDates(null)).toBeNull()
    expect(reviveDates(42)).toBe(42)
    expect(reviveDates('hello')).toBe('hello')
  })
})

// ---------------------------------------------------------------
// G1-010: Prisma Decimal-objekter (cache-miss path)
// ---------------------------------------------------------------
describe('reviveDates — Prisma Decimal (G1-010)', () => {
  // Simulér et Prisma Decimal-objekt (har s/e/d internt og toJSON() → string).
  // Vi bruger ikke Prisma runtime direkte i tests — laver en minimal mock.
  function makeDecimalLike(numericString: string) {
    return {
      s: numericString.startsWith('-') ? -1 : 1,
      e: Math.floor(Math.log10(Math.abs(parseFloat(numericString)))),
      d: [1], // forenklet — echoes real Decimal structure
      toJSON: () => numericString,
      toString: () => numericString,
    }
  }

  it('konverterer Decimal-objekt til number (undgår NaN ved cache-miss)', () => {
    const decimal = makeDecimalLike('42500000')
    const result = reviveDates({ value: decimal })
    expect(typeof result.value).toBe('number')
    expect(result.value).toBe(42500000)
    expect(isNaN(result.value as unknown as number)).toBe(false)
  })

  it('konverterer Decimal-objekt med decimal-del korrekt', () => {
    const decimal = makeDecimalLike('1234567.89')
    const result = reviveDates({ value: decimal })
    expect(result.value).toBeCloseTo(1234567.89)
  })

  it('konverterer negativ Decimal korrekt', () => {
    const decimal = makeDecimalLike('-500000')
    const result = reviveDates({ value: decimal })
    expect(result.value).toBe(-500000)
  })

  it('konverterer Decimal nul korrekt', () => {
    const decimal = makeDecimalLike('0')
    // makeDecimalLike('0') giver log10(0) = -Infinity — juster e manuelt
    decimal.e = 0
    const result = reviveDates({ value: decimal })
    expect(result.value).toBe(0)
  })

  it('sumMetric på revived financialMetrics giver korrekt sum (full pipeline)', () => {
    // Simulér: Prisma returnerer Decimal-objekter (cache-miss) →
    // reviveDates konverterer → sumMetric adderer → formatMio(sum) producerer korrekt KPI
    const decimalA = makeDecimalLike('42500000')
    const decimalB = makeDecimalLike('18750000')

    const rawMetrics = [
      { company_id: 'a', metric_type: 'OMSAETNING', value: decimalA, period_year: 2026 },
      { company_id: 'b', metric_type: 'OMSAETNING', value: decimalB, period_year: 2026 },
    ]

    const revived = reviveDates(rawMetrics)
    const latest = filterLatestPerCompany(revived)
    const total = sumMetric(latest, 'OMSAETNING')

    expect(isNaN(total)).toBe(false)
    expect(total).toBe(61250000)
  })

  it('bygger GROUP_FINANCE KPI uden NaN ved cache-miss (Decimal-objekter)', () => {
    const metrics = [
      {
        company_id: 'a',
        metric_type: 'OMSAETNING',
        value: makeDecimalLike('10000000'),
        period_year: 2026,
      },
      {
        company_id: 'a',
        metric_type: 'EBITDA',
        value: makeDecimalLike('2000000'),
        period_year: 2026,
      },
    ]

    const revived = reviveDates(metrics)
    const latest = filterLatestPerCompany(revived)
    const omsaetningTotal = sumMetric(latest, 'OMSAETNING')
    const ebitdaTotal = sumMetric(latest, 'EBITDA')
    const margin = omsaetningTotal > 0 ? ebitdaTotal / omsaetningTotal : 0

    const kpis = buildInlineKpis('GROUP_FINANCE', {
      companiesCount: 1,
      expiringCount: 0,
      openCasesCount: 0,
      overdueCount: 0,
      omsaetningTotal,
      ebitdaTotal,
      margin,
    })

    const omsaetningKpi = kpis.find((k) => k.label === 'Omsætning')
    expect(omsaetningKpi?.value).not.toContain('NaN')
    expect(omsaetningKpi?.value).toBe('10m')
  })
})
