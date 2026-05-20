export type ClaudeModel = 'gpt-5-mini' | 'gpt-5' | 'gpt-5-nano'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | {
      type: 'document'
      source: { type: 'base64'; media_type: 'application/pdf'; data: string }
    }

export interface ClaudeRequest {
  model: ClaudeModel
  max_tokens: number
  temperature?: number
  system?: string
  messages: ClaudeMessage[]
  tools?: ClaudeTool[]
  tool_choice?: { type: 'auto' } | { type: 'any' } | { type: 'tool'; name: string }
}

export interface ClaudeTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
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
  readonly providerName: 'openai'
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
  cachedInput: number
}

/**
 * OpenAI pricing pr. 1M tokens (verificeret mod platform.openai.com/docs/pricing).
 * gpt-5-mini: previous-generation, still available. Cached input ~10% af input-pris.
 */
export const MODEL_COSTS: Record<ClaudeModel, ModelPricing> = {
  'gpt-5-mini': { input: 0.25, output: 2.0, cachedInput: 0.025 },
  'gpt-5': { input: 1.25, output: 10.0, cachedInput: 0.125 },
  'gpt-5-nano': { input: 0.05, output: 0.4, cachedInput: 0.005 },
}

export function computeCostUsd(
  model: ClaudeModel,
  inputTokens: number,
  outputTokens: number,
  options?: { cacheWriteTokens?: number; cacheReadTokens?: number }
): number {
  const costs = MODEL_COSTS[model]
  // OpenAI har ikke separat "cache write"-pris — cacheRead-tokens er rabatteret input.
  // cacheWriteTokens-parameteren bevares for API-kompatibilitet men ignoreres.
  const cachedTokens = options?.cacheReadTokens ?? 0
  const uncachedInputTokens = Math.max(0, inputTokens - cachedTokens)
  const base =
    (uncachedInputTokens * costs.input +
      cachedTokens * costs.cachedInput +
      outputTokens * costs.output) /
    1_000_000
  return base
}
