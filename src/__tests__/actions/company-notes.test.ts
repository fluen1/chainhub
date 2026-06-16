import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    companyNote: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  getCompanyNotes,
  createCompanyNote,
  updateCompanyNote,
  toggleNotePin,
  deleteCompanyNote,
} from '@/actions/company-notes'
import { auth } from '@/lib/auth'
import { canAccessCompany } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'

function makeSession() {
  return {
    user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
    expires: '',
  }
}

const baseNote = {
  id: 'n1',
  organization_id: 'org-1',
  company_id: 'c1',
  content: 'Test notat',
  pinned: false,
  created_at: new Date(),
  deleted_at: null,
  created_by: 'u1',
  author: { id: 'u1', name: 'Test', email: 'test@test.dk' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false } as any)
})

// ─── getCompanyNotes ───────────────────────────────────────────────────────────
describe('getCompanyNotes', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getCompanyNotes('c1')
    expect(result).toMatchObject({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl uden company-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await getCompanyNotes('c1')
    expect(result).toMatchObject({ error: 'Ingen adgang til dette selskab' })
  })

  it('returnerer notatliste (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.companyNote.findMany.mockResolvedValue([baseNote])

    const result = await getCompanyNotes('c1')
    expect(result).toMatchObject({ data: [{ id: 'n1', content: 'Test notat' }] })
  })

  it('returnerer tomt array hvis ingen noter', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.companyNote.findMany.mockResolvedValue([])

    const result = await getCompanyNotes('c1')
    expect(result).toMatchObject({ data: [] })
  })
})

// ─── createCompanyNote ─────────────────────────────────────────────────────────
describe('createCompanyNote', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createCompanyNote({ companyId: 'c1', content: 'Test' })
    expect(result).toMatchObject({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved tomt indhold', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    const result = await createCompanyNote({ companyId: 'c1', content: '' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden company-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await createCompanyNote({ companyId: 'c1', content: 'Test' })
    expect(result).toMatchObject({ error: 'Ingen adgang til dette selskab' })
  })

  it('returnerer fejl ved rate limit', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as any)
    const result = await createCompanyNote({ companyId: 'c1', content: 'Test' })
    expect(result).toMatchObject({ error: 'For mange handlinger. Vent venligst.' })
  })

  it('opretter notat (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    prismaMock.companyNote.create.mockResolvedValue({ id: 'n-new' })

    const result = await createCompanyNote({ companyId: 'c1', content: 'Nyt notat' })
    expect(result).toMatchObject({ data: { id: 'n-new' } })
  })
})

// ─── updateCompanyNote ─────────────────────────────────────────────────────────
describe('updateCompanyNote', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateCompanyNote({ noteId: 'n1', content: 'Ny tekst' })
    expect(result).toMatchObject({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved tomt indhold', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    const result = await updateCompanyNote({ noteId: 'n1', content: '' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis notat ikke eksisterer', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.companyNote.findFirst.mockResolvedValue(null)
    const result = await updateCompanyNote({ noteId: 'n1', content: 'Ny tekst' })
    expect(result).toMatchObject({ error: 'Notat ikke fundet' })
  })

  it('opdaterer notat (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.companyNote.findFirst.mockResolvedValue(baseNote)
    prismaMock.companyNote.update.mockResolvedValue({ id: 'n1' })

    const result = await updateCompanyNote({ noteId: 'n1', content: 'Opdateret' })
    expect(result).toMatchObject({ data: undefined })
  })
})

// ─── toggleNotePin ─────────────────────────────────────────────────────────────
describe('toggleNotePin', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await toggleNotePin('n1')
    expect(result).toMatchObject({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl hvis notat ikke eksisterer', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.companyNote.findFirst.mockResolvedValue(null)
    const result = await toggleNotePin('n1')
    expect(result).toMatchObject({ error: 'Notat ikke fundet' })
  })

  it('toggler pin-status (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.companyNote.findFirst.mockResolvedValue({ ...baseNote, pinned: false })
    prismaMock.companyNote.update.mockResolvedValue({ id: 'n1', pinned: true })

    const result = await toggleNotePin('n1')
    expect(result).toMatchObject({ data: undefined })
    expect(prismaMock.companyNote.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pinned: true } })
    )
  })
})

// ─── deleteCompanyNote ─────────────────────────────────────────────────────────
describe('deleteCompanyNote', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await deleteCompanyNote('n1')
    expect(result).toMatchObject({ error: 'Din session er udløbet — log ind igen.' })
  })

  it('returnerer fejl ved manglende noteId', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    const result = await deleteCompanyNote('')
    expect(result).toMatchObject({ error: 'Notat-ID mangler' })
  })

  it('returnerer fejl hvis notat ikke eksisterer', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.companyNote.findFirst.mockResolvedValue(null)
    const result = await deleteCompanyNote('n1')
    expect(result).toMatchObject({ error: 'Notat ikke fundet' })
  })

  it('returnerer fejl ved rate limit', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.companyNote.findFirst.mockResolvedValue(baseNote)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as any)
    const result = await deleteCompanyNote('n1')
    expect(result).toMatchObject({ error: 'For mange handlinger. Vent venligst.' })
  })

  it('sletter notat (soft delete, happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    prismaMock.companyNote.findFirst.mockResolvedValue(baseNote)
    prismaMock.companyNote.update.mockResolvedValue({ id: 'n1' })

    const result = await deleteCompanyNote('n1')
    expect(result).toMatchObject({ data: undefined })
    expect(prismaMock.companyNote.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deleted_at: expect.any(Date) }) })
    )
  })
})
