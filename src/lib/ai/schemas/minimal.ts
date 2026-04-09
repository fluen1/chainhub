import type { ContractSchema } from './types'
import { COMMON_TOOL_PROPERTIES } from './types'
import { registerSchema } from './registry'

const minimalSchema: ContractSchema = {
  contract_type: 'MINIMAL',
  schema_version: 'v1.0.0',
  display_name: 'Ukendt kontrakttype',
  extraction_model: 'claude-3-5-haiku-20241022', // cheap model for basic extraction

  tool_definition: {
    name: 'extract_minimal',
    description: 'Minimal extraction for unknown document types',
    input_schema: {
      type: 'object',
      properties: {
        parties: {
          type: 'object',
          properties: {
            value: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } }, required: ['name'] } },
            claude_confidence: { type: 'number' },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
          },
        },
        effective_date: {
          type: 'object',
          properties: {
            value: { type: 'string' },
            claude_confidence: { type: 'number' },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
          },
        },
        key_amounts: {
          type: 'object',
          properties: {
            value: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, amount_dkk: { type: 'number' } } } },
            claude_confidence: { type: 'number' },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
          },
        },
        summary: {
          type: 'object',
          properties: {
            value: { type: 'string', description: 'Sammenfatning af dokumentet i 1-3 sætninger' },
            claude_confidence: { type: 'number' },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
          },
        },
        detected_clauses: {
          type: 'object',
          properties: {
            value: { type: 'array', items: { type: 'string' }, description: 'Fundne klausuler som fri tekst' },
            claude_confidence: { type: 'number' },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
          },
        },
        ...COMMON_TOOL_PROPERTIES,
      },
    },
  },

  field_metadata: {
    parties: { legal_critical: true, required: false, description: 'Parter i dokumentet' },
    effective_date: { legal_critical: true, required: false, description: 'Dato' },
    key_amounts: { legal_critical: false, required: false, description: 'Nøglebeløb' },
    summary: { legal_critical: false, required: false, description: 'Sammenfatning' },
    detected_clauses: { legal_critical: false, required: false, description: 'Fundne klausuler' },
  },

  system_prompt: `Du analyserer et dansk juridisk dokument af ukendt type. Ekstraher hvad du kan finde: parter, datoer, beløb, og en kort sammenfatning. Rapporter fundne klausuler som fri tekst. Hvis du ikke kan finde et felt, returner null.`,
  user_prompt_prefix: 'Analyser dette dokument og ekstraher grundlæggende information via extract_minimal tool.',

  sanity_rules: [], // no specific rules for minimal
  cross_validation_rules: [],
}

registerSchema(minimalSchema)

export { minimalSchema }
