import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    conversation: {
      update: vi.fn(),
    },
    pendingAction: {
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ plan: 'plus' }),
    },
    company: {
      count: vi.fn(),
    },
    contract: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    alert: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  }
  return { prismaMock }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: vi.fn(),
  computeCostUsd: vi.fn(() => 0.001),
}))
vi.mock('@/lib/ai/usage', () => ({
  recordAIUsage: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/ai/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

import { processMessage } from '@/lib/ai/assistant/orchestrator'
import { createClaudeClient } from '@/lib/ai/client'

const baseInput = {
  conversationId: 'conv-1',
  userMessage: 'Hej, hvad kan du hjælpe med?',
  organizationId: 'org-1',
  userId: 'user-1',
}

function buildLLMResponse(text: string) {
  return {
    id: 'resp-1',
    model: 'gpt-5-mini',
    stop_reason: 'end_turn' as const,
    content: [{ type: 'text' as const, text }],
    usage: { input_tokens: 100, output_tokens: 50 },
  }
}

describe('processMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default DB mocks
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' })
    prismaMock.message.findMany.mockResolvedValue([
      { id: 'msg-0', role: 'USER', content: 'Hej', created_at: new Date() },
    ])
    prismaMock.conversation.update.mockResolvedValue({})
    prismaMock.company.count.mockResolvedValue(5)
    prismaMock.contract.count.mockResolvedValue(12)
    prismaMock.alert.count.mockResolvedValue(2)
  })

  it('behandler en simpel besked og returnerer svar', async () => {
    const mockComplete = vi
      .fn()
      .mockResolvedValue(buildLLMResponse('Jeg kan hjælpe med at søge i kontrakter og selskaber.'))
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockReturnValue({
      complete: mockComplete,
      providerName: 'openai',
    })

    const result = await processMessage(baseInput)

    expect(result.response).toContain('søge i kontrakter')
    expect(result.tokensUsed).toBe(150)
    expect(result.toolResults).toHaveLength(0)
    expect(result.pendingActions).toHaveLength(0)

    // Verificér at bruger-besked blev gemt
    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversation_id: 'conv-1',
          role: 'USER',
          content: 'Hej, hvad kan du hjælpe med?',
        }),
      })
    )
  })

  it('håndterer read-only tool-kald direkte', async () => {
    prismaMock.alert.findMany.mockResolvedValue([
      {
        id: 'alert-1',
        severity: 'CRITICAL',
        category: 'DEADLINE',
        entity_type: 'contract',
        entity_id: 'c-1',
        entity_name: 'Ejeraftale',
        message: 'Udløber om 7 dage',
        created_at: new Date(),
      },
    ])

    const toolCallText =
      'Jeg henter advarsler for dig.\n<tool_call>{"name":"get_alerts","params":{}}</tool_call>'
    const mockComplete = vi.fn().mockResolvedValue(buildLLMResponse(toolCallText))
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockReturnValue({
      complete: mockComplete,
      providerName: 'openai',
    })

    const result = await processMessage(baseInput)

    expect(result.toolResults).toHaveLength(1)
    expect(result.toolResults[0]?.toolName).toBe('get_alerts')
    expect(result.toolResults[0]?.result.success).toBe(true)
    // Read-only tool = ingen pending actions
    expect(result.pendingActions).toHaveLength(0)
  })

  it('opretter PendingAction for write-tools', async () => {
    prismaMock.pendingAction.create.mockResolvedValue({
      id: 'pa-1',
      action_type: 'create_task',
      action_label: 'Opret via create_task',
      payload: { title: 'Følg op på ejeraftale' },
    })

    const toolCallText =
      'Jeg opretter opgaven.\n<tool_call>{"name":"create_task","params":{"title":"Følg op på ejeraftale"}}</tool_call>'
    const mockComplete = vi.fn().mockResolvedValue(buildLLMResponse(toolCallText))
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockReturnValue({
      complete: mockComplete,
      providerName: 'openai',
    })

    const result = await processMessage(baseInput)

    expect(result.pendingActions).toHaveLength(1)
    expect(result.pendingActions[0]?.actionType).toBe('create_task')
    expect(prismaMock.pendingAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversation_id: 'conv-1',
          action_type: 'create_task',
          status: 'PENDING',
        }),
      })
    )
  })

  it('ignorerer ukendte tool-navne uden fejl', async () => {
    const toolCallText =
      '<tool_call>{"name":"ukendt_tool","params":{}}</tool_call>\nHer er mit svar.'
    const mockComplete = vi.fn().mockResolvedValue(buildLLMResponse(toolCallText))
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockReturnValue({
      complete: mockComplete,
      providerName: 'openai',
    })

    const result = await processMessage(baseInput)

    expect(result.toolResults).toHaveLength(0)
    expect(result.pendingActions).toHaveLength(0)
  })

  it('logger AI-forbrug efter hvert kald', async () => {
    const { recordAIUsage } = await import('@/lib/ai/usage')
    const mockComplete = vi.fn().mockResolvedValue(buildLLMResponse('Svar'))
    ;(createClaudeClient as ReturnType<typeof vi.fn>).mockReturnValue({
      complete: mockComplete,
      providerName: 'openai',
    })

    await processMessage(baseInput)

    expect(recordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        feature: 'assistant',
      })
    )
  })
})
