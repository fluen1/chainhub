import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    case: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'case-1', status: 'LUKKET' }),
    },
    caseCompany: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    comment: {
      create: vi.fn().mockResolvedValue({ id: 'comment-1' }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ name: 'Test Bruger', email: 'test@test.dk' }),
    },
    companyInsightsCache: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
}))

vi.mock('@/lib/ai/invalidate-cache', () => ({
  invalidateCompanyInsightsCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { closeCase, escalateCase, updateCase } from '@/actions/cases'

const UUID_1 = 'a1b2c3d4-e5f6-4789-9abc-def012345678'
const UUID_COMPANY = 'c1d2e3f4-a5b6-4789-9abc-def012345678'

// Hjælper: mock en aktiv sag med tilknyttet selskab
function mockActiveCase() {
  return {
    id: UUID_1,
    status: 'AKTIV',
    sensitivity: 'INTERN' as const,
    case_companies: [{ company_id: UUID_COMPANY }],
  }
}

// ─── closeCase ────────────────────────────────────────────────────────────────

describe('closeCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: lukker aktiv sag og logger audit', async () => {
    const { prisma } = await import('@/lib/db')
    const audit = await import('@/lib/audit')
    vi.mocked(prisma.case.findFirst).mockResolvedValueOnce(mockActiveCase() as never)
    // update-mock returnerer 'case-1' — det er det ID der sendes til audit
    vi.mocked(prisma.case.update).mockResolvedValueOnce({ id: 'case-1', status: 'LUKKET' } as never)

    const result = await closeCase(UUID_1, 'Afsluttet planmæssigt')

    expect('data' in result).toBe(true)
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CLOSE' })
    )
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)

    const result = await closeCase(UUID_1)

    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser uden modul-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)

    const result = await closeCase(UUID_1)

    expect('error' in result).toBe(true)
  })

  it('afviser sag fra anden tenant (not found)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockResolvedValueOnce(null)

    const result = await closeCase(UUID_1)

    expect(result).toEqual({ error: 'Sag ikke fundet' })
  })

  it('afviser allerede lukket sag', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockResolvedValueOnce({
      ...mockActiveCase(),
      status: 'LUKKET',
    } as never)

    const result = await closeCase(UUID_1)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/allerede lukket/)
  })

  it('afviser uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    const perms = await import('@/lib/permissions')
    vi.mocked(prisma.case.findFirst).mockResolvedValueOnce(mockActiveCase() as never)
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)

    const result = await closeCase(UUID_1)

    expect('error' in result).toBe(true)
  })

  it('afviser for lang note', async () => {
    const result = await closeCase(UUID_1, 'x'.repeat(501))
    expect('error' in result).toBe(true)
  })
})

// ─── escalateCase ─────────────────────────────────────────────────────────────

describe('escalateCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: opretter eskalerings-kommentar og audit-log', async () => {
    const { prisma } = await import('@/lib/db')
    const audit = await import('@/lib/audit')
    vi.mocked(prisma.case.findFirst).mockResolvedValueOnce(mockActiveCase() as never)

    const result = await escalateCase(UUID_1)

    expect('data' in result).toBe(true)
    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          case_id: UUID_1,
          content: expect.stringContaining('Eskaleret'),
        }),
      })
    )
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ESCALATE', resourceId: UUID_1 })
    )
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)

    const result = await escalateCase(UUID_1)

    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser lukket sag', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockResolvedValueOnce({
      ...mockActiveCase(),
      status: 'LUKKET',
    } as never)

    const result = await escalateCase(UUID_1)

    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis sag ikke findes (wrong tenant)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockResolvedValueOnce(null)

    const result = await escalateCase(UUID_1)

    expect('error' in result).toBe(true)
  })
})

// ─── updateCase ───────────────────────────────────────────────────────────────

describe('updateCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: opdaterer titel og description', async () => {
    const { prisma } = await import('@/lib/db')
    const audit = await import('@/lib/audit')
    vi.mocked(prisma.case.findFirst).mockResolvedValueOnce(mockActiveCase() as never)
    vi.mocked(prisma.case.update).mockResolvedValueOnce({ id: UUID_1 } as never)

    const result = await updateCase({
      caseId: UUID_1,
      title: 'Ny titel',
      description: 'Ny beskrivelse',
    })

    expect('data' in result).toBe(true)
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', resourceId: UUID_1 })
    )
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)

    const result = await updateCase({ caseId: UUID_1, title: 'Test' })

    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser tom titel', async () => {
    const result = await updateCase({ caseId: UUID_1, title: '' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis sag ikke tilhører tenant', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockResolvedValueOnce(null)

    const result = await updateCase({ caseId: UUID_1, title: 'Test' })

    expect('error' in result).toBe(true)
  })
})
