import { env } from '@/lib/env'
import { OpenAIDirectClient } from './openai-direct'
import type { ClaudeClient } from './types'

export type { ClaudeClient, ClaudeRequest, ClaudeResponse, ClaudeModel, ClaudeTool } from './types'
export { ClaudeClientError, computeCostUsd, MODEL_COSTS } from './types'

export function createClaudeClient(): ClaudeClient {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  const baseURL = env.OPENAI_BASE_URL ?? undefined
  return new OpenAIDirectClient(apiKey, baseURL)
}
