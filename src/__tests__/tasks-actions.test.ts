import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTx = {
  task: { update: vi.fn().mockResolvedValue({ id: 't-1' }) },
  taskHistory: { create: vi.fn().mockResolvedValue({}) },
}

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      create: vi.fn().mockResolvedValue({ id: 't-1' }),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 't-1' }),
    },
    user: { findFirst: vi.fn() },
    $transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createTask,
  updateTaskStatus,
  updateTaskPriority,
  updateTaskAssignee,
  updateTaskDueDate,
  deleteTask,
} from '@/actions/tasks'

const UUID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('createTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path opretter opgave', async () => {
    const result = await createTask({
      title: 'Test',
      priority: 'MELLEM',
      companyId: UUID,
    } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await createTask({ title: 'Test', priority: 'MELLEM' } as never)
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser uden company-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await createTask({
      title: 'Test',
      priority: 'MELLEM',
      companyId: UUID,
    } as never)
    expect('error' in result).toBe(true)
  })

  it('afviser tom titel', async () => {
    const result = await createTask({ title: '', priority: 'MELLEM' } as never)
    expect('error' in result).toBe(true)
  })
})

describe('updateTaskStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('valid change opdaterer + logger history', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, status: 'NY', case_id: null })) as never)
    const result = await updateTaskStatus({ taskId: UUID, status: 'AKTIV_TASK' } as never)
    expect('data' in result).toBe(true)
    expect(mockTx.taskHistory.create).toHaveBeenCalled()
  })

  it('same-status no-op returnerer task uden update', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, status: 'NY', case_id: null })) as never)
    const result = await updateTaskStatus({ taskId: UUID, status: 'NY' } as never)
    expect('data' in result).toBe(true)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returnerer fejl hvis task ikke fundet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateTaskStatus({ taskId: UUID, status: 'AKTIV_TASK' } as never)
    expect('error' in result).toBe(true)
  })

  it('transaction kører status + history atomisk', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, status: 'NY', case_id: null })) as never)
    await updateTaskStatus({ taskId: UUID, status: 'AKTIV_TASK' } as never)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(mockTx.task.update).toHaveBeenCalled()
  })
})

describe('updateTaskPriority', () => {
  beforeEach(() => vi.clearAllMocks())

  it('change opdaterer + logger history', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, priority: 'LAV' })) as never)
    const result = await updateTaskPriority({ taskId: UUID, priority: 'HOEJ' } as never)
    expect('data' in result).toBe(true)
  })

  it('same priority no-op', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, priority: 'HOEJ' })) as never)
    const result = await updateTaskPriority({ taskId: UUID, priority: 'HOEJ' } as never)
    expect('data' in result).toBe(true)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returnerer fejl hvis task ikke fundet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateTaskPriority({ taskId: UUID, priority: 'HOEJ' } as never)
    expect('error' in result).toBe(true)
  })
})

describe('updateTaskAssignee', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assign opdaterer + slår nyt navn op', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, assigned_to: null, assignee: null })) as never)
    vi.mocked(prisma.user.findFirst).mockImplementation((() =>
      Promise.resolve({ name: 'Bob' })) as never)
    const result = await updateTaskAssignee({ taskId: UUID, assignedTo: UUID } as never)
    expect('data' in result).toBe(true)
  })

  it('same assignee no-op', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, assigned_to: UUID, assignee: { name: 'Bob' } })) as never)
    const result = await updateTaskAssignee({ taskId: UUID, assignedTo: UUID } as never)
    expect('data' in result).toBe(true)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('unassign (null) opdaterer assigned_to=null', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, assigned_to: UUID, assignee: { name: 'Bob' } })) as never)
    const result = await updateTaskAssignee({ taskId: UUID, assignedTo: null } as never)
    expect('data' in result).toBe(true)
  })

  it('afviser hvis valgt bruger ikke fundet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, assigned_to: null, assignee: null })) as never)
    vi.mocked(prisma.user.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateTaskAssignee({ taskId: UUID, assignedTo: UUID } as never)
    expect('error' in result).toBe(true)
  })
})

describe('updateTaskDueDate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ny dato opdaterer + history', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, due_date: null })) as never)
    const result = await updateTaskDueDate({ taskId: UUID, dueDate: '2026-05-01' } as never)
    expect('data' in result).toBe(true)
  })

  it('clear dato opdaterer due_date=null', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, due_date: new Date('2026-05-01') })) as never)
    const result = await updateTaskDueDate({ taskId: UUID, dueDate: null } as never)
    expect('data' in result).toBe(true)
  })

  it('same dato no-op', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, due_date: new Date('2026-05-01') })) as never)
    const result = await updateTaskDueDate({ taskId: UUID, dueDate: '2026-05-01' } as never)
    expect('data' in result).toBe(true)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returnerer fejl hvis task ikke fundet', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() => Promise.resolve(null)) as never)
    const result = await updateTaskDueDate({ taskId: UUID, dueDate: '2026-05-01' } as never)
    expect('error' in result).toBe(true)
  })
})

describe('deleteTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creator kan slette uden ekstra check', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, created_by: 'user-1', company_id: UUID })) as never)
    const result = await deleteTask(UUID)
    expect('data' in result).toBe(true)
  })

  it('non-creator med company-adgang kan slette', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, created_by: 'andet-user', company_id: UUID })) as never)
    const result = await deleteTask(UUID)
    expect('data' in result).toBe(true)
  })

  it('non-creator uden company-adgang afvises', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.task.findFirst).mockImplementation((() =>
      Promise.resolve({ id: UUID, created_by: 'andet-user', company_id: UUID })) as never)
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessCompany).mockResolvedValueOnce(false)
    const result = await deleteTask(UUID)
    expect('error' in result).toBe(true)
  })
})
