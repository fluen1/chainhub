import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    message: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    conversation: { findFirst: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn() },
    pendingAction: { create: vi.fn() },
  },
}))
vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: vi.fn(),
  computeCostUsd: vi.fn().mockReturnValue(0.001),
}))
vi.mock('@/lib/ai/usage', () => ({ recordAIUsage: vi.fn() }))
vi.mock('@/lib/ai/assistant/context', () => ({
  buildSystemPrompt: vi.fn().mockResolvedValue('sys'),
}))
vi.mock('@/lib/ai/assistant/tools/registry', () => ({
  toolRegistry: new Map(),
  getToolDefinitions: vi.fn().mockReturnValue([]),
}))

import { processMessage } from '@/lib/ai/assistant/orchestrator'
import { prisma } from '@/lib/db'

describe('processMessage — plan-gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.message.create).mockResolvedValue({ id: 'm1' } as never)
    vi.mocked(prisma.message.findMany).mockResolvedValue([])
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never)
  })

  it('tillader processMessage for plus-plan organisation', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org-1',
      plan: 'plus',
    } as never)

    // Mock LLM-kald til at returnere et tomt svar
    const { createClaudeClient } = await import('@/lib/ai/client')
    vi.mocked(createClaudeClient).mockReturnValue({
      providerName: 'openai',
      complete: vi.fn().mockResolvedValue({
        id: 'r1',
        model: 'gpt-5-mini',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hej!' }],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
      }),
    } as never)

    const result = await processMessage({
      conversationId: 'conv-1',
      userMessage: 'hej',
      organizationId: 'org-1',
      userId: 'user-1',
    })

    expect(result.response).toBe('Hej!')
  })

  it('afviser processMessage for basis-plan organisation med klar fejlbesked', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org-1',
      plan: 'basis',
    } as never)

    await expect(
      processMessage({
        conversationId: 'conv-1',
        userMessage: 'hej',
        organizationId: 'org-1',
        userId: 'user-1',
      })
    ).rejects.toThrow('AI-assistenten kræver Plus-abonnement')
  })

  it('afviser processMessage for trial-plan organisation', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org-1',
      plan: 'trial',
    } as never)

    await expect(
      processMessage({
        conversationId: 'conv-1',
        userMessage: 'hej',
        organizationId: 'org-1',
        userId: 'user-1',
      })
    ).rejects.toThrow('AI-assistenten kræver Plus-abonnement')
  })
})
