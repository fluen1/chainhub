import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock er hoisted — brug vi.hoisted() til at definere mocks FØR imports
const { prismaMock, txMock, mockTask } = vi.hoisted(() => {
  const mockTask = {
    id: 't1',
    organization_id: 'org-1',
    title: 'Test opgave',
    description: null,
    assigned_to: null,
    due_date: null,
    priority: 'MELLEM' as const,
    status: 'NY' as const,
    case_id: null,
    company_id: 'c1',
    created_by: 'u1',
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    contract_id: null,
    assignee: null,
  }

  // tx-mock bruges inde i $transaction callbacks
  const txMock = {
    task: {
      create: vi.fn().mockResolvedValue(mockTask),
      update: vi.fn().mockResolvedValue(mockTask),
    },
    taskHistory: {
      create: vi.fn().mockResolvedValue({ id: 'th1' }),
    },
  }

  const prismaMock = {
    task: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(mockTask),
      create: vi.fn().mockResolvedValue(mockTask),
      update: vi.fn().mockResolvedValue(mockTask),
      count: vi.fn().mockResolvedValue(0),
    },
    taskHistory: {
      create: vi.fn().mockResolvedValue({ id: 'th1' }),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ name: 'Maria' }),
    },
    $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  }

  return { prismaMock, txMock, mockTask }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue(['c1']),
}))

import {
  createTask,
  updateTaskStatus,
  updateTaskPriority,
  updateTaskAssignee,
  updateTaskDueDate,
  deleteTask,
  getTasksPaginated,
} from '@/actions/tasks'
import { auth } from '@/lib/auth'
import { canAccessCompany } from '@/lib/permissions'

const SESSION = {
  user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(SESSION as never)
  prismaMock.task.findFirst.mockResolvedValue(mockTask)
  prismaMock.task.create.mockResolvedValue(mockTask)
  prismaMock.task.update.mockResolvedValue(mockTask)
  prismaMock.task.count.mockResolvedValue(0)
  prismaMock.task.findMany.mockResolvedValue([])
  prismaMock.company.findMany.mockResolvedValue([])
  prismaMock.user.findFirst.mockResolvedValue({ name: 'Maria' })
  txMock.task.create.mockResolvedValue(mockTask)
  txMock.task.update.mockResolvedValue(mockTask)
  txMock.taskHistory.create.mockResolvedValue({ id: 'th1' })
  prismaMock.$transaction.mockImplementation((fn: (tx: typeof txMock) => Promise<unknown>) =>
    fn(txMock)
  )
  vi.mocked(canAccessCompany).mockResolvedValue(true)
})

// ─── getTasksPaginated ────────────────────────────────────────────────────────

describe('getTasksPaginated', () => {
  it('returnerer tom payload uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getTasksPaginated({})
    expect(result).toEqual({ rows: [], totalCount: 0, page: 1, pageSize: 20 })
  })

  it('inkluderer organization_id i where-klausulen', async () => {
    await getTasksPaginated({})
    const whereArg = prismaMock.task.findMany.mock.calls[0]?.[0]?.where
    expect(whereArg?.organization_id).toBe('org-1')
  })

  it('returnerer rows med korrekt struktur', async () => {
    const taskWithRelations = { ...mockTask, assignee: null, case: null }
    prismaMock.task.findMany.mockResolvedValueOnce([taskWithRelations])
    prismaMock.task.count.mockResolvedValueOnce(1)

    const result = await getTasksPaginated({ page: 1, pageSize: 20 })
    expect(result.totalCount).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ id: 't1', titel: 'Test opgave' })
  })
})

// ─── createTask ───────────────────────────────────────────────────────────────

describe('createTask', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createTask({ title: 'Test', priority: 'MELLEM' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error ved tomt titel', async () => {
    const result = await createTask({ title: '', priority: 'MELLEM' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error uden selskabsadgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValueOnce(false)
    const result = await createTask({ title: 'Test', priority: 'MELLEM', companyId: 'c1' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('opretter task med organization_id', async () => {
    const result = await createTask({ title: 'Test', priority: 'MELLEM' })
    expect(result).toMatchObject({ data: expect.objectContaining({ id: 't1' }) })
    expect(txMock.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organization_id: 'org-1', status: 'NY' }),
      })
    )
  })

  it('opretter TaskHistory ved oprettelse', async () => {
    await createTask({ title: 'Test', priority: 'HOEJ' })
    expect(txMock.taskHistory.create).toHaveBeenCalled()
  })

  it('returnerer error ved rate-limit', async () => {
    const { checkActionRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkActionRateLimit).mockResolvedValueOnce({ limited: true })
    const result = await createTask({ title: 'Test', priority: 'MELLEM' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })
})

// ─── updateTaskStatus ─────────────────────────────────────────────────────────

describe('updateTaskStatus', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateTaskStatus({ taskId: 't1', status: 'AKTIV_TASK' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error når task ikke findes', async () => {
    prismaMock.task.findFirst.mockResolvedValueOnce(null)
    const result = await updateTaskStatus({ taskId: 't-mangler', status: 'AKTIV_TASK' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer task uændret hvis status er den samme', async () => {
    const result = await updateTaskStatus({ taskId: 't1', status: 'NY' })
    expect(result).toMatchObject({ data: expect.objectContaining({ status: 'NY' }) })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('opdaterer status og opretter historik', async () => {
    const updatedTask = { ...mockTask, status: 'AKTIV_TASK' as const }
    txMock.task.update.mockResolvedValueOnce(updatedTask)

    const result = await updateTaskStatus({ taskId: 't1', status: 'AKTIV_TASK' })
    expect(result).toMatchObject({ data: expect.objectContaining({ status: 'AKTIV_TASK' }) })
    expect(txMock.taskHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          field_name: 'STATUS',
          old_value: 'NY',
          new_value: 'AKTIV_TASK',
        }),
      })
    )
  })

  it('tenant-isolation: finder kun tasks i egen organisation', async () => {
    await updateTaskStatus({ taskId: 't1', status: 'AKTIV_TASK' })
    const whereArg = prismaMock.task.findFirst.mock.calls[0]?.[0]?.where
    expect(whereArg?.organization_id).toBe('org-1')
  })
})

// ─── updateTaskPriority ───────────────────────────────────────────────────────

describe('updateTaskPriority', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateTaskPriority({ taskId: 't1', priority: 'HOEJ' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error når task ikke findes', async () => {
    prismaMock.task.findFirst.mockResolvedValueOnce(null)
    const result = await updateTaskPriority({ taskId: 't-mangler', priority: 'HOEJ' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer task uændret hvis prioritet er den samme', async () => {
    const result = await updateTaskPriority({ taskId: 't1', priority: 'MELLEM' })
    expect(result).toMatchObject({ data: expect.objectContaining({ priority: 'MELLEM' }) })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('opdaterer prioritet og opretter historik', async () => {
    const updatedTask = { ...mockTask, priority: 'HOEJ' as const }
    txMock.task.update.mockResolvedValueOnce(updatedTask)

    const result = await updateTaskPriority({ taskId: 't1', priority: 'HOEJ' })
    expect(result).toMatchObject({ data: expect.objectContaining({ priority: 'HOEJ' }) })
    expect(txMock.taskHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ field_name: 'PRIORITY', new_value: 'HOEJ' }),
      })
    )
  })
})

// ─── updateTaskAssignee ───────────────────────────────────────────────────────

describe('updateTaskAssignee', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateTaskAssignee({ taskId: 't1', assignedTo: 'u2' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error når task ikke findes', async () => {
    prismaMock.task.findFirst.mockResolvedValueOnce(null)
    const result = await updateTaskAssignee({ taskId: 't-mangler', assignedTo: 'u2' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error hvis ny bruger ikke findes i organisationen', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    const result = await updateTaskAssignee({ taskId: 't1', assignedTo: 'u-mangler' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('opdaterer assignee og opretter historik', async () => {
    const taskWithAssignee = { ...mockTask, assignee: { name: 'Lars' }, assigned_to: 'u1' }
    prismaMock.task.findFirst.mockResolvedValueOnce(taskWithAssignee)
    const updatedTask = { ...mockTask, assigned_to: 'u2' }
    txMock.task.update.mockResolvedValueOnce(updatedTask)

    const result = await updateTaskAssignee({ taskId: 't1', assignedTo: 'u2' })
    expect(result).toMatchObject({ data: expect.objectContaining({ id: 't1' }) })
    expect(txMock.taskHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ field_name: 'ASSIGNEE' }),
      })
    )
  })

  it('returnerer uændret task hvis assignedTo er den samme', async () => {
    // mockTask.assigned_to = null; null === null => returnerer uændret
    const result = await updateTaskAssignee({ taskId: 't1', assignedTo: null })
    expect(result).toMatchObject({ data: expect.objectContaining({ id: 't1' }) })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

// ─── updateTaskDueDate ────────────────────────────────────────────────────────

describe('updateTaskDueDate', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateTaskDueDate({ taskId: 't1', dueDate: '2026-12-31' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error når task ikke findes', async () => {
    prismaMock.task.findFirst.mockResolvedValueOnce(null)
    const result = await updateTaskDueDate({ taskId: 't-mangler', dueDate: '2026-12-31' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('opdaterer due_date og opretter historik', async () => {
    const updatedTask = { ...mockTask, due_date: new Date('2026-12-31') }
    txMock.task.update.mockResolvedValueOnce(updatedTask)

    const result = await updateTaskDueDate({ taskId: 't1', dueDate: '2026-12-31' })
    expect(result).toMatchObject({ data: expect.objectContaining({ id: 't1' }) })
    expect(txMock.taskHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ field_name: 'DUE_DATE', new_value: '2026-12-31' }),
      })
    )
  })

  it('returnerer uændret task hvis dato er den samme', async () => {
    const taskWithDate = { ...mockTask, due_date: new Date('2026-12-31') }
    prismaMock.task.findFirst.mockResolvedValueOnce(taskWithDate)

    const result = await updateTaskDueDate({ taskId: 't1', dueDate: '2026-12-31' })
    expect(result).toMatchObject({ data: expect.objectContaining({ id: 't1' }) })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

// ─── deleteTask ───────────────────────────────────────────────────────────────

describe('deleteTask', () => {
  it('returnerer error uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await deleteTask('t1')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error når task ikke findes', async () => {
    prismaMock.task.findFirst.mockResolvedValueOnce(null)
    const result = await deleteTask('t-mangler')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returnerer error hvis ikke opretter og ingen selskabsadgang', async () => {
    const taskFromAnother = { ...mockTask, created_by: 'u-anden' }
    prismaMock.task.findFirst.mockResolvedValueOnce(taskFromAnother)
    vi.mocked(canAccessCompany).mockResolvedValueOnce(false)

    const result = await deleteTask('t1')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('soft-sletter task hvis bruger er opretter', async () => {
    const result = await deleteTask('t1')
    expect(result).toMatchObject({ data: undefined })
    expect(prismaMock.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      })
    )
  })

  it('soft-sletter task hvis bruger har admin-adgang (ikke opretter)', async () => {
    const taskFromAnother = { ...mockTask, created_by: 'u-anden' }
    prismaMock.task.findFirst.mockResolvedValueOnce(taskFromAnother)
    vi.mocked(canAccessCompany).mockResolvedValueOnce(true)

    const result = await deleteTask('t1')
    expect(result).toMatchObject({ data: undefined })
  })

  it('tenant-isolation: finder kun tasks i egen organisation', async () => {
    await deleteTask('t1')
    const whereArg = prismaMock.task.findFirst.mock.calls[0]?.[0]?.where
    expect(whereArg?.organization_id).toBe('org-1')
  })
})
