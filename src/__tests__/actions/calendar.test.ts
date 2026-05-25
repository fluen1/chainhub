import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    contract: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    visit: { findMany: vi.fn() },
    case: { findMany: vi.fn() },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  createLogger: vi
    .fn()
    .mockReturnValue({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
  captureError: vi.fn(),
}))
vi.mock('@/lib/labels', () => ({
  getVisitTypeLabel: vi.fn().mockReturnValue('Opfølgningsbesøg'),
}))

import { auth } from '@/lib/auth'
import { getAccessibleCompanies } from '@/lib/permissions'
import { getCalendarEvents } from '@/actions/calendar'

function makeSession() {
  return {
    user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
    expires: '',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.contract.findMany.mockResolvedValue([])
  prismaMock.task.findMany.mockResolvedValue([])
  prismaMock.visit.findMany.mockResolvedValue([])
  prismaMock.case.findMany.mockResolvedValue([])
})

describe('getCalendarEvents', () => {
  it('returnerer tomt array uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getCalendarEvents(2025, 6)
    expect(result).toEqual([])
  })

  it('returnerer tomt array ved ugyldigt år', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1'])
    const result = await getCalendarEvents(2000, 6)
    expect(result).toEqual([])
  })

  it('returnerer tomt array hvis ingen tilgængelige selskaber', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue([])
    const result = await getCalendarEvents(2025, 6)
    expect(result).toEqual([])
  })

  it('returnerer kalender-events fra alle typer (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1'])

    prismaMock.contract.findMany.mockResolvedValue([
      {
        id: 'ct1',
        display_name: 'Lejekontrakt',
        expiry_date: new Date('2025-06-15'),
        company: { name: 'Klinik A' },
      },
    ])
    prismaMock.task.findMany.mockResolvedValue([
      { id: 'tk1', title: 'Tjek regnskab', due_date: new Date('2025-06-10'), company_id: 'c1' },
    ])
    prismaMock.visit.findMany.mockResolvedValue([
      {
        id: 'v1',
        visit_date: new Date('2025-06-20'),
        visit_type: 'OPFOLGNING',
        company: { name: 'Klinik A' },
      },
    ])
    prismaMock.case.findMany.mockResolvedValue([
      { id: 'ca1', title: 'Tvist', due_date: new Date('2025-06-25') },
    ])

    const result = await getCalendarEvents(2025, 6)

    expect(result.length).toBe(4)
    expect(result.find((e) => e.id === 'contract-ct1')).toMatchObject({
      type: 'expiry',
      title: 'Lejekontrakt',
      href: '/contracts/ct1',
    })
    expect(result.find((e) => e.id === 'task-tk1')).toMatchObject({
      type: 'deadline',
      title: 'Tjek regnskab',
    })
    expect(result.find((e) => e.id === 'visit-v1')).toMatchObject({
      type: 'meeting',
    })
    expect(result.find((e) => e.id === 'case-ca1')).toMatchObject({
      type: 'case',
      subtitle: 'Sagsfrist',
    })
  })

  it('sorterer events efter dato', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1'])

    prismaMock.task.findMany.mockResolvedValue([
      { id: 'tk2', title: 'Senere', due_date: new Date('2025-06-20'), company_id: 'c1' },
      { id: 'tk1', title: 'Tidligere', due_date: new Date('2025-06-05'), company_id: 'c1' },
    ])

    const result = await getCalendarEvents(2025, 6)
    expect(result[0]!.date <= result[1]!.date).toBe(true)
  })

  it('springer over contracts/tasks/cases uden dato', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1'])

    prismaMock.contract.findMany.mockResolvedValue([
      { id: 'ct1', display_name: 'Uden dato', expiry_date: null, company: { name: 'A' } },
    ])

    const result = await getCalendarEvents(2025, 6)
    expect(result.find((e) => e.id === 'contract-ct1')).toBeUndefined()
  })
})
