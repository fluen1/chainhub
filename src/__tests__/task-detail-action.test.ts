import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
    company: { findFirst: vi.fn().mockResolvedValue({ id: 'c-1', name: 'Acme' }) },
    contract: { findFirst: vi.fn().mockResolvedValue(null) },
    comment: { findMany: vi.fn().mockResolvedValue([]) },
    taskHistory: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([{ id: 'u-1', name: 'Bob' }]) },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/task-detail/helpers', () => ({
  deriveTaskUrgency: vi.fn(() => 'NORMAL'),
  formatHistoryEntry: vi.fn((h) => h),
}))

import { getTaskDetailData } from '@/actions/task-detail'

const UUID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

const baseTask = {
  id: UUID,
  title: 'Test',
  description: null,
  status: 'OPEN',
  priority: 'NORMAL',
  due_date: null,
  created_at: new Date(),
  created_by: 'user-1',
  company_id: UUID,
  contract_id: null,
  case: null,
  assignee: null,
}

describe('getTaskDetailData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path returnerer fuldt objekt', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() => Promise.resolve(baseTask)) as never)
    const result = await getTaskDetailData(UUID, 'user-1', 'org-1')
    expect(result).not.toBeNull()
    expect(result!.task.id).toBe(UUID)
    expect(result!.availableAssignees.length).toBe(1)
  })

  it('returnerer null hvis task ikke fundet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await getTaskDetailData(UUID, 'user-1', 'org-1')
    expect(result).toBeNull()
  })

  it('returnerer null uden company-adgang', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() => Promise.resolve(baseTask)) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await getTaskDetailData(UUID, 'user-1', 'org-1')
    expect(result).toBeNull()
  })

  it('parallel batch henter alle 5 typer', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() => Promise.resolve(baseTask)) as never)
    await getTaskDetailData(UUID, 'user-1', 'org-1')
    expect(prisma.company.findFirst).toHaveBeenCalled()
    expect(prisma.comment.findMany).toHaveBeenCalled()
    expect(prisma.taskHistory.findMany).toHaveBeenCalled()
    expect(prisma.user.findMany).toHaveBeenCalled()
  })

  it('comments + history capped ved 50', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() => Promise.resolve(baseTask)) as never)
    await getTaskDetailData(UUID, 'user-1', 'org-1')
    const commentsCall = vi.mocked(prisma.comment.findMany).mock.calls[0]
    const historyCall = vi.mocked(prisma.taskHistory.findMany).mock.calls[0]
    expect(commentsCall![0]?.take).toBe(50)
    expect(historyCall![0]?.take).toBe(50)
  })
})
