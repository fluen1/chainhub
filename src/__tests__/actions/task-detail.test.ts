import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/task-detail/helpers', () => ({
  deriveTaskUrgency: vi.fn().mockReturnValue({ level: 'normal', label: 'Normal' }),
  formatHistoryEntry: vi.fn().mockImplementation((entry: { id: string }) => ({
    id: entry.id,
    summary: 'Ændret',
    changedAt: new Date(),
    changedBy: 'Test Bruger',
  })),
}))

const prismaMock = vi.hoisted(() => ({
  task: { findFirst: vi.fn() },
  company: { findFirst: vi.fn() },
  contract: { findFirst: vi.fn() },
  comment: { findMany: vi.fn() },
  taskHistory: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

import { getTaskDetailData } from '@/actions/task-detail'
import { auth } from '@/lib/auth'
import { canAccessCompany } from '@/lib/permissions'

const mockSession = {
  user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '',
}

const validTaskId = '00000000-0000-0000-0000-000000000001'
const validCompanyId = '00000000-0000-0000-0000-000000000002'

const fakeTask = {
  id: validTaskId,
  organization_id: 'org-1',
  title: 'Test opgave',
  description: 'Beskrivelse',
  status: 'AABEN',
  priority: 'NORMAL',
  due_date: null,
  created_at: new Date(),
  created_by: 'u1',
  deleted_at: null,
  company_id: null,
  contract_id: null,
  case_id: null,
  assignee: null,
  case: null,
}

function setupDefaultMocks() {
  prismaMock.task.findFirst.mockResolvedValue(fakeTask)
  prismaMock.company.findFirst.mockResolvedValue(null)
  prismaMock.contract.findFirst.mockResolvedValue(null)
  prismaMock.comment.findMany.mockResolvedValue([])
  prismaMock.taskHistory.findMany.mockResolvedValue([])
  prismaMock.user.findMany.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(mockSession as never)
  vi.mocked(canAccessCompany).mockResolvedValue(true)
  setupDefaultMocks()
})

// ---------------------------------------------------------------------------
// getTaskDetailData
// ---------------------------------------------------------------------------

describe('getTaskDetailData', () => {
  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await getTaskDetailData(validTaskId)
    expect(result).toBeNull()
  })

  it('returnerer null ved ugyldigt UUID-format', async () => {
    const result = await getTaskDetailData('not-a-uuid')
    expect(result).toBeNull()
  })

  it('returnerer null når task ikke eksisterer', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null)
    const result = await getTaskDetailData(validTaskId)
    expect(result).toBeNull()
  })

  it('returnerer null når bruger ikke har company-adgang', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      ...fakeTask,
      company_id: validCompanyId,
    })
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await getTaskDetailData(validTaskId)
    expect(result).toBeNull()
  })

  it('happy path — task uden company_id', async () => {
    const result = await getTaskDetailData(validTaskId)
    expect(result).not.toBeNull()
    expect(result?.task.id).toBe(validTaskId)
    expect(result?.task.title).toBe('Test opgave')
    expect(result?.relatedCompany).toBeNull()
    expect(result?.relatedCase).toBeNull()
    expect(result?.relatedContract).toBeNull()
  })

  it('happy path — task med company_id og adgang', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      ...fakeTask,
      company_id: validCompanyId,
    })
    prismaMock.company.findFirst.mockResolvedValue({
      id: validCompanyId,
      name: 'Test ApS',
    })

    const result = await getTaskDetailData(validTaskId)
    expect(result).not.toBeNull()
    expect(result?.relatedCompany?.id).toBe(validCompanyId)
    expect(result?.relatedCompany?.name).toBe('Test ApS')
  })

  it('inkluderer kommentarer og history', async () => {
    const fakeComment = {
      id: 'c1',
      content: 'Test',
      created_at: new Date(),
      created_by: 'u1',
      deleted_at: null,
      author: { name: 'Test Bruger' },
    }
    const fakeHistory = {
      id: 'h1',
      changed_at: new Date(),
      changedBy: { name: 'Test Bruger' },
    }
    prismaMock.comment.findMany.mockResolvedValue([fakeComment])
    prismaMock.taskHistory.findMany.mockResolvedValue([fakeHistory])

    const result = await getTaskDetailData(validTaskId)
    expect(result?.comments).toHaveLength(1)
    expect(result?.history).toHaveLength(1)
    expect(result?.comments[0]!.id).toBe('c1')
  })

  it('inkluderer availableAssignees', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Test Bruger' },
      { id: 'u2', name: 'Anden Bruger' },
    ])

    const result = await getTaskDetailData(validTaskId)
    expect(result?.availableAssignees).toHaveLength(2)
  })

  it('inkluderer assignee når task har en', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      ...fakeTask,
      assignee: { id: 'u2', name: 'Sagsbehandler', email: 'sb@test.dk' },
    })

    const result = await getTaskDetailData(validTaskId)
    expect(result?.assignee?.id).toBe('u2')
    expect(result?.assignee?.name).toBe('Sagsbehandler')
  })

  it('inkluderer relatedCase når task har en', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      ...fakeTask,
      case: { id: 'case-1', title: 'Tvist', case_type: 'ARBEJDSRET', status: 'AKTIV' },
    })

    const result = await getTaskDetailData(validTaskId)
    expect(result?.relatedCase?.id).toBe('case-1')
    expect(result?.relatedCase?.title).toBe('Tvist')
  })

  it('inkluderer relatedContract når task har en', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      ...fakeTask,
      contract_id: 'contract-1',
    })
    prismaMock.contract.findFirst.mockResolvedValue({
      id: 'contract-1',
      display_name: 'Lejeaftale',
      status: 'AKTIV',
    })

    const result = await getTaskDetailData(validTaskId)
    expect(result?.relatedContract?.id).toBe('contract-1')
  })

  it('returnerer urgency fra deriveTaskUrgency', async () => {
    const result = await getTaskDetailData(validTaskId)
    expect(result?.urgency).toEqual({ level: 'normal', label: 'Normal' })
  })
})
