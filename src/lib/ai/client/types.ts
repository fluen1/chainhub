export type ClaudeModel = 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'claude-haiku-4-5'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | {
      type: 'document'
      source: { type: 'base64'; media_type: 'application/pdf'; data: string }
      cache_control?: { type: 'ephemeral' }
    }

export interface ClaudeRequest {
  model: ClaudeModel
  max_tokens: number
  temperature?: number
  system?: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>
  messages: ClaudeMessage[]
  tools?: ClaudeTool[]
  tool_choice?: { type: 'auto' } | { type: 'any' } | { type: 'tool'; name: string }
}

export interface ClaudeTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
  cache_control?: { type: 'ephemeral' }
}

export interface ClaudeResponse {
  id: string
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use'
  content: ClaudeResponseContent[]
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export type ClaudeResponseContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }

export interface ClaudeClient {
  readonly providerName: 'anthropic' | 'bedrock'
  complete(request: ClaudeRequest): Promise<ClaudeResponse>
}

export class ClaudeClientError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
    public readonly retryable: boolean
  ) {
    super(message)
    this.name = 'ClaudeClientError'
  }
}

export interface ModelPricing {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

/**
 * Verified from claude.com/pricing 2026-04-19.
 * 5-minute cache (1.25x write, 0.1x read). For 1-hour cache: multiplier er 2.0x write.
 * Batch API: 50% rabat på input+output (ikke modelleret; anvendes pr. call-site).
 */
export const MODEL_COSTS: Record<ClaudeModel, ModelPricing> = {
  'claude-opus-4-7': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
}

export function computeCostUsd(
  model: ClaudeModel,
  inputTokens: number,
  outputTokens: number,
  options?: { cacheWriteTokens?: number; cacheReadTokens?: number }
): number {
  const costs = MODEL_COSTS[model]
  const base = (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000
  const cacheWrite = ((options?.cacheWriteTokens ?? 0) * costs.cacheWrite) / 1_000_000
  const cacheRead = ((options?.cacheReadTokens ?? 0) * costs.cacheRead) / 1_000_000
  return base + cacheWrite + cacheRead
}
