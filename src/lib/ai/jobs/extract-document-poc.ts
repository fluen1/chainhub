import { prisma } from '@/lib/db'
import { createClaudeClient, computeCostUsd } from '@/lib/ai/client'
import { loadForExtraction } from '@/lib/ai/content-loader'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('extract-poc')

export interface ExtractDocumentPocPayload {
  document_id: string
  organization_id: string
  file_buffer_base64: string
  filename: string
}

export interface ExtractDocumentPocResult {
  extraction_id: string
  summary: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export async function extractDocumentPoc(
  payload: ExtractDocumentPocPayload,
): Promise<ExtractDocumentPocResult> {
  log.info(
    { document_id: payload.document_id, filename: payload.filename },
    'Starting PoC extraction',
  )

  const buffer = Buffer.from(payload.file_buffer_base64, 'base64')
  const content = await loadForExtraction(buffer, payload.filename)

  if (content.type !== 'pdf_binary') {
    throw new Error(`PoC only supports PDF. Got: ${content.type}`)
  }

  const client = createClaudeClient()
  const model = 'claude-3-5-haiku-20241022' as const

  const response = await client.complete({
    model,
    max_tokens: 1024,
    system:
      'You are analyzing a Danish legal contract. Return a JSON object with keys: summary (1-2 sentences in Danish), contract_type_guess (your best guess at contract type in English), language (detected language code). No commentary, only valid JSON.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: content.data.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Analyze this document and return the JSON as instructed.',
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : ''

  const costUsd = computeCostUsd(
    model,
    response.usage.input_tokens,
    response.usage.output_tokens,
  )

  log.info(
    {
      document_id: payload.document_id,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost_usd: costUsd,
    },
    'Claude extraction complete',
  )

  const extraction = await prisma.documentExtraction.create({
    data: {
      document_id: payload.document_id,
      organization_id: payload.organization_id,
      model_name: response.model,
      model_temperature: 0,
      extracted_fields: { summary_text: rawText },
      raw_response: response as never,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_cost_usd: costUsd,
      extraction_status: 'completed',
    },
  })

  return {
    extraction_id: extraction.id,
    summary: rawText,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cost_usd: costUsd,
  }
}
