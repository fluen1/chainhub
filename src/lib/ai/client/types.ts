export type ClaudeModel = 'claude-sonnet-4-20250514' | 'claude-3-5-haiku-20241022'

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

export const MODEL_COSTS: Record<ClaudeModel, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
}

export function computeCostUsd(
  model: ClaudeModel,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = MODEL_COSTS[model]
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000
}
