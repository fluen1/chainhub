export type ClaudeModel =
  | 'claude-opus-4-7-20260101'
  | 'claude-sonnet-4-6-20251201'
  | 'claude-sonnet-4-20250514'
  | 'claude-3-5-haiku-20241022'
  | 'claude-haiku-4-5-20260101'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }

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
  /** Price per million input tokens, USD */
  input: number
  /** Price per million output tokens, USD */
  output: number
  /** Price per million cache-write tokens, USD */
  cacheWrite: number
  /** Price per million cache-read tokens, USD */
  cacheRead: number
}

/**
 * Verified from claude.com/pricing on 2026-04-18.
 * Batch processing: 50% discount on input+output (not modelled here; apply at call-site if used).
 * US-only inference: 1.1× multiplier (not modelled here).
 */
export const MODEL_COSTS: Record<ClaudeModel, ModelPricing> = {
  'claude-opus-4-7-20260101': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-sonnet-4-6-20251201': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  'claude-haiku-4-5-20260101': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
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
