import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Tests for addPersonRole og addPersonOwnership (Phase B2).
// Dækker: happy path, uautoriseret, forkert tenant, manglende adgang.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      findFirst: vi.fn().mockResolvedValue({ id: 'person-1' }),
    },
    companyPerson: {
      create: vi.fn().mockResolvedValue({ id: 'cp-1', role: 'direktoer' }),
    },
    ownership: {
      create: vi.fn().mockResolvedValue({ id: 'o-1', ownership_pct: 33 }),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { addPersonRole, addPersonOwnership } from '@/actions/persons'

const PERSON_ID = 'person-uuid-1'
const COMPANY_ID = 'company-uuid-1'

// ─────────────────────────────────────────────────────────────────────────────
// addPersonRole
// ─────────────────────────────────────────────────────────────────────────────

describe('addPersonRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: opretter companyPerson og returnerer data', async () => {
    const result = await addPersonRole({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      role: 'direktoer',
    })
    expect('data' in result).toBe(true)
    if ('data' in result && result.data) {
      expect(result.data.role).toBe('direktoer')
    }
  })

  it('afviser uden session (uautoriseret)', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await addPersonRole({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      role: 'ansat',
    })
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser hvis ingen selskabsadgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await addPersonRole({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      role: 'ansat',
    })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/adgang/i)
    }
  })

  it('afviser hvis person ikke findes (forkert tenant)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockResolvedValueOnce(null as never)
    const result = await addPersonRole({
      personId: 'anden-tenant-person',
      companyId: COMPANY_ID,
      role: 'ansat',
    })
    expect(result).toEqual({ error: 'Person ikke fundet' })
  })

  it('afviser med ugyldig input (tom role)', async () => {
    const result = await addPersonRole({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      role: '',
    })
    expect('error' in result).toBe(true)
  })

  it('afviser med ugyldig input (tom companyId)', async () => {
    const result = await addPersonRole({
      personId: PERSON_ID,
      companyId: '',
      role: 'ansat',
    })
    expect('error' in result).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// addPersonOwnership
// ─────────────────────────────────────────────────────────────────────────────

describe('addPersonOwnership', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: opretter ownership og returnerer data', async () => {
    const result = await addPersonOwnership({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      sharePercent: 33,
    })
    expect('data' in result).toBe(true)
  })

  it('afviser uden session (uautoriseret)', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await addPersonOwnership({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      sharePercent: 50,
    })
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser hvis ingen selskabsadgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await addPersonOwnership({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      sharePercent: 25,
    })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/adgang/i)
    }
  })

  it('afviser hvis bruger mangler STRENGT_FORTROLIG-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessSensitivity).mockResolvedValueOnce(false)
    const result = await addPersonOwnership({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      sharePercent: 25,
    })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/adgang/i)
    }
  })

  it('afviser hvis person ikke findes (forkert tenant)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.person.findFirst).mockResolvedValueOnce(null as never)
    const result = await addPersonOwnership({
      personId: 'anden-tenant-person',
      companyId: COMPANY_ID,
      sharePercent: 10,
    })
    expect(result).toEqual({ error: 'Person ikke fundet' })
  })

  it('afviser ugyldig andel over 100', async () => {
    const result = await addPersonOwnership({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      sharePercent: 101,
    })
    expect('error' in result).toBe(true)
  })

  it('afviser ugyldig andel på 0', async () => {
    const result = await addPersonOwnership({
      personId: PERSON_ID,
      companyId: COMPANY_ID,
      sharePercent: 0,
    })
    expect('error' in result).toBe(true)
  })
})
