import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ─────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    conversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    pendingAction: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/ai/feature-flags', () => ({
  isAIEnabled: vi.fn(),
}))
vi.mock('@/lib/ai/assistant/orchestrator', () => ({
  processMessage: vi.fn(),
}))
vi.mock('@/lib/ai/assistant/tools/registry', () => ({
  toolRegistry: new Map(),
}))

import {
  sendMessage,
  createConversation,
  confirmAction,
  rejectAction,
  getConversationHistory,
} from '@/actions/assistant'
import { processMessage } from '@/lib/ai/assistant/orchestrator'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { auth } from '@/lib/auth'

// ─── Helpers ───────────────────────────────────────────────────────────────
function mockSession() {
  vi.mocked(auth).mockResolvedValue({
    user: {
      id: 'user-1',
      organizationId: 'org-1',
      name: 'Test User',
      email: 'test@test.dk',
    },
    expires: new Date(Date.now() + 3600000).toISOString(),
  } as never)
}

function mockAIEnabled() {
  vi.mocked(isAIEnabled).mockResolvedValue(true)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Auth-check ────────────────────────────────────────────────────────────
describe('auth-check', () => {
  it('sendMessage returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await sendMessage({ conversationId: 'c1', message: 'hej' })
    expect(result.error).toBeTruthy()
  })

  it('createConversation returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createConversation()
    expect(result.error).toBeTruthy()
  })

  it('confirmAction returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await confirmAction('action-1')
    expect(result.error).toBeTruthy()
  })

  it('rejectAction returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await rejectAction('action-1')
    expect(result.error).toBeTruthy()
  })

  it('getConversationHistory returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getConversationHistory('c1')
    expect(result.error).toBeTruthy()
  })
})

// ─── Feature-flag check ────────────────────────────────────────────────────
describe('feature-flag check', () => {
  it('sendMessage returnerer fejl hvis AI ikke er aktiveret', async () => {
    mockSession()
    vi.mocked(isAIEnabled).mockResolvedValue(false)
    const result = await sendMessage({ conversationId: 'c1', message: 'hej' })
    expect(result.error).toContain('ikke aktiveret')
  })

  it('createConversation returnerer fejl hvis AI ikke er aktiveret', async () => {
    mockSession()
    vi.mocked(isAIEnabled).mockResolvedValue(false)
    const result = await createConversation()
    expect(result.error).toContain('ikke aktiveret')
  })
})

// ─── sendMessage ───────────────────────────────────────────────────────────
describe('sendMessage', () => {
  it('returnerer fejl hvis samtale ikke tilhører org', async () => {
    mockSession()
    mockAIEnabled()
    prismaMock.conversation.findFirst.mockResolvedValue(null)

    const result = await sendMessage({ conversationId: 'c1', message: 'hej' })
    expect(result.error).toContain('ikke fundet')
  })

  it('kalder processMessage og returnerer svar', async () => {
    mockSession()
    mockAIEnabled()
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'c1', organization_id: 'org-1' })
    vi.mocked(processMessage).mockResolvedValue({
      response: 'Hej tilbage!',
      toolResults: [],
      pendingActions: [],
      tokensUsed: 42,
      costUsd: 0.001,
    })

    const result = await sendMessage({ conversationId: 'c1', message: 'hej' })
    expect(result.error).toBeUndefined()
    expect(result.data?.response).toBe('Hej tilbage!')
    expect(result.data?.toolResults).toEqual([])
    expect(result.data?.pendingActions).toEqual([])
  })

  it('mappper toolResults korrekt', async () => {
    mockSession()
    mockAIEnabled()
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'c1', organization_id: 'org-1' })
    vi.mocked(processMessage).mockResolvedValue({
      response: 'Fandt 3 kontrakter',
      toolResults: [
        {
          toolName: 'search_contracts',
          result: { success: true, data: [], displayText: 'Fandt 3 kontrakter' },
        },
      ],
      pendingActions: [],
      tokensUsed: 10,
      costUsd: 0,
    })

    const result = await sendMessage({ conversationId: 'c1', message: 'kontrakter' })
    expect(result.data?.toolResults[0]).toEqual({
      toolName: 'search_contracts',
      displayText: 'Fandt 3 kontrakter',
    })
  })
})

// ─── createConversation ────────────────────────────────────────────────────
describe('createConversation', () => {
  it('opretter samtale og returnerer id', async () => {
    mockSession()
    mockAIEnabled()
    prismaMock.conversation.create.mockResolvedValue({
      id: 'new-conv-id',
      user_id: 'user-1',
      organization_id: 'org-1',
    })

    const result = await createConversation()
    expect(result.error).toBeUndefined()
    expect(result.data?.id).toBe('new-conv-id')
    expect(prismaMock.conversation.create).toHaveBeenCalledWith({
      data: {
        user_id: 'user-1',
        organization_id: 'org-1',
      },
    })
  })
})

// ─── rejectAction ──────────────────────────────────────────────────────────
describe('rejectAction', () => {
  it('returnerer fejl hvis pending action ikke findes', async () => {
    mockSession()
    mockAIEnabled()
    prismaMock.pendingAction.findFirst.mockResolvedValue(null)

    const result = await rejectAction('action-1')
    expect(result.error).toContain('ikke fundet')
  })

  it('markerer action som REJECTED og returnerer success', async () => {
    mockSession()
    mockAIEnabled()
    prismaMock.pendingAction.findFirst.mockResolvedValue({
      id: 'action-1',
      status: 'PENDING',
      action_type: 'create_task',
      payload: {},
    })
    prismaMock.pendingAction.update.mockResolvedValue({ id: 'action-1', status: 'REJECTED' })

    const result = await rejectAction('action-1')
    expect(result.error).toBeUndefined()
    expect(result.data?.success).toBe(true)
    expect(prismaMock.pendingAction.update).toHaveBeenCalledWith({
      where: { id: 'action-1' },
      data: { status: 'REJECTED' },
    })
  })
})

// ─── getConversationHistory ────────────────────────────────────────────────
describe('getConversationHistory', () => {
  it('returnerer fejl hvis samtale ikke tilhører org', async () => {
    mockSession()
    mockAIEnabled()
    prismaMock.conversation.findFirst.mockResolvedValue(null)

    const result = await getConversationHistory('c1')
    expect(result.error).toContain('ikke fundet')
  })

  it('returnerer beskedhistorik', async () => {
    mockSession()
    mockAIEnabled()
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'c1', organization_id: 'org-1' })
    const now = new Date()
    prismaMock.message.findMany.mockResolvedValue([
      { id: 'm1', role: 'USER', content: 'Hej', created_at: now },
      { id: 'm2', role: 'ASSISTANT', content: 'Hej tilbage', created_at: now },
    ])

    const result = await getConversationHistory('c1')
    expect(result.error).toBeUndefined()
    expect(result.data).toHaveLength(2)
    expect(result.data?.[0]).toEqual({ role: 'USER', content: 'Hej', createdAt: now })
  })
})
