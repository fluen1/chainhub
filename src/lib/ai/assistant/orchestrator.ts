import { createClaudeClient, computeCostUsd } from '@/lib/ai/client'
import { createLogger } from '@/lib/ai/logger'
import { recordAIUsage } from '@/lib/ai/usage'
import { prisma } from '@/lib/db'
import { buildSystemPrompt } from './context'
import { toolRegistry, getToolDefinitions } from './tools/registry'
import type { ToolResult } from './tools/types'

const log = createLogger('ai:assistant:orchestrator')

// Modellen der bruges til assistenten
const ASSISTANT_MODEL = 'gpt-5-mini' as const

export interface ProcessMessageInput {
  conversationId: string
  userMessage: string
  organizationId: string
  userId: string
}

export interface ProcessMessageResult {
  response: string
  toolResults: Array<{ toolName: string; result: ToolResult }>
  pendingActions: Array<{
    id: string
    actionType: string
    actionLabel: string
    payload: Record<string, unknown>
  }>
  tokensUsed: number
  costUsd: number
}

interface LLMToolCall {
  name: string
  params: Record<string, unknown>
}

/**
 * Forsøger at parse tool-kald fra LLM-tekstsvar.
 * Modellen instrueres til at outputte JSON-blokke med format:
 *   <tool_call>{"name":"...","params":{...}}</tool_call>
 */
function parseToolCalls(text: string): LLMToolCall[] {
  const calls: LLMToolCall[] = []
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    try {
      const raw = JSON.parse(match[1] ?? '') as unknown
      if (
        raw &&
        typeof raw === 'object' &&
        'name' in raw &&
        typeof (raw as Record<string, unknown>).name === 'string'
      ) {
        const parsed = raw as { name: string; params?: Record<string, unknown> }
        calls.push({ name: parsed.name, params: parsed.params ?? {} })
      }
    } catch {
      // Ignorer malformatted blocks
    }
  }
  return calls
}

/**
 * Fjerner <tool_call>-blokke fra teksten, så de ikke vises til brugeren.
 */
function stripToolCalls(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim()
}

/**
 * Bygger tool-beskrivelser til system-prompten i et LLM-læsbart format.
 */
function buildToolInstructions(): string {
  const defs = getToolDefinitions()
  const lines = defs.map((d) => `- **${d.name}**: ${d.description}`)
  return (
    '\n\n## Tilgængelige værktøjer\nKald et værktøj ved at skrive en <tool_call>-blok i dit svar:\n' +
    '```\n<tool_call>{"name":"tool_name","params":{"param1":"value1"}}</tool_call>\n```\n' +
    'Du kan kalde flere værktøjer - ét pr. blok. Kald blot værktøjerne direkte.\n\n' +
    'Tilgængelige værktøjer:\n' +
    lines.join('\n')
  )
}

export async function processMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
  const { conversationId, userMessage, organizationId, userId } = input

  // Plan-gate: AI-assistenten kræver plus-abonnement
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  })
  if (!org || org.plan !== 'plus') {
    throw new Error('AI-assistenten kræver Plus-abonnement')
  }

  // 1. Gem bruger-besked i DB
  await prisma.message.create({
    data: {
      conversation_id: conversationId,
      role: 'USER',
      content: userMessage,
    },
  })

  // 2. Byg system-prompt med kontekst
  const systemPrompt = (await buildSystemPrompt(organizationId, userId)) + buildToolInstructions()

  // 3. Hent de seneste 20 beskeder som historik
  const history = await prisma.message.findMany({
    where: { conversation_id: conversationId },
    orderBy: { created_at: 'asc' },
    take: 20,
  })

  const messages = history.map((m) => ({
    role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))

  // 4. Kald LLM
  const client = createClaudeClient()
  const llmResponse = await client.complete({
    model: ASSISTANT_MODEL,
    max_tokens: 2048,
    temperature: 0.3,
    system: systemPrompt,
    messages,
  })

  const inputTokens = llmResponse.usage.input_tokens
  const outputTokens = llmResponse.usage.output_tokens
  const costUsd = computeCostUsd(ASSISTANT_MODEL, inputTokens, outputTokens, {
    cacheReadTokens: llmResponse.usage.cache_read_input_tokens ?? 0,
  })
  const tokensUsed = inputTokens + outputTokens

  // Ekstraher tekst fra svar
  const rawText =
    llmResponse.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('\n') ?? ''

  // 5. Parse og udfør tool-kald
  const toolCalls = parseToolCalls(rawText)
  const toolResults: ProcessMessageResult['toolResults'] = []
  const pendingActions: ProcessMessageResult['pendingActions'] = []
  const toolCallsLog: Array<{ name: string; params: Record<string, unknown> }> = []
  const toolResultsLog: Array<{ name: string; result: unknown }> = []

  for (const call of toolCalls) {
    const tool = toolRegistry.get(call.name)
    if (!tool) {
      log.warn({ toolName: call.name }, 'Ukendt tool-kald ignoreret')
      continue
    }

    toolCallsLog.push({ name: call.name, params: call.params })

    if (tool.requiresConfirmation) {
      // Write-tool: opret PendingAction i DB
      const pendingAction = await prisma.pendingAction.create({
        data: {
          conversation_id: conversationId,
          action_type: call.name,
          action_label: `Opret via ${call.name}`,
          payload: call.params as never,
          status: 'PENDING',
        },
      })

      // Kør execute for at generere preview-tekst
      const previewResult = await tool.execute(call.params, { organizationId, userId })
      toolResults.push({ toolName: call.name, result: previewResult })
      toolResultsLog.push({ name: call.name, result: previewResult })

      pendingActions.push({
        id: pendingAction.id,
        actionType: call.name,
        actionLabel: pendingAction.action_label,
        payload: call.params,
      })
    } else {
      // Read-only tool: udfør direkte
      try {
        const result = await tool.execute(call.params, { organizationId, userId })
        toolResults.push({ toolName: call.name, result })
        toolResultsLog.push({ name: call.name, result })
      } catch (err) {
        log.error({ toolName: call.name, err }, 'Tool-kald fejlede')
        toolResults.push({
          toolName: call.name,
          result: {
            success: false,
            data: null,
            displayText: `Fejl ved ${call.name}: ${err instanceof Error ? err.message : 'Ukendt fejl'}`,
          },
        })
      }
    }
  }

  // 6. Byg endeligt svar — strip <tool_call>-blokke og vis tool-resultater
  let finalResponse = stripToolCalls(rawText)

  if (toolResults.length > 0) {
    const resultTexts = toolResults.map((tr) => tr.result.displayText).filter(Boolean)
    if (resultTexts.length > 0) {
      finalResponse = resultTexts.join('\n\n')
    }
  }

  // 7. Gem assistent-besked i DB
  await prisma.message.create({
    data: {
      conversation_id: conversationId,
      role: 'ASSISTANT',
      content: finalResponse,
      tool_calls: toolCallsLog.length > 0 ? (toolCallsLog as never) : undefined,
      tool_results: toolResultsLog.length > 0 ? (toolResultsLog as never) : undefined,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
    },
  })

  // Opdatér conversation.updated_at
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updated_at: new Date() },
  })

  // 8. Log AI-forbrug
  await recordAIUsage({
    organizationId,
    feature: 'assistant',
    model: ASSISTANT_MODEL,
    provider: 'openai',
    inputTokens,
    outputTokens,
    cacheReadTokens: llmResponse.usage.cache_read_input_tokens ?? 0,
    costUsd,
  })

  return {
    response: finalResponse,
    toolResults,
    pendingActions,
    tokensUsed,
    costUsd,
  }
}
