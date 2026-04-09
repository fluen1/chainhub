import { prisma } from '@/lib/db'
import { createLogger } from './logger'

const log = createLogger('feedback')

export async function logFieldCorrection(params: {
  extraction_id: string
  organization_id: string
  field_name: string
  ai_value: unknown
  user_value: unknown
  confidence: number | null
  schema_version: string | null
  prompt_version: string | null
  corrected_by: string
}): Promise<string> {
  const correction = await prisma.aIFieldCorrection.create({
    data: {
      extraction_id: params.extraction_id,
      organization_id: params.organization_id,
      field_name: params.field_name,
      ai_value: params.ai_value as never,
      user_value: params.user_value as never,
      confidence: params.confidence,
      schema_version: params.schema_version,
      prompt_version: params.prompt_version,
      corrected_by: params.corrected_by,
    },
  })

  log.info({
    extraction_id: params.extraction_id,
    field_name: params.field_name,
    confidence: params.confidence,
  }, 'Field correction logged')

  return correction.id
}
