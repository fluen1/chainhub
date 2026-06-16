import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    company: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    case: { findMany: vi.fn() },
    person: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    document: { findMany: vi.fn() },
    companyNote: { findMany: vi.fn() },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn(),
  canAccessSensitivity: vi.fn(),
}))

import { runSearch } from '@/actions/search'
import { auth } from '@/lib/auth'
import { getAccessibleCompanies, canAccessSensitivity } from '@/lib/permissions'

function makeSession() {
  return {
    user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
    expires: '',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.company.findMany.mockResolvedValue([])
  prismaMock.contract.findMany.mockResolvedValue([])
  prismaMock.case.findMany.mockResolvedValue([])
  prismaMock.person.findMany.mockResolvedValue([])
  prismaMock.task.findMany.mockResolvedValue([])
  prismaMock.document.findMany.mockResolvedValue([])
  prismaMock.companyNote.findMany.mockResolvedValue([])
  vi.mocked(canAccessSensitivity).mockResolvedValue(true)
})

describe('runSearch', () => {
  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await runSearch('test')
    expect(result).toBeNull()
  })

  it('returnerer null ved for kort søgeterm (under MIN_SEARCH_LENGTH)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1'])
    // MIN_SEARCH_LENGTH = 2, så 1 tegn er for kort
    const result = await runSearch('x')
    expect(result).toBeNull()
  })

  it('returnerer tomt resultat ved ingen tilgængelige selskaber', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue([])
    const result = await runSearch('klinik')
    expect(result).not.toBeNull()
    expect(result?.totalCount).toBe(0)
    expect(result?.companies).toEqual([])
  })

  it('returnerer søgeresultater (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1'])

    prismaMock.company.findMany.mockResolvedValue([
      { id: 'c1', name: 'Klinik A', cvr: '12345678', city: 'Aarhus', status: 'aktiv' },
    ])
    prismaMock.contract.findMany.mockResolvedValue([
      {
        id: 'ct1',
        display_name: 'Lejekontrakt',
        system_type: 'LEJE',
        status: 'AKTIV',
        company: { id: 'c1', name: 'Klinik A' },
      },
    ])
    prismaMock.person.findMany.mockResolvedValue([
      { id: 'p1', first_name: 'Anders', last_name: 'Jensen', email: 'anders@test.dk', phone: null },
    ])

    const result = await runSearch('klinik')

    expect(result).not.toBeNull()
    expect(result?.query).toBe('klinik')
    expect(result?.companies).toHaveLength(1)
    expect(result?.companies[0]!.name).toBe('Klinik A')
    expect(result?.contracts).toHaveLength(1)
    expect(result?.persons).toHaveLength(1)
    expect(result?.totalCount).toBe(3)
  })

  it('returnerer null ved tom query', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    const result = await runSearch('')
    expect(result).toBeNull()
  })

  it('truncerer lange noter til 120 tegn + ellipsis', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1'])

    const longContent = 'a'.repeat(200)
    prismaMock.companyNote.findMany.mockResolvedValue([
      {
        id: 'n1',
        content: longContent,
        created_at: new Date(),
        company: { id: 'c1', name: 'Klinik A' },
      },
    ])

    const result = await runSearch('klinik')
    expect(result?.notes[0]!.content.endsWith('…')).toBe(true)
    expect(result?.notes[0]!.content.length).toBe(121) // 120 + ellipsis
  })

  it('mapper dokument med null company korrekt', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1'])

    prismaMock.document.findMany.mockResolvedValue([
      { id: 'd1', title: 'Årsrapport', file_name: 'rapport.pdf', company: null },
    ])

    const result = await runSearch('rapport')
    expect(result?.documents[0]!.companyId).toBeNull()
    expect(result?.documents[0]!.companyName).toBeNull()
  })
})
