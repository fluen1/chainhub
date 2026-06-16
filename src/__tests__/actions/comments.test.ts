import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

const prismaMock = vi.hoisted(() => ({
  task: { findFirst: vi.fn() },
  case: { findFirst: vi.fn() },
  comment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createComment, createCaseComment, deleteComment } from '@/actions/comments'
import { auth } from '@/lib/auth'
import { canAccessCompany } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'

const mockSession = {
  user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '',
}

const validTaskId = '00000000-0000-0000-0000-000000000001'
const validCaseId = '00000000-0000-0000-0000-000000000002'
const validCompanyId = '00000000-0000-0000-0000-000000000003'
const validCommentId = 'comment-1'

const fakeTask = {
  id: validTaskId,
  organization_id: 'org-1',
  deleted_at: null,
}

const fakeCase = {
  id: validCaseId,
  organization_id: 'org-1',
  deleted_at: null,
  sensitivity: 'STANDARD',
  case_companies: [{ company_id: validCompanyId }],
}

const fakeComment = {
  id: validCommentId,
  organization_id: 'org-1',
  task_id: validTaskId,
  case_id: null,
  content: 'Test kommentar',
  created_by: 'u1',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(mockSession as never)
  vi.mocked(canAccessCompany).mockResolvedValue(true)
  vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false } as never)
})

// ---------------------------------------------------------------------------
// createComment (task)
// ---------------------------------------------------------------------------

describe('createComment', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await createComment({ content: 'Hej', taskId: validTaskId })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/session/)
  })

  it('returnerer fejl ved tomt indhold', async () => {
    const result = await createComment({ content: '', taskId: validTaskId })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl ved manglende taskId', async () => {
    const result = await createComment({ content: 'Hej', taskId: '' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl når task ikke eksisterer', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null)
    const result = await createComment({ content: 'Hej', taskId: validTaskId })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/Opgave/)
  })

  it('returnerer fejl ved rate limit', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTask)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as never)
    const result = await createComment({ content: 'Hej', taskId: validTaskId })
    expect('error' in result).toBe(true)
  })

  it('happy path — opretter kommentar', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTask)
    prismaMock.comment.create.mockResolvedValue(fakeComment)

    const result = await createComment({ content: 'Test kommentar', taskId: validTaskId })
    expect('data' in result).toBe(true)
    if ('data' in result) expect((result.data as { id: string }).id).toBe(validCommentId)
  })
})

// ---------------------------------------------------------------------------
// createCaseComment
// ---------------------------------------------------------------------------

describe('createCaseComment', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await createCaseComment({ content: 'Hej', caseId: validCaseId })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/session/)
  })

  it('returnerer fejl ved tomt indhold', async () => {
    const result = await createCaseComment({ content: '', caseId: validCaseId })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl ved manglende caseId', async () => {
    const result = await createCaseComment({ content: 'Hej', caseId: '' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl når sag ikke eksisterer', async () => {
    prismaMock.case.findFirst.mockResolvedValue(null)
    const result = await createCaseComment({ content: 'Hej', caseId: validCaseId })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/Sag/)
  })

  it('returnerer fejl uden adgang til tilknyttede selskaber', async () => {
    prismaMock.case.findFirst.mockResolvedValue(fakeCase)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await createCaseComment({ content: 'Hej', caseId: validCaseId })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/adgang/)
  })

  it('returnerer fejl ved rate limit', async () => {
    prismaMock.case.findFirst.mockResolvedValue(fakeCase)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as never)
    const result = await createCaseComment({ content: 'Hej', caseId: validCaseId })
    expect('error' in result).toBe(true)
  })

  it('happy path — opretter sags-kommentar', async () => {
    prismaMock.case.findFirst.mockResolvedValue(fakeCase)
    prismaMock.comment.create.mockResolvedValue({
      ...fakeComment,
      task_id: null,
      case_id: validCaseId,
      id: 'case-comment-1',
    })

    const result = await createCaseComment({ content: 'Test kommentar', caseId: validCaseId })
    expect('data' in result).toBe(true)
    if ('data' in result) expect((result.data as { id: string }).id).toBe('case-comment-1')
  })

  it('håndterer sag uden tilknyttede selskaber — adgang tillades (tom loop)', async () => {
    prismaMock.case.findFirst.mockResolvedValue({ ...fakeCase, case_companies: [] })
    // No companies → hasAccess stays false
    const result = await createCaseComment({ content: 'Hej', caseId: validCaseId })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/adgang/)
  })
})

// ---------------------------------------------------------------------------
// deleteComment
// ---------------------------------------------------------------------------

describe('deleteComment', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await deleteComment(validCommentId)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/session/)
  })

  it('returnerer fejl når kommentar ikke eksisterer', async () => {
    prismaMock.comment.findFirst.mockResolvedValue(null)
    const result = await deleteComment(validCommentId)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/Kommentar/)
  })

  it('returnerer fejl når bruger ikke er forfatter', async () => {
    prismaMock.comment.findFirst.mockResolvedValue({
      ...fakeComment,
      created_by: 'another-user',
    })
    const result = await deleteComment(validCommentId)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/egne/)
  })

  it('returnerer fejl ved rate limit', async () => {
    prismaMock.comment.findFirst.mockResolvedValue(fakeComment)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as never)
    const result = await deleteComment(validCommentId)
    expect('error' in result).toBe(true)
  })

  it('happy path — soft-sletter kommentar', async () => {
    prismaMock.comment.findFirst.mockResolvedValue(fakeComment)
    prismaMock.comment.update.mockResolvedValue({ ...fakeComment, deleted_at: new Date() })

    const result = await deleteComment(validCommentId)
    expect('data' in result).toBe(true)
    if ('data' in result) expect(result.data).toBeNull()
    expect(prismaMock.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validCommentId },
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      })
    )
  })

  it('happy path med case_id — revaliderer case-sti', async () => {
    const { revalidatePath } = await import('next/cache')
    prismaMock.comment.findFirst.mockResolvedValue({
      ...fakeComment,
      task_id: null,
      case_id: validCaseId,
    })
    prismaMock.comment.update.mockResolvedValue({
      ...fakeComment,
      task_id: null,
      case_id: validCaseId,
      deleted_at: new Date(),
    })

    await deleteComment(validCommentId)
    expect(revalidatePath).toHaveBeenCalledWith(`/cases/${validCaseId}`)
  })
})
