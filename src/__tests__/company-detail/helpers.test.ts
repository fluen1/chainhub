import { describe, it, expect } from 'vitest'
import {
  pickHighestPriorityRole,
  sectionsForRole,
  deriveHealthDimensions,
  deriveStatusBadge,
  sortContractsByUrgency,
  sortCasesByUrgency,
  selectKeyPersons,
  type HealthDimensions,
} from '@/lib/company-detail/helpers'

// -----------------------------------------------------------------
// pickHighestPriorityRole
// -----------------------------------------------------------------

describe('pickHighestPriorityRole', () => {
  it('returnerer GROUP_READONLY ved tom liste', () => {
    expect(pickHighestPriorityRole([])).toBe('GROUP_READONLY')
  })

  it('vaelger GROUP_OWNER over GROUP_LEGAL naar begge er til stede', () => {
    expect(pickHighestPriorityRole([{ role: 'GROUP_LEGAL' }, { role: 'GROUP_OWNER' }])).toBe(
      'GROUP_OWNER'
    )
  })

  it('haandterer ukendt rolle som laveste prioritet', () => {
    expect(pickHighestPriorityRole([{ role: 'UKENDT_ROLLE' }, { role: 'COMPANY_READONLY' }])).toBe(
      'COMPANY_READONLY'
    )
  })
})

// -----------------------------------------------------------------
// sectionsForRole
// -----------------------------------------------------------------

describe('sectionsForRole', () => {
  it('GROUP_OWNER ser alle 8 sektioner', () => {
    const sections = sectionsForRole('GROUP_OWNER')
    expect(sections.size).toBe(8)
    expect(sections.has('ownership')).toBe(true)
    expect(sections.has('contracts')).toBe(true)
    expect(sections.has('finance')).toBe(true)
    expect(sections.has('cases')).toBe(true)
    expect(sections.has('persons')).toBe(true)
    expect(sections.has('visits')).toBe(true)
    expect(sections.has('documents')).toBe(true)
    expect(sections.has('insight')).toBe(true)
  })

  it('GROUP_LEGAL ser 5 sektioner og IKKE finance/persons/visits', () => {
    const sections = sectionsForRole('GROUP_LEGAL')
    expect(sections.size).toBe(5)
    expect(sections.has('ownership')).toBe(true)
    expect(sections.has('contracts')).toBe(true)
    expect(sections.has('cases')).toBe(true)
    expect(sections.has('documents')).toBe(true)
    expect(sections.has('insight')).toBe(true)
    expect(sections.has('finance')).toBe(false)
    expect(sections.has('persons')).toBe(false)
    expect(sections.has('visits')).toBe(false)
  })

  it('GROUP_FINANCE ser 3 sektioner (contracts, finance, insight)', () => {
    const sections = sectionsForRole('GROUP_FINANCE')
    expect(sections.size).toBe(3)
    expect(sections.has('contracts')).toBe(true)
    expect(sections.has('finance')).toBe(true)
    expect(sections.has('insight')).toBe(true)
  })

  it('GROUP_ADMIN ser 4 sektioner og IKKE insight', () => {
    const sections = sectionsForRole('GROUP_ADMIN')
    expect(sections.size).toBe(4)
    expect(sections.has('ownership')).toBe(true)
    expect(sections.has('persons')).toBe(true)
    expect(sections.has('visits')).toBe(true)
    expect(sections.has('documents')).toBe(true)
    expect(sections.has('insight')).toBe(false)
  })

  it('COMPANY_MANAGER ser 2 sektioner (persons, visits)', () => {
    const sections = sectionsForRole('COMPANY_MANAGER')
    expect(sections.size).toBe(2)
    expect(sections.has('persons')).toBe(true)
    expect(sections.has('visits')).toBe(true)
  })

  it('ukendt rolle falder tilbage til GROUP_OWNER med 8 sektioner', () => {
    const sections = sectionsForRole('UKENDT_ROLLE')
    expect(sections.size).toBe(8)
  })
})

// -----------------------------------------------------------------
// deriveHealthDimensions
// -----------------------------------------------------------------

describe('deriveHealthDimensions', () => {
  const today = new Date('2026-04-11')

  const baseInput = {
    activeContracts: [],
    openCases: [],
    finance2025: null,
    finance2024: null,
    lastVisitDate: new Date('2026-03-01'), // ~41 dage siden -> green
    today,
  }

  it('kontrakter: red naar mindst en kontrakt er udloebet', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      activeContracts: [{ expiry_date: new Date('2026-01-01') }],
    })
    expect(result.kontrakter).toBe('red')
  })

  it('kontrakter: amber naar kontrakt udloeber inden for 30 dage', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      activeContracts: [{ expiry_date: new Date('2026-04-25') }],
    })
    expect(result.kontrakter).toBe('amber')
  })

  it('kontrakter: green naar alle kontrakter er langt ude i fremtiden', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      activeContracts: [{ expiry_date: new Date('2027-12-01') }],
    })
    expect(result.kontrakter).toBe('green')
  })

  it('sager: red ved status NY', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      openCases: [{ status: 'NY' }],
    })
    expect(result.sager).toBe('red')
  })

  it('sager: amber ved kun AFVENTER_EKSTERN', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      openCases: [{ status: 'AFVENTER_EKSTERN' }],
    })
    expect(result.sager).toBe('amber')
  })

  it('sager: green naar der ikke er nogen aabne sager', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      openCases: [],
    })
    expect(result.sager).toBe('green')
  })

  it('oekonomi: red ved negativ EBITDA', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      finance2025: { ebitda: -50000, margin: -0.05, omsaetning: 1000000 },
    })
    expect(result.oekonomi).toBe('red')
  })

  it('oekonomi: amber ved margin under 5%', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      finance2025: { ebitda: 30000, margin: 0.03, omsaetning: 1000000 },
    })
    expect(result.oekonomi).toBe('amber')
  })

  it('oekonomi: amber ved YoY omsaetning-fald over 10%', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      finance2025: { ebitda: 100000, margin: 0.1, omsaetning: 800000 },
      finance2024: { omsaetning: 1000000 },
    })
    expect(result.oekonomi).toBe('amber')
  })

  it('oekonomi: green ved sund margin og stabil YoY', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      finance2025: { ebitda: 150000, margin: 0.15, omsaetning: 1000000 },
      finance2024: { omsaetning: 980000 },
    })
    expect(result.oekonomi).toBe('green')
  })

  it('governance: red uden registreret besoeg', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      lastVisitDate: null,
    })
    expect(result.governance).toBe('red')
  })

  it('governance: red ved besoeg over 12 maaneder gammelt', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      lastVisitDate: new Date('2024-12-01'), // ~16 mdr siden
    })
    expect(result.governance).toBe('red')
  })

  it('governance: amber ved besoeg 6-12 maaneder gammelt', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      lastVisitDate: new Date('2025-08-01'), // ~8 mdr siden
    })
    expect(result.governance).toBe('amber')
  })

  it('governance: green ved besoeg under 6 maaneder gammelt', () => {
    const result = deriveHealthDimensions({
      ...baseInput,
      lastVisitDate: new Date('2026-03-01'), // ~41 dage siden
    })
    expect(result.governance).toBe('green')
  })
})

// -----------------------------------------------------------------
// deriveStatusBadge
// -----------------------------------------------------------------

describe('deriveStatusBadge', () => {
  it('Kritisk/critical naar mindst en dimension er red', () => {
    const dims: HealthDimensions = {
      kontrakter: 'red',
      sager: 'green',
      oekonomi: 'amber',
      governance: 'green',
    }
    expect(deriveStatusBadge(dims)).toEqual({ label: 'Kritisk', severity: 'critical' })
  })

  it('Advarsel/warning naar mindst en amber og ingen red', () => {
    const dims: HealthDimensions = {
      kontrakter: 'green',
      sager: 'amber',
      oekonomi: 'green',
      governance: 'green',
    }
    expect(deriveStatusBadge(dims)).toEqual({ label: 'Advarsel', severity: 'warning' })
  })

  it('Sund/healthy naar alle dimensioner er green', () => {
    const dims: HealthDimensions = {
      kontrakter: 'green',
      sager: 'green',
      oekonomi: 'green',
      governance: 'green',
    }
    expect(deriveStatusBadge(dims)).toEqual({ label: 'Sund', severity: 'healthy' })
  })
})

// -----------------------------------------------------------------
// sortContractsByUrgency
// -----------------------------------------------------------------

describe('sortContractsByUrgency', () => {
  const today = new Date('2026-04-11')

  it('udloebne foerst, dernaest udloeber-snart, dernaest langt-ude', () => {
    const contracts = [
      { id: 'far', expiry_date: new Date('2027-06-01') },
      { id: 'expired', expiry_date: new Date('2026-01-01') },
      { id: 'soon', expiry_date: new Date('2026-04-20') },
    ]
    const sorted = sortContractsByUrgency(contracts, today)
    expect(sorted.map((c) => c.id)).toEqual(['expired', 'soon', 'far'])
  })

  it('null expiry_date sorteres som "langt ude"', () => {
    const contracts = [
      { id: 'nulldate', expiry_date: null },
      { id: 'expired', expiry_date: new Date('2026-01-01') },
      { id: 'soon', expiry_date: new Date('2026-04-20') },
    ]
    const sorted = sortContractsByUrgency(contracts, today)
    expect(sorted.map((c) => c.id)).toEqual(['expired', 'soon', 'nulldate'])
  })
})

// -----------------------------------------------------------------
// sortCasesByUrgency
// -----------------------------------------------------------------

describe('sortCasesByUrgency', () => {
  it('NY foer AKTIV foer AFVENTER', () => {
    const cases = [
      { id: 'afv', status: 'AFVENTER_EKSTERN', created_at: new Date('2026-04-01') },
      { id: 'akt', status: 'AKTIV', created_at: new Date('2026-04-01') },
      { id: 'ny', status: 'NY', created_at: new Date('2026-04-01') },
    ]
    const sorted = sortCasesByUrgency(cases)
    expect(sorted.map((c) => c.id)).toEqual(['ny', 'akt', 'afv'])
  })

  it('inden for samme status sorteres nyeste foerst efter created_at', () => {
    const cases = [
      { id: 'old', status: 'NY', created_at: new Date('2026-01-01') },
      { id: 'new', status: 'NY', created_at: new Date('2026-04-01') },
      { id: 'mid', status: 'NY', created_at: new Date('2026-02-15') },
    ]
    const sorted = sortCasesByUrgency(cases)
    expect(sorted.map((c) => c.id)).toEqual(['new', 'mid', 'old'])
  })
})

// -----------------------------------------------------------------
// selectKeyPersons
// -----------------------------------------------------------------

describe('selectKeyPersons', () => {
  it('tom liste returnerer tom liste', () => {
    expect(selectKeyPersons([])).toEqual([])
  })

  it('filtrerer ikke-senior roller fra', () => {
    const candidates = [
      {
        role: 'Receptionist',
        anciennity_start: new Date('2020-01-01'),
        person: { first_name: 'Anna', last_name: 'Hansen' },
      },
      {
        role: 'Partner',
        anciennity_start: new Date('2020-01-01'),
        person: { first_name: 'Bent', last_name: 'Jensen' },
      },
    ]
    const result = selectKeyPersons(candidates)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('Partner')
  })

  it('sorterer efter rolle-hierarki (Partner foer Direktoer foer Klinikchef)', () => {
    const candidates = [
      {
        role: 'Klinikchef',
        anciennity_start: new Date('2018-01-01'),
        person: { first_name: 'C', last_name: 'C' },
      },
      {
        role: 'Direktoer',
        anciennity_start: new Date('2018-01-01'),
        person: { first_name: 'B', last_name: 'B' },
      },
      {
        role: 'Partner',
        anciennity_start: new Date('2018-01-01'),
        person: { first_name: 'A', last_name: 'A' },
      },
    ]
    const result = selectKeyPersons(candidates)
    expect(result.map((r) => r.role)).toEqual(['Partner', 'Direktoer', 'Klinikchef'])
  })

  it('inden for samme rolle: laengst-anciennitet (tidligst start) foerst', () => {
    const candidates = [
      {
        role: 'Partner',
        anciennity_start: new Date('2020-01-01'),
        person: { first_name: 'Ny', last_name: 'Partner' },
      },
      {
        role: 'Partner',
        anciennity_start: new Date('2010-01-01'),
        person: { first_name: 'Gammel', last_name: 'Partner' },
      },
    ]
    const result = selectKeyPersons(candidates)
    expect(result[0].person.first_name).toBe('Gammel')
    expect(result[1].person.first_name).toBe('Ny')
  })

  it('begraenser til maks 3 selv ved flere kandidater', () => {
    const candidates = [
      {
        role: 'Partner',
        anciennity_start: new Date('2015-01-01'),
        person: { first_name: 'A', last_name: 'A' },
      },
      {
        role: 'Medejer',
        anciennity_start: new Date('2016-01-01'),
        person: { first_name: 'B', last_name: 'B' },
      },
      {
        role: 'CEO',
        anciennity_start: new Date('2017-01-01'),
        person: { first_name: 'C', last_name: 'C' },
      },
      {
        role: 'Direktoer',
        anciennity_start: new Date('2018-01-01'),
        person: { first_name: 'D', last_name: 'D' },
      },
      {
        role: 'CFO',
        anciennity_start: new Date('2019-01-01'),
        person: { first_name: 'E', last_name: 'E' },
      },
    ]
    const result = selectKeyPersons(candidates)
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.role)).toEqual(['Partner', 'Medejer', 'CEO'])
  })
})
