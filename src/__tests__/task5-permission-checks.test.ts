/**
 * Task 5 — Manglende permission-checks (TDD)
 * - updateCaseStatus: canAccessCompany + canAccessSensitivity
 * - createCaseComment: canAccessSensitivity
 * - createComment (task): canAccessCompany
 * - createPerson / updatePerson: canAccessModule('persons')
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks (vi.mock + vi.hoisted er hoisted til toppen) ───────────────

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    case: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    caseCompany: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    task: {
      findFirst: vi.fn(),
    },
    comment: {
      create: vi.fn(),
    },
    person: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } }),
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessCompanies: vi.fn().mockResolvedValue(new Set(['co-1'])),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['co-1']),
  getAllowedSensitivityLevels: vi
    .fn()
    .mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']),
}))

vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/ai/invalidate-cache', () => ({
  invalidateCompanyInsightsCache: vi.fn().mockResolvedValue(undefined),
}))

// ─── Importer actions + mocked deps ──────────────────────────────────────────

import { updateCaseStatus } from '@/actions/cases'
import { createCaseComment, createComment } from '@/actions/comments'
import { createPerson, updatePerson } from '@/actions/persons'
import { canAccessCompany, canAccessSensitivity, canAccessModule } from '@/lib/permissions'

// ─── updateCaseStatus — company + sensitivity (Task 5 Step 1+2) ──────────────

describe('updateCaseStatus — company + sensitivity checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.case.update.mockResolvedValue({ id: 'case-1', status: 'AKTIV' })
  })

  it('afviser når brugeren mangler company-adgang', async () => {
    prismaMock.case.findFirst.mockResolvedValue({
      id: 'case-1',
      status: 'NY',
      sensitivity: 'STRENGT_FORTROLIG',
      case_companies: [{ company_id: 'co-1' }],
    })
    vi.mocked(canAccessCompany).mockResolvedValue(false)

    const res = await updateCaseStatus({ caseId: 'case-1', status: 'AKTIV' })

    expect(res).toEqual({ error: 'Ingen adgang til denne sag' })
    expect(prismaMock.case.update).not.toHaveBeenCalled()
  })

  it('afviser når sensitivity er for høj (selvom company-adgang er ok)', async () => {
    prismaMock.case.findFirst.mockResolvedValue({
      id: 'case-1',
      status: 'NY',
      sensitivity: 'STRENGT_FORTROLIG',
      case_companies: [{ company_id: 'co-1' }],
    })
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)

    const res = await updateCaseStatus({ caseId: 'case-1', status: 'AKTIV' })

    expect(res).toEqual({ error: 'Ingen adgang til denne sag' })
    expect(prismaMock.case.update).not.toHaveBeenCalled()
  })

  it('tillader gyldig transition med fuld adgang', async () => {
    prismaMock.case.findFirst.mockResolvedValue({
      id: 'case-1',
      status: 'NY',
      sensitivity: 'STANDARD',
      case_companies: [{ company_id: 'co-1' }],
    })

    const res = await updateCaseStatus({ caseId: 'case-1', status: 'AKTIV' })

    expect('data' in res).toBe(true)
    expect(prismaMock.case.update).toHaveBeenCalled()
  })
})

// ─── createCaseComment — sensitivity check (Task 5 Step 3+4) ─────────────────

describe('createCaseComment — sensitivity check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(canAccessCompany).mockResolvedValue(true)
    vi.mocked(canAccessSensitivity).mockResolvedValue(true)
  })

  it('afviser når sensitivity for høj selvom company-adgang findes', async () => {
    prismaMock.case.findFirst.mockResolvedValue({
      id: 'case-1',
      sensitivity: 'STRENGT_FORTROLIG',
      case_companies: [{ company_id: 'co-1' }],
    })
    vi.mocked(canAccessSensitivity).mockResolvedValue(false)

    const res = await createCaseComment({ content: 'x', caseId: 'case-1' })

    expect(res).toEqual({ error: 'Ingen adgang til denne sag' })
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it('tillader kommentar med fuld adgang', async () => {
    prismaMock.case.findFirst.mockResolvedValue({
      id: 'case-1',
      sensitivity: 'STANDARD',
      case_companies: [{ company_id: 'co-1' }],
    })
    prismaMock.comment.create.mockResolvedValue({ id: 'comment-1' })

    const res = await createCaseComment({ content: 'god kommentar', caseId: 'case-1' })

    expect('data' in res).toBe(true)
    expect(prismaMock.comment.create).toHaveBeenCalled()
  })
})

// ─── createComment (task) — company-check (Task 5 Step 5) ────────────────────

describe('createComment (task) — company-check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(canAccessCompany).mockResolvedValue(true)
  })

  it('afviser når bruger mangler company-adgang til opgave', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 'task-1',
      organization_id: 'org-1',
      deleted_at: null,
      company_id: 'co-1',
    })
    vi.mocked(canAccessCompany).mockResolvedValue(false)

    const res = await createComment({ content: 'x', taskId: 'task-1' })

    expect(res).toEqual({ error: 'Ingen adgang til denne opgave' })
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it('tillades når task ikke har company_id (ingen scope-tjek)', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 'task-1',
      organization_id: 'org-1',
      deleted_at: null,
      company_id: null,
    })
    prismaMock.comment.create.mockResolvedValue({ id: 'c1' })

    const res = await createComment({ content: 'x', taskId: 'task-1' })

    expect('data' in res).toBe(true)
  })

  it('tillades med company_id og fuld adgang', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 'task-1',
      organization_id: 'org-1',
      deleted_at: null,
      company_id: 'co-1',
    })
    prismaMock.comment.create.mockResolvedValue({ id: 'c2' })

    const res = await createComment({ content: 'x', taskId: 'task-1' })

    expect('data' in res).toBe(true)
  })
})

// ─── createPerson / updatePerson — canAccessModule('persons') (Task 5 Step 6+7) ─

describe('createPerson / updatePerson — canAccessModule persons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.person.create.mockResolvedValue({ id: 'p1', first_name: 'A', last_name: 'B' })
    prismaMock.person.findFirst.mockResolvedValue({ id: 'p1' })
    prismaMock.person.update.mockResolvedValue({ id: 'p1' })
  })

  it('createPerson afviser uden persons-modul-adgang', async () => {
    vi.mocked(canAccessModule).mockResolvedValue(false)

    const res = await createPerson({ firstName: 'A', lastName: 'B' })

    expect(res).toEqual({ error: 'Du har ikke adgang til persondatabasen' })
    expect(prismaMock.person.create).not.toHaveBeenCalled()
  })

  it('updatePerson afviser uden persons-modul-adgang', async () => {
    vi.mocked(canAccessModule).mockResolvedValue(false)

    const res = await updatePerson({ personId: 'p1', firstName: 'Ny' })

    expect(res).toEqual({ error: 'Du har ikke adgang til persondatabasen' })
    expect(prismaMock.person.update).not.toHaveBeenCalled()
  })

  it('createPerson opretter med persons-modul-adgang', async () => {
    const res = await createPerson({ firstName: 'A', lastName: 'B' })
    expect('data' in res).toBe(true)
    expect(prismaMock.person.create).toHaveBeenCalled()
  })

  it('updatePerson opdaterer med persons-modul-adgang', async () => {
    const res = await updatePerson({ personId: 'p1', firstName: 'Ny' })
    expect('data' in res).toBe(true)
    expect(prismaMock.person.update).toHaveBeenCalled()
  })
})
