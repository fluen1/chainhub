import Anthropic from '@anthropic-ai/sdk'
import { createLogger } from '@/lib/ai/logger'
import type { ClaudeClient, ClaudeRequest, ClaudeResponse } from './types'
import { ClaudeClientError } from './types'

const log = createLogger('anthropic-direct-client')

export class AnthropicDirectClient implements ClaudeClient {
  readonly providerName = 'anthropic' as const
  private client: Anthropic

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required')
    this.client = new Anthropic({ apiKey })
  }

  async complete(request: ClaudeRequest): Promise<ClaudeResponse> {
    const start = Date.now()
    log.debug({ model: request.model, max_tokens: request.max_tokens }, 'Claude request')
    try {
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        system: request.system,
        messages: request.messages as never,
        tools: request.tools as never,
        tool_choice: request.tool_choice as never,
      })
      const latencyMs = Date.now() - start
      const usage = response.usage as {
        input_tokens: number
        output_tokens: number
        cache_creation_input_tokens?: number
        cache_read_input_tokens?: number
      }
      log.info(
        {
          model: response.model,
          stop_reason: response.stop_reason,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read: usage.cache_read_input_tokens ?? 0,
          cache_write: usage.cache_creation_input_tokens ?? 0,
          latency_ms: latencyMs,
        },
        'Claude response'
      )
      return {
        id: response.id,
        model: response.model,
        stop_reason: response.stop_reason as ClaudeResponse['stop_reason'],
        content: response.content as ClaudeResponse['content'],
        usage: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_creation_input_tokens: usage.cache_creation_input_tokens,
          cache_read_input_tokens: usage.cache_read_input_tokens,
        },
      }
    } catch (err) {
      const retryable = this.isRetryable(err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown Claude API error'
      log.error({ err: errorMessage, retryable }, 'Claude request failed')
      throw new ClaudeClientError(errorMessage, err, retryable)
    }
  }

  private isRetryable(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false
    const status = (err as { status?: number }).status
    if (!status) return true
    return status === 429 || status >= 500
  }
}
