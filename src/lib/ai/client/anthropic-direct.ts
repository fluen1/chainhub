import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, Tool, ContentBlock } from '@anthropic-ai/sdk/resources'
import type { ClaudeClient, ClaudeRequest, ClaudeResponse, ClaudeMessage, ClaudeTool } from './types'
import { ClaudeClientError } from './types'

export class AnthropicDirectClient implements ClaudeClient {
  readonly providerName = 'anthropic' as const
  private client: Anthropic

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required')
    }
    this.client = new Anthropic({ apiKey })
  }

  async complete(request: ClaudeRequest): Promise<ClaudeResponse> {
    try {
      const messages = this.normalizeMessages(request.messages)
      const tools = request.tools ? this.normalizeTools(request.tools) : undefined

      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        system: request.system,
        messages,
        tools,
        tool_choice: request.tool_choice,
      })

      return {
        id: response.id,
        model: response.model,
        stop_reason: response.stop_reason as 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use',
        content: response.content as ClaudeResponse['content'],
        usage: response.usage,
      }
    } catch (error) {
      const isRetryable = this.isRetryable(error)
      throw new ClaudeClientError('Failed to complete message', error, isRetryable)
    }
  }

  private normalizeMessages(messages: ClaudeMessage[]): MessageParam[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content as string | ContentBlock[],
    }))
  }

  private normalizeTools(tools: ClaudeTool[]): Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Tool['input_schema'],
    }))
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof Error && 'status' in error) {
      const status = (error as Error & { status?: number }).status
      if (status === 429) return true
      if (status && status >= 500) return true
      if (status && status >= 400 && status < 500) return false
    }
    return true
  }
}
