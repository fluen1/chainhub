import type { ClaudeClient, ClaudeContentBlock } from '@/lib/ai/client/types'
import type { ExtractionContent } from '@/lib/ai/content-loader'
import type { ContractSchema } from '@/lib/ai/schemas/types'
import type { SchemaExtractionResult, ExtractedField } from './types'
import { createLogger } from '@/lib/ai/logger'
import { withCacheControl, canCacheForModel } from '@/lib/ai/cache-control'

const log = createLogger('pass2-schema-extraction')

interface ExtractionOptions {
  temperature?: number
}

export async function extractWithSchema(
  content: ExtractionContent,
  schema: ContractSchema,
  client: ClaudeClient,
  options: ExtractionOptions = {}
): Promise<SchemaExtractionResult> {
  const temperature = options.temperature ?? 0.2

  // Byg message content baseret på filtype
  const messageContent = buildContent(content, schema.user_prompt_prefix, schema.extraction_model)

  const response = await client.complete({
    model: schema.extraction_model,
    max_tokens: 4096,
    temperature,
    system: schema.system_prompt,
    messages: [{ role: 'user', content: messageContent }],
    tools: [withCacheControl(schema.tool_definition)],
    tool_choice: { type: 'tool', name: schema.tool_definition.name },
  })

  // Find tool_use i svaret
  const toolUse = response.content.find((b) => b.type === 'tool_use')

  if (!toolUse || toolUse.type !== 'tool_use') {
    log.error({ schema: schema.contract_type }, 'Intet tool_use i extraction-svar')
    return {
      fields: {},
      additional_findings: [],
      extraction_warnings: [
        { warning: 'Claude returnerede ikke struktureret output', severity: 'high' },
      ],
      model_used: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      raw_response: response,
    }
  }

  const rawFields = toolUse.input as Record<string, unknown>

  // Parse felter til ExtractedField-format
  // Hvert felt i schema er pakket som {value, claude_confidence, source_page, source_text}
  const fields: Record<string, ExtractedField> = {}
  const schemaFieldNames = Object.keys(schema.field_metadata)

  for (const fieldName of schemaFieldNames) {
    const raw = rawFields[fieldName]
    if (raw == null) {
      // Feltet ikke fundet af Claude
      fields[fieldName] = {
        value: null,
        claude_confidence: 0,
        source_page: null,
        source_text: null,
      }
      continue
    }

    if (typeof raw === 'object' && raw !== null && 'value' in raw) {
      // Feltet er pakket i {value, claude_confidence, source_page, source_text}
      const wrapped = raw as {
        value: unknown
        claude_confidence?: number
        source_page?: number
        source_text?: string
      }
      fields[fieldName] = {
        value: wrapped.value ?? null,
        claude_confidence: wrapped.claude_confidence ?? 0.5,
        source_page: wrapped.source_page ?? null,
        source_text: wrapped.source_text ?? null,
      }
    } else {
      // Felt returneret direkte uden wrapper (fallback)
      fields[fieldName] = {
        value: raw,
        claude_confidence: 0.5,
        source_page: null,
        source_text: null,
      }
    }
  }

  // Udtræk fælles felter
  const additional_findings = Array.isArray(rawFields.additional_findings)
    ? (rawFields.additional_findings as SchemaExtractionResult['additional_findings'])
    : []
  const extraction_warnings = Array.isArray(rawFields.extraction_warnings)
    ? (rawFields.extraction_warnings as SchemaExtractionResult['extraction_warnings'])
    : []

  log.info(
    {
      schema: schema.contract_type,
      field_count: Object.keys(fields).length,
      findings: additional_findings.length,
      warnings: extraction_warnings.length,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    'Schema-extraction fuldført'
  )

  return {
    fields,
    additional_findings,
    extraction_warnings,
    model_used: response.model,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    raw_response: response,
  }
}

function buildContent(
  content: ExtractionContent,
  userPromptPrefix: string,
  extractionModel: ContractSchema['extraction_model']
): string | ClaudeContentBlock[] {
  if (content.type === 'pdf_binary') {
    // Verificeret: PDF-tokens ≈ 3800 pr. side (tekst 2000-2500 + image ~1600)
    const estimatedTokens = content.page_count * 3800
    const shouldCache = canCacheForModel(extractionModel, estimatedTokens)

    const docBlock: ClaudeContentBlock = {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: content.data.toString('base64'),
      },
      ...(shouldCache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    }
    return [docBlock, { type: 'text', text: userPromptPrefix }]
  }

  if (content.type === 'text_html') {
    return `${userPromptPrefix}\n\nDokumentindhold (HTML):\n\n${content.html}`
  }

  if (content.type === 'text_markdown') {
    return `${userPromptPrefix}\n\nDokumentindhold (Markdown):\n\n${content.markdown}`
  }

  return userPromptPrefix
}
