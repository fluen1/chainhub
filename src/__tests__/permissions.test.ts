/**
 * BA-10: Unit tests for permissions helpers
 * Tester canAccessSensitivity, canAccessCompany og meetsMinimumSensitivity
 */

import { describe, it, expect } from 'vitest'
import { meetsMinimumSensitivity, SENSITIVITY_MINIMUM } from '@/lib/validations/contract'

// ──── meetsMinimumSensitivity tests ────────────────────────────────────────

describe('meetsMinimumSensitivity', () => {
  it('STRENGT_FORTROLIG meets STRENGT_FORTROLIG', () => {
    expect(meetsMinimumSensitivity('STRENGT_FORTROLIG', 'STRENGT_FORTROLIG')).toBe(true)
  })

  it('FORTROLIG does NOT meet STRENGT_FORTROLIG', () => {
    expect(meetsMinimumSensitivity('FORTROLIG', 'STRENGT_FORTROLIG')).toBe(false)
  })

  it('INTERN does NOT meet FORTROLIG', () => {
    expect(meetsMinimumSensitivity('INTERN', 'FORTROLIG')).toBe(false)
  })

  it('STANDARD meets STANDARD', () => {
    expect(meetsMinimumSensitivity('STANDARD', 'STANDARD')).toBe(true)
  })

  it('STRENGT_FORTROLIG meets INTERN', () => {
    expect(meetsMinimumSensitivity('STRENGT_FORTROLIG', 'INTERN')).toBe(true)
  })

  it('PUBLIC does NOT meet STANDARD', () => {
    expect(meetsMinimumSensitivity('PUBLIC', 'STANDARD')).toBe(false)
  })
})

// ──── SENSITIVITY_MINIMUM catalog tests ─────────────────────────────────────

describe('SENSITIVITY_MINIMUM catalog', () => {
  it('EJERAFTALE requires STRENGT_FORTROLIG', () => {
    expect(SENSITIVITY_MINIMUM['EJERAFTALE']).toBe('STRENGT_FORTROLIG')
  })

  it('DIREKTOERKONTRAKT requires STRENGT_FORTROLIG', () => {
    expect(SENSITIVITY_MINIMUM['DIREKTOERKONTRAKT']).toBe('STRENGT_FORTROLIG')
  })

  it('ANSAETTELSE_FUNKTIONAER requires FORTROLIG', () => {
    expect(SENSITIVITY_MINIMUM['ANSAETTELSE_FUNKTIONAER']).toBe('FORTROLIG')
  })

  it('VEDTAEGTER requires INTERN', () => {
    expect(SENSITIVITY_MINIMUM['VEDTAEGTER']).toBe('INTERN')
  })

  it('VIKARAFTALE requires STANDARD', () => {
    expect(SENSITIVITY_MINIMUM['VIKARAFTALE']).toBe('STANDARD')
  })

  it('all LAG2 types require STRENGT_FORTROLIG (except KASSEKREDIT)', () => {
    const lag2 = [
      'INTERN_SERVICEAFTALE',
      'ROYALTY_LICENS',
      'OPTIONSAFTALE',
      'TILTRAEDELSESDOKUMENT',
      'CASH_POOL',
      'INTERCOMPANY_LAAN',
      'SELSKABSGARANTI',
    ] as const
    lag2.forEach((type) => {
      expect(SENSITIVITY_MINIMUM[type]).toBe('STRENGT_FORTROLIG')
    })
  })

  it('KASSEKREDIT (Lag 2) requires FORTROLIG', () => {
    expect(SENSITIVITY_MINIMUM['KASSEKREDIT']).toBe('FORTROLIG')
  })
})

// ──── Sensitivity elevation rule ─────────────────────────────────────────────

describe('Sensitivity cannot be lowered', () => {
  it('COMPANY_MANAGER (max FORTROLIG) cannot create STRENGT_FORTROLIG contract', () => {
    // Bruger har max FORTROLIG adgang
    const userMaxSensitivity = 'FORTROLIG'
    const requestedSensitivity = 'STRENGT_FORTROLIG'

    // meetsMinimumSensitivity bruges omvendt her:
    // brugerens adgang skal MØDE kontraktens krav
    const canCreate = meetsMinimumSensitivity(userMaxSensitivity, requestedSensitivity)
    expect(canCreate).toBe(false)
  })

  it('GROUP_LEGAL (STRENGT_FORTROLIG) can create any sensitivity', () => {
    const sensitivities = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'] as const
    sensitivities.forEach((s) => {
      expect(meetsMinimumSensitivity('STRENGT_FORTROLIG', s)).toBe(true)
    })
  })
})
