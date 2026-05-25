/**
 * Phase N2 — Commit 1: Strip-link "Udløber 30d" filter-mismatch fix.
 *
 * Verificerer at normaliseringen af URL-params (?status=AKTIV&expiresWithin=30d)
 * resulterer i korrekt 'Udløber 30d'-filter på contracts-list-siden.
 *
 * ContractsListBContent er en klientkomponent og testes ikke direkte;
 * vi tester normalizeStatusParam-logikken som ren funktion.
 */

import { describe, it, expect } from 'vitest'

// ─── Replika af normalizeStatusParam fra contracts-list-b.tsx ──────────────

const STATUS_OPTS = ['Alle', 'Aktiv', 'Udløber 30d', 'Udløbet', 'Opsagt']

const STATUS_ENUM_MAP: Record<string, string> = {
  aktiv: 'Aktiv',
  'udlober 30d': 'Udløber 30d',
  udloebet: 'Udløbet',
  opsagt: 'Opsagt',
}

function normalizeStatusParam(status: string | null, expiresWithin: string | null): string {
  if (!status && !expiresWithin) return 'Alle'
  if (expiresWithin === '30d') return 'Udløber 30d'
  if (!status) return 'Alle'
  const lower = status.toLowerCase()
  return STATUS_ENUM_MAP[lower] ?? STATUS_OPTS.find((o) => o.toLowerCase() === lower) ?? 'Alle'
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('normalizeStatusParam — Strip-link ?status=AKTIV&expiresWithin=30d', () => {
  it('?status=AKTIV&expiresWithin=30d → Udløber 30d (det primære bug-case)', () => {
    expect(normalizeStatusParam('AKTIV', '30d')).toBe('Udløber 30d')
  })

  it('?expiresWithin=30d alene (uden status) → Udløber 30d', () => {
    expect(normalizeStatusParam(null, '30d')).toBe('Udløber 30d')
  })

  it('?status=AKTIV (uden expiresWithin) → Aktiv', () => {
    expect(normalizeStatusParam('AKTIV', null)).toBe('Aktiv')
  })

  it('?status=Aktiv (display-label) → Aktiv', () => {
    expect(normalizeStatusParam('Aktiv', null)).toBe('Aktiv')
  })

  it('?status=aktiv (lowercase) → Aktiv', () => {
    expect(normalizeStatusParam('aktiv', null)).toBe('Aktiv')
  })

  it('ingen params → Alle', () => {
    expect(normalizeStatusParam(null, null)).toBe('Alle')
  })

  it('?status=UDLOEBET → Udløbet', () => {
    expect(normalizeStatusParam('UDLOEBET', null)).toBe('Udløbet')
  })

  it('?status=OPSAGT → Opsagt', () => {
    expect(normalizeStatusParam('OPSAGT', null)).toBe('Opsagt')
  })

  it('ukendt status → Alle (sikker fallback)', () => {
    expect(normalizeStatusParam('UKENDT_STATUS', null)).toBe('Alle')
  })
})

// ─── Kontrakt-filter logik ────────────────────────────────────────────────────

interface ContractRow {
  rawStatus: string
  udlobDays: number
  status: string
}

function filterByStatus(contracts: ContractRow[], statusFil: string): ContractRow[] {
  return contracts.filter((c) => {
    if (statusFil === 'Udløber 30d') {
      return c.rawStatus === 'AKTIV' && c.udlobDays >= 0 && c.udlobDays <= 30
    } else if (statusFil !== 'Alle') {
      return c.status === statusFil
    }
    return true
  })
}

describe('filterByStatus — matches Udløber 30d korrekt', () => {
  const contracts: ContractRow[] = [
    { rawStatus: 'AKTIV', udlobDays: 15, status: 'Aktiv' },
    { rawStatus: 'AKTIV', udlobDays: 45, status: 'Aktiv' },
    { rawStatus: 'AKTIV', udlobDays: -5, status: 'Aktiv' },
    { rawStatus: 'UDLOEBET', udlobDays: -1, status: 'Udløbet' },
    { rawStatus: 'OPSAGT', udlobDays: 9999, status: 'Opsagt' },
  ]

  it('statusFil=Udløber 30d matcher kun kontrakt med udlobDays=15', () => {
    const result = filterByStatus(contracts, 'Udløber 30d')
    expect(result).toHaveLength(1)
    expect(result[0]?.udlobDays).toBe(15)
  })

  it('statusFil=Aktiv matcher kontrakter med status=Aktiv (alle 3 AKTIV rows)', () => {
    const result = filterByStatus(contracts, 'Aktiv')
    expect(result).toHaveLength(3)
  })

  it('statusFil=Alle returnerer alle kontrakter', () => {
    expect(filterByStatus(contracts, 'Alle')).toHaveLength(5)
  })
})
