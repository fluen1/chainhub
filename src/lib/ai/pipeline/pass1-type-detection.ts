import type { ClaudeClient, ClaudeContentBlock } from '@/lib/ai/client/types'
import type { ExtractionContent } from '@/lib/ai/content-loader'
import { getAllSchemaTypes } from '@/lib/ai/schemas/registry'
import { createLogger } from '@/lib/ai/logger'
import type { TypeDetectionResult } from './types'

const log = createLogger('pass1-type-detection')

export async function detectDocumentType(
  content: ExtractionContent,
  client: ClaudeClient
): Promise<TypeDetectionResult> {
  const knownTypes = getAllSchemaTypes().filter((t) => t !== 'MINIMAL')

  const typeListStr = knownTypes.map((t) => `- ${t}`).join('\n')

  // Byg beskedindhold baseret på indholdstype
  const messageContent = buildMessageContent(content)

  const response = await client.complete({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 256,
    system: `Du er ekspert i at klassificere danske juridiske dokumenter.
Klassificér dokumentet som en af følgende typer:
${typeListStr}
- UNKNOWN (hvis ingen af de ovenstående passer)

Returnér via classify_document tool.`,
    messages: [
      {
        role: 'user',
        content: messageContent,
      },
    ],
    tools: [
      {
        name: 'classify_document',
        description: 'Klassificerer et dokument som en kontrakttype',
        input_schema: {
          type: 'object',
          properties: {
            detected_type: {
              type: 'string',
              description: 'Den mest sandsynlige kontrakttype',
              enum: [...knownTypes, 'UNKNOWN'],
            },
            confidence: {
              type: 'number',
              description: 'Konfidence 0.0-1.0',
              minimum: 0,
              maximum: 1,
            },
            alternatives: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  confidence: { type: 'number' },
                },
                required: ['type', 'confidence'],
              },
              description: 'Top 2 alternative typer med konfidence',
            },
          },
          required: ['detected_type', 'confidence'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'classify_document' },
  })

  // Parse tool_use svar
  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    log.error('No tool_use block in type detection response')
    return {
      detected_type: 'UNKNOWN',
      confidence: 0,
      alternatives: [],
      model_used: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    }
  }

  const input = toolUse.input as {
    detected_type: string
    confidence: number
    alternatives?: Array<{ type: string; confidence: number }>
  }

  // Konvertér UNKNOWN til MINIMAL (minimal schema bruges som fallback)
  const detectedType = input.detected_type === 'UNKNOWN' ? 'MINIMAL' : input.detected_type

  log.info(
    {
      detected_type: detectedType,
      confidence: input.confidence,
      alternatives: input.alternatives?.length ?? 0,
    },
    'Type detection complete'
  )

  return {
    detected_type: detectedType,
    confidence: input.confidence,
    alternatives: input.alternatives ?? [],
    model_used: response.model,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  }
}

function buildMessageContent(content: ExtractionContent): string | ClaudeContentBlock[] {
  if (content.type === 'pdf_binary') {
    return [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf' as const,
          data: content.data.toString('base64'),
        },
      },
      {
        type: 'text',
        text: 'Klassificér dette dokument. Brug kun de første sider til klassificering.',
      },
    ] as ClaudeContentBlock[]
  }

  if (content.type === 'text_html') {
    // Send kun de første 3000 tegn til klassificering (spar tokens)
    const truncated = content.html.slice(0, 3000)
    return `Klassificér dette dokument baseret på indholdet:\n\n${truncated}`
  }

  if (content.type === 'text_markdown') {
    const truncated = content.markdown.slice(0, 3000)
    return `Klassificér dette dokument baseret på indholdet:\n\n${truncated}`
  }

  return 'Dokument kunne ikke læses.'
}
