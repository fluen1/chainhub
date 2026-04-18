import { AnthropicDirectClient } from './anthropic-direct'
import type { ClaudeClient } from './types'

export type { ClaudeClient, ClaudeRequest, ClaudeResponse, ClaudeModel, ClaudeTool } from './types'
export { ClaudeClientError, computeCostUsd, MODEL_COSTS } from './types'

export function createClaudeClient(): ClaudeClient {
  const provider = process.env.AI_PROVIDER || 'anthropic'

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is required when AI_PROVIDER=anthropic'
      )
    }
    return new AnthropicDirectClient(apiKey)
  }

  if (provider === 'bedrock') {
    throw new Error('Bedrock provider not yet implemented (deferred to Plan in week 16)')
  }

  throw new Error(`Unknown AI_PROVIDER: ${provider}`)
}
