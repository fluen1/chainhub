import type { ClaudeTool, ClaudeModel } from '@/lib/ai/client/types'

export interface FieldMetadata {
  legal_critical: boolean
  required: boolean
  auto_accept_threshold?: number
  description: string
}

export interface SanityRule {
  field: string
  check: (value: unknown, allFields: Record<string, unknown>) => boolean
  message: string
}

export interface CrossValidationRule {
  extracted_field: string
  description: string
}

export interface ContractSchema {
  contract_type: string
  schema_version: string
  display_name: string

  tool_definition: ClaudeTool
  field_metadata: Record<string, FieldMetadata>

  system_prompt: string
  user_prompt_prefix: string

  extraction_model: ClaudeModel

  sanity_rules: SanityRule[]
  cross_validation_rules: CrossValidationRule[]
}

export const COMMON_TOOL_PROPERTIES = {
  additional_findings: {
    type: 'array' as const,
    description:
      'Anything found in the document NOT covered by other fields. Report unusual clauses, missing standard elements, or noteworthy observations.',
    items: {
      type: 'object' as const,
      properties: {
        finding: { type: 'string' as const },
        source_page: { type: 'number' as const },
        importance: { type: 'string' as const, enum: ['critical', 'informational'] },
      },
      required: ['finding', 'importance'],
    },
  },
  extraction_warnings: {
    type: 'array' as const,
    description:
      'Warnings about extraction quality or reliability. Report ambiguities, unusual document structure, low-confidence areas.',
    items: {
      type: 'object' as const,
      properties: {
        warning: { type: 'string' as const },
        severity: { type: 'string' as const, enum: ['high', 'medium', 'low'] },
      },
      required: ['warning', 'severity'],
    },
  },
}

export interface ExtractedFieldValue {
  value: unknown
  claude_confidence: number
  source_page: number | null
  source_text: string | null
}
