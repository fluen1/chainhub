import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
    case: { findFirst: vi.fn() },
    comment: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'comment-1' }),
      // soft-delete via update (ikke hard delete)
      update: vi.fn().mockResolvedValue({ id: 'comment-1', deleted_at: new Date() }),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createComment, createCaseComment, deleteComment } from '@/actions/comments'

const UUID_TASK = 'a1b2c3d4-e5f6-4789-9abc-def012345678'
const UUID_CASE = 'd4e5f6a7-b8c9-4012-9def-012345678901'
const UUID_COMPANY = 'e5f6a7b8-c9d0-4123-9ef0-123456789012'
const UUID_COMMENT = 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789'

function mockCase() {
  return {
    id: UUID_CASE,
    sensitivity: 'INTERN',
    case_companies: [{ company_id: UUID_COMPANY }],
  }
}

describe('createComment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opretter kommentar', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID_TASK })) as never)
    const result = await createComment({ content: 'Test kommentar', taskId: UUID_TASK })
    expect('data' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await createComment({ content: 'X', taskId: UUID_TASK })
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser tom content', async () => {
    const result = await createComment({ content: '', taskId: UUID_TASK })
    expect('error' in result).toBe(true)
  })

  it('afviser content over 2000 tegn', async () => {
    const result = await createComment({
      content: 'x'.repeat(2001),
      taskId: UUID_TASK,
    })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis opgave ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await createComment({ content: 'X', taskId: UUID_TASK })
    expect('error' in result).toBe(true)
  })
})

describe('createCaseComment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opretter sags-kommentar', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() =>
      Promise.resolve(mockCase())) as never)

    const result = await createCaseComment({ content: 'Test sags-kommentar', caseId: UUID_CASE })
    expect('data' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)

    const result = await createCaseComment({ content: 'Test', caseId: UUID_CASE })
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser sag fra anden tenant (not found)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.case.findFirst).mockImplementation((() => Promise.resolve(null)) as never)

    const result = await createCaseComment({ content: 'Test', caseId: UUID_CASE })
    expect('error' in result).toBe(true)
  })

  it('afviser uden adgang til tilknyttet selskab', async () => {
    const { prisma } = await import('@/lib/db')
    const perms = await import('@/lib/permissions')
    vi.mocked(prisma.case.findFirst).mockImplementation((() =>
      Promise.resolve(mockCase())) as never)
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)

    const result = await createCaseComment({ content: 'Test', caseId: UUID_CASE })
    expect('error' in result).toBe(true)
  })

  it('afviser tom kommentar', async () => {
    const result = await createCaseComment({ content: '', caseId: UUID_CASE })
    expect('error' in result).toBe(true)
  })

  it('afviser kommentar over 2000 tegn', async () => {
    const result = await createCaseComment({ content: 'x'.repeat(2001), caseId: UUID_CASE })
    expect('error' in result).toBe(true)
  })
})

describe('deleteComment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: ejer sletter egen kommentar', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.comment.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID_COMMENT, created_by: 'user-1', task_id: UUID_TASK })) as never)
    const result = await deleteComment(UUID_COMMENT)
    expect('data' in result).toBe(true)
  })

  it('afviser sletning af andens kommentar', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.comment.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID_COMMENT, created_by: 'other-user', task_id: UUID_TASK })) as never)
    const result = await deleteComment(UUID_COMMENT)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis kommentar ikke findes', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.comment.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await deleteComment(UUID_COMMENT)
    expect('error' in result).toBe(true)
  })
})
