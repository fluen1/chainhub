import OpenAI from 'openai'
import { createLogger } from '@/lib/ai/logger'
import type {
  ClaudeClient,
  ClaudeRequest,
  ClaudeResponse,
  ClaudeMessage,
  ClaudeContentBlock,
} from './types'
import { ClaudeClientError } from './types'

const log = createLogger('openai-direct-client')

export class OpenAIDirectClient implements ClaudeClient {
  readonly providerName = 'openai' as const
  private client: OpenAI

  constructor(apiKey: string, baseURL?: string) {
    if (!apiKey) throw new Error('OPENAI_API_KEY is required')
    this.client = new OpenAI({ apiKey, baseURL })
  }

  async complete(request: ClaudeRequest): Promise<ClaudeResponse> {
    const start = Date.now()
    log.debug({ model: request.model, max_tokens: request.max_tokens }, 'OpenAI request')

    try {
      const responsesPayload = this.buildResponsesPayload(request)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await this.client.responses.create(responsesPayload as any)

      const latencyMs = Date.now() - start
      const usage = response.usage as {
        input_tokens: number
        output_tokens: number
        input_tokens_details?: { cached_tokens?: number }
      }
      const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0

      log.info(
        {
          model: response.model,
          status: response.status,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read: cachedTokens,
          latency_ms: latencyMs,
        },
        'OpenAI response'
      )

      return this.buildClaudeResponse(response, request)
    } catch (err) {
      const retryable = this.isRetryable(err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown OpenAI API error'
      log.error({ err: errorMessage, retryable }, 'OpenAI request failed')
      throw new ClaudeClientError(errorMessage, err, retryable)
    }
  }

  private buildResponsesPayload(request: ClaudeRequest): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: request.model,
      input: this.mapMessages(request.messages),
      max_output_tokens: request.max_tokens,
    }

    if (request.system) {
      payload.instructions = request.system
    }

    if (typeof request.temperature === 'number') {
      payload.temperature = request.temperature
    }

    // tools[0] bruges som response_format (strict json_schema). ChainHub-pipelinen
    // sender altid præcis ét tool med tool_choice: { type: 'tool', name }, så vi
    // mapper det til OpenAI structured outputs.
    if (request.tools && request.tools.length > 0) {
      const tool = request.tools[0]
      payload.text = {
        format: {
          type: 'json_schema',
          name: tool.name,
          schema: normalizeSchemaForStrict(tool.input_schema),
          strict: true,
        },
      }
    }

    return payload
  }

  private mapMessages(messages: ClaudeMessage[]): Array<Record<string, unknown>> {
    return messages.map((msg) => ({
      role: msg.role,
      content: mapContent(msg.content),
    }))
  }

  private buildClaudeResponse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: any,
    request: ClaudeRequest
  ): ClaudeResponse {
    const usage = response.usage as {
      input_tokens: number
      output_tokens: number
      input_tokens_details?: { cached_tokens?: number }
    }
    const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0

    const tool = request.tools?.[0]
    const outputText = extractOutputText(response)
    const refusal = extractRefusal(response)

    if (refusal) {
      throw new ClaudeClientError(`OpenAI refused: ${refusal}`, { refusal }, false)
    }

    let content: ClaudeResponse['content']
    let stop_reason: ClaudeResponse['stop_reason']

    if (tool) {
      // Pipelinen forventer tool_use-block. Parse strict-mode JSON og pak som Anthropic tool_use.
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(outputText) as Record<string, unknown>
      } catch (err) {
        throw new ClaudeClientError(
          `Failed to parse OpenAI structured output as JSON: ${String(err)}`,
          { outputText, err },
          false
        )
      }
      content = [
        {
          type: 'tool_use',
          id: response.id ?? 'openai-call',
          name: tool.name,
          input: parsed,
        },
      ]
      stop_reason = 'tool_use'
    } else {
      content = [{ type: 'text', text: outputText }]
      stop_reason = response.status === 'incomplete' ? 'max_tokens' : 'end_turn'
    }

    return {
      id: response.id ?? 'openai-resp',
      model: response.model,
      stop_reason,
      content,
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_input_tokens: cachedTokens,
        cache_creation_input_tokens: 0,
      },
    }
  }

  private isRetryable(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false
    const status = (err as { status?: number }).status
    if (!status) return true
    return status === 429 || status >= 500
  }
}

function mapContent(
  content: string | ClaudeContentBlock[]
): Array<Record<string, unknown>> | string {
  if (typeof content === 'string') {
    return [{ type: 'input_text', text: content }]
  }
  return content.map((block) => {
    if (block.type === 'text') {
      return { type: 'input_text', text: block.text }
    }
    if (block.type === 'document') {
      return {
        type: 'input_file',
        filename: 'document.pdf',
        file_data: `data:application/pdf;base64,${block.source.data}`,
      }
    }
    if (block.type === 'image') {
      return {
        type: 'input_image',
        image_url: `data:${block.source.media_type};base64,${block.source.data}`,
      }
    }
    return { type: 'input_text', text: '' }
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractOutputText(response: any): string {
  if (typeof response.output_text === 'string' && response.output_text.length > 0) {
    return response.output_text
  }
  // Fallback: traversér output[]-strukturen
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === 'output_text' && typeof c.text === 'string') {
            return c.text
          }
        }
      }
    }
  }
  return ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRefusal(response: any): string | null {
  if (!Array.isArray(response.output)) return null
  for (const item of response.output) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c.type === 'refusal' && typeof c.refusal === 'string') {
          return c.refusal
        }
      }
    }
  }
  return null
}

/**
 * Konverterer et Anthropic-stil JSON-schema til strict-mode-kompatibelt OpenAI-schema.
 * Strict-mode-krav:
 *  - Alle properties skal være i `required` (optional simuleres via union `["T", "null"]`)
 *  - `additionalProperties: false` på alle objects (rekursivt)
 *  - Ingen `format`/`minimum`/`maximum`/`minLength`/`maxLength`/`pattern` på primitives
 *  - `oneOf`/`anyOf` på root frarådes — fjernes ikke automatisk
 */
export function normalizeSchemaForStrict(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {}, required: [], additionalProperties: false }
  }
  return normalizeNode(schema as Record<string, unknown>) as Record<string, unknown>
}

const STRIP_KEYS = new Set([
  'format',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'pattern',
  'multipleOf',
  'exclusiveMinimum',
  'exclusiveMaximum',
])

function normalizeNode(node: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (STRIP_KEYS.has(key)) continue
    out[key] = value
  }

  const type = out.type
  if (type === 'object' && out.properties && typeof out.properties === 'object') {
    const props = out.properties as Record<string, unknown>
    const normalizedProps: Record<string, unknown> = {}
    const allKeys = Object.keys(props)
    const originalRequired = Array.isArray(out.required) ? (out.required as string[]) : []

    for (const propKey of allKeys) {
      const propValue = props[propKey] as Record<string, unknown>
      const normalized = normalizeNode(propValue) as Record<string, unknown>
      // Hvis property ikke er i required, gør den nullable så strict mode kan håndtere null
      if (!originalRequired.includes(propKey)) {
        normalizedProps[propKey] = makeNullable(normalized)
      } else {
        normalizedProps[propKey] = normalized
      }
    }

    out.properties = normalizedProps
    out.required = allKeys
    out.additionalProperties = false
  }

  if (type === 'array' && out.items && typeof out.items === 'object') {
    out.items = normalizeNode(out.items as Record<string, unknown>)
  }

  return out
}

function makeNullable(node: Record<string, unknown>): Record<string, unknown> {
  const t = node.type
  if (typeof t === 'string' && t !== 'null') {
    return { ...node, type: [t, 'null'] }
  }
  if (Array.isArray(t)) {
    if (!t.includes('null')) {
      return { ...node, type: [...t, 'null'] }
    }
    return node
  }
  return node
}

// Eksporteret kun for tests
export { mapContent as _mapContent, extractOutputText as _extractOutputText }
