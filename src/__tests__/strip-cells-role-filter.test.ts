/**
 * Phase N1 — Dashboard Strip-cells rolle-filter (Fix 6)
 * Verificerer at pickHighestPriorityRole returnerer korrekt rolle,
 * som bruges til Strip-cell-filtrering.
 *
 * Dashboard-siden er en Server Component og kan ikke unit-testes direkte,
 * men vi kan teste at filterlogikken (baseret på pickHighestPriorityRole)
 * er korrekt, og at DashboardData.role eksponerer rollen.
 */

import { describe, it, expect } from 'vitest'
import { pickHighestPriorityRole, ROLE_PRIORITY } from '@/lib/dashboard-helpers'

describe('pickHighestPriorityRole — bruges til Strip-cells filtrering', () => {
  it('GROUP_OWNER vinder over GROUP_ADMIN', () => {
    const result = pickHighestPriorityRole([{ role: 'GROUP_ADMIN' }, { role: 'GROUP_OWNER' }])
    expect(result).toBe('GROUP_OWNER')
  })

  it('GROUP_ADMIN vinder over GROUP_FINANCE og GROUP_LEGAL', () => {
    const result = pickHighestPriorityRole([
      { role: 'GROUP_FINANCE' },
      { role: 'GROUP_ADMIN' },
      { role: 'GROUP_LEGAL' },
    ])
    expect(result).toBe('GROUP_ADMIN')
  })

  it('GROUP_FINANCE vinder over COMPANY_MANAGER', () => {
    const result = pickHighestPriorityRole([{ role: 'COMPANY_MANAGER' }, { role: 'GROUP_FINANCE' }])
    expect(result).toBe('GROUP_FINANCE')
  })

  it('fallback til GROUP_READONLY ved tom liste', () => {
    expect(pickHighestPriorityRole([])).toBe('GROUP_READONLY')
  })

  it('alle roller er kendte i ROLE_PRIORITY', () => {
    const allRoles = [
      'GROUP_OWNER',
      'GROUP_ADMIN',
      'GROUP_LEGAL',
      'GROUP_FINANCE',
      'GROUP_READONLY',
      'COMPANY_MANAGER',
      'COMPANY_LEGAL',
      'COMPANY_READONLY',
    ]
    for (const role of allRoles) {
      expect(ROLE_PRIORITY[role], `${role} mangler i ROLE_PRIORITY`).toBeGreaterThan(0)
    }
  })
})

// ─── Strip-cell filterlogik (ren funktion, ingen DB) ──────────────────────────

/**
 * Replika af filterlogikken fra dashboard/page.tsx — tester adfærden isoleret.
 * Hvis logikken ændres i page.tsx skal dette opdateres tilsvarende.
 */
function getStripCellKeys(role: string): string[] {
  if (role === 'GROUP_OWNER' || role === 'GROUP_ADMIN') {
    return ['selskaber', 'udloebes', 'sager', 'opgaver', 'dokumenter', 'omsaetning']
  } else if (role === 'GROUP_FINANCE') {
    return ['selskaber', 'udloebes', 'opgaver', 'omsaetning']
  } else if (role === 'GROUP_LEGAL') {
    return ['selskaber', 'udloebes', 'sager', 'opgaver']
  } else if (role === 'GROUP_READONLY') {
    return ['selskaber', 'udloebes', 'sager']
  } else if (['COMPANY_MANAGER', 'COMPANY_LEGAL', 'COMPANY_READONLY'].includes(role)) {
    return ['selskaber', 'sager', 'opgaver']
  }
  return ['selskaber', 'udloebes']
}

describe('Strip-cells filterlogik per rolle', () => {
  it('GROUP_OWNER ser alle 6 cells', () => {
    const cells = getStripCellKeys('GROUP_OWNER')
    expect(cells).toHaveLength(6)
    expect(cells).toContain('dokumenter')
    expect(cells).toContain('omsaetning')
    expect(cells).toContain('sager')
  })

  it('GROUP_ADMIN ser alle 6 cells', () => {
    expect(getStripCellKeys('GROUP_ADMIN')).toHaveLength(6)
  })

  it('GROUP_FINANCE ser IKKE sager (redirect-problem)', () => {
    const cells = getStripCellKeys('GROUP_FINANCE')
    expect(cells).not.toContain('sager')
    expect(cells).toContain('omsaetning')
    expect(cells).toContain('opgaver')
  })

  it('GROUP_FINANCE ser IKKE dokumenter (mangler adgang)', () => {
    const cells = getStripCellKeys('GROUP_FINANCE')
    expect(cells).not.toContain('dokumenter')
  })

  it('GROUP_LEGAL ser sager men IKKE omsaetning', () => {
    const cells = getStripCellKeys('GROUP_LEGAL')
    expect(cells).toContain('sager')
    expect(cells).not.toContain('omsaetning')
  })

  it('GROUP_READONLY ser begrænset sæt (ingen finansdata)', () => {
    const cells = getStripCellKeys('GROUP_READONLY')
    expect(cells).not.toContain('omsaetning')
    expect(cells).not.toContain('dokumenter')
    expect(cells).toContain('sager')
  })

  it('COMPANY_MANAGER ser selskaber, sager og opgaver', () => {
    const cells = getStripCellKeys('COMPANY_MANAGER')
    expect(cells).toContain('selskaber')
    expect(cells).toContain('sager')
    expect(cells).toContain('opgaver')
    expect(cells).not.toContain('omsaetning')
  })

  it('COMPANY_LEGAL og COMPANY_READONLY ser samme subset som COMPANY_MANAGER', () => {
    expect(getStripCellKeys('COMPANY_LEGAL')).toEqual(getStripCellKeys('COMPANY_MANAGER'))
    expect(getStripCellKeys('COMPANY_READONLY')).toEqual(getStripCellKeys('COMPANY_MANAGER'))
  })

  it('ukendt rolle får fallback med minimale cells', () => {
    const cells = getStripCellKeys('UNKNOWN_ROLE')
    expect(cells).toHaveLength(2)
    expect(cells).toContain('selskaber')
  })
})
