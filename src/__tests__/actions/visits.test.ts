import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    visit: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    company: { findMany: vi.fn() },
    userRoleAssignment: { findMany: vi.fn() },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(),
  getAccessibleCompanies: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi
    .fn()
    .mockReturnValue({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { auth } from '@/lib/auth'
import { canAccessCompany, getAccessibleCompanies } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import {
  getVisitDetailPageData,
  getVisitTitle,
  getVisitNewPageCompanies,
  createVisit,
  updateVisit,
  deleteVisit,
} from '@/actions/visits'

function makeSession() {
  return {
    user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
    expires: '',
  }
}

const baseVisit = {
  id: 'v1',
  organization_id: 'org-1',
  company_id: 'c1',
  visited_by: 'u1',
  visit_date: new Date('2025-06-15'),
  visit_type: 'KVARTALSBESOEG',
  status: 'PLANLAGT',
  notes: null,
  summary: null,
  created_at: new Date(),
  deleted_at: null,
  company: { id: 'c1', name: 'Klinik A' },
  visitor: { id: 'u1', name: 'Test User' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false } as any)
})

// ─── getVisitDetailPageData ────────────────────────────────────────────────────
describe('getVisitDetailPageData', () => {
  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getVisitDetailPageData('v1')
    expect(result).toBeNull()
  })

  it('returnerer null hvis besøg ikke eksisterer', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(null)
    prismaMock.userRoleAssignment.findMany.mockResolvedValue([])
    const result = await getVisitDetailPageData('v1')
    expect(result).toBeNull()
  })

  it('returnerer null uden company-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(baseVisit)
    prismaMock.userRoleAssignment.findMany.mockResolvedValue([])
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await getVisitDetailPageData('v1')
    expect(result).toBeNull()
  })

  it('returnerer visit-data (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(baseVisit)
    prismaMock.userRoleAssignment.findMany.mockResolvedValue([{ role: 'GROUP_OWNER' }])
    vi.mocked(canAccessCompany).mockResolvedValue(true)

    const result = await getVisitDetailPageData('v1')

    expect(result).not.toBeNull()
    expect(result?.visit.id).toBe('v1')
    expect(result?.canReopen).toBe(true)
  })

  it('canReopen er false for ikke-admin roller', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(baseVisit)
    prismaMock.userRoleAssignment.findMany.mockResolvedValue([{ role: 'GROUP_READONLY' }])
    vi.mocked(canAccessCompany).mockResolvedValue(true)

    const result = await getVisitDetailPageData('v1')
    expect(result?.canReopen).toBe(false)
  })
})

// ─── getVisitTitle ─────────────────────────────────────────────────────────────
describe('getVisitTitle', () => {
  it('returnerer "Besøg" uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getVisitTitle('v1')
    expect(result).toBe('Besøg')
  })

  it('returnerer "Besøg" hvis visit ikke eksisterer', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(null)
    const result = await getVisitTitle('v1')
    expect(result).toBe('Besøg')
  })

  it('returnerer formateret titel (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue({
      visit_date: new Date('2025-06-15'),
      company: { name: 'Klinik A' },
    })
    const result = await getVisitTitle('v1')
    expect(result).toBe('Besøg · Klinik A · 2025-06-15')
  })
})

// ─── getVisitNewPageCompanies ──────────────────────────────────────────────────
describe('getVisitNewPageCompanies', () => {
  it('returnerer tomt array uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getVisitNewPageCompanies()
    expect(result).toEqual([])
  })

  it('returnerer tomt array ved ingen tilgængelige selskaber', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue([])
    const result = await getVisitNewPageCompanies()
    expect(result).toEqual([])
  })

  it('returnerer liste af selskaber (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(getAccessibleCompanies).mockResolvedValue(['c1'])
    prismaMock.company.findMany.mockResolvedValue([{ id: 'c1', name: 'Klinik A' }])

    const result = await getVisitNewPageCompanies()
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('Klinik A')
  })
})

// ─── createVisit ──────────────────────────────────────────────────────────────
describe('createVisit', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createVisit({
      companyId: 'c1',
      visitDate: '2025-06-15',
      visitType: 'KVARTALSBESOEG',
    })
    expect(result).toMatchObject({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl uden company-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await createVisit({
      companyId: 'c1',
      visitDate: '2025-06-15',
      visitType: 'KVARTALSBESOEG',
    })
    expect(result).toMatchObject({ error: 'Ingen adgang til dette selskab' })
  })

  it('returnerer fejl ved rate limit', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as any)
    const result = await createVisit({
      companyId: 'c1',
      visitDate: '2025-06-15',
      visitType: 'KVARTALSBESOEG',
    })
    expect(result).toMatchObject({ error: 'For mange handlinger. Vent venligst.' })
  })

  it('opretter besøg (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.visit.create.mockResolvedValue({ id: 'v-new' })

    const result = await createVisit({
      companyId: 'c1',
      visitDate: '2025-06-15',
      visitType: 'KVARTALSBESOEG',
    })
    expect(result).toMatchObject({ data: { id: 'v-new' } })
  })

  it('returnerer fejl ved DB-fejl', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.visit.create.mockRejectedValue(new Error('DB'))

    const result = await createVisit({
      companyId: 'c1',
      visitDate: '2025-06-15',
      visitType: 'KVARTALSBESOEG',
    })
    expect(result).toMatchObject({ error: 'Besøget kunne ikke oprettes — prøv igen' })
  })
})

// ─── updateVisit ──────────────────────────────────────────────────────────────
describe('updateVisit', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateVisit({ visitId: 'v1', notes: 'test' })
    expect(result).toMatchObject({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl hvis besøg ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(null)
    const result = await updateVisit({ visitId: 'v1', notes: 'test' })
    expect(result).toMatchObject({ error: 'Besøg ikke fundet' })
  })

  it('returnerer fejl uden company-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(baseVisit)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await updateVisit({ visitId: 'v1', notes: 'test' })
    expect(result).toMatchObject({ error: 'Ingen adgang til dette selskab' })
  })

  it('opdaterer besøg (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(baseVisit)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.visit.update.mockResolvedValue({ id: 'v1' })

    const result = await updateVisit({ visitId: 'v1', notes: 'Gik godt' })
    expect(result).toMatchObject({ data: { id: 'v1' } })
  })
})

// ─── deleteVisit ──────────────────────────────────────────────────────────────
describe('deleteVisit', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await deleteVisit('v1')
    expect(result).toMatchObject({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl hvis besøg ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(null)
    const result = await deleteVisit('v1')
    expect(result).toMatchObject({ error: 'Besøg ikke fundet' })
  })

  it('returnerer fejl uden company-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(baseVisit)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await deleteVisit('v1')
    expect('error' in result).toBe(true)
  })

  it('sletter besøg (soft delete, happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.visit.findFirst.mockResolvedValue(baseVisit)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.visit.update.mockResolvedValue({ id: 'v1' })

    const result = await deleteVisit('v1')
    expect(result).toMatchObject({ data: undefined })
    expect(prismaMock.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deleted_at: expect.any(Date) }) })
    )
  })
})
