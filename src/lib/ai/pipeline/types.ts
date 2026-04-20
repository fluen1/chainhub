export interface TypeDetectionResult {
  detected_type: string
  confidence: number
  alternatives: Array<{ type: string; confidence: number }>
  model_used: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export interface SchemaExtractionResult {
  fields: Record<string, ExtractedField>
  additional_findings: Array<{ finding: string; source_page: number | null; importance: string }>
  extraction_warnings: Array<{ warning: string; severity: string }>
  model_used: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  raw_response: unknown
}

export interface ExtractedField {
  value: unknown
  claude_confidence: number
  source_page: number | null
  source_text: string | null
}

export interface AgreementResult {
  field_name: string
  run1_value: unknown
  run2_value: unknown
  values_match: boolean
}

export interface SourceVerificationResult {
  field_name: string
  verified: boolean
  match_score: number
}

export interface SanityCheckResult {
  field_name: string
  passed: boolean
  rule: string
  message?: string
}

export interface CrossValidationResult {
  field_name: string
  ai_value: unknown
  existing_value: unknown
  match: boolean
}

export interface FieldConfidence {
  field_name: string
  confidence: number
  components: {
    agreement: number
    source_verified: number
    sanity_passed: number
    claude_self: number
  }
}

export interface PipelineResult {
  type_detection: TypeDetectionResult
  extraction_run1: SchemaExtractionResult
  extraction_run2: SchemaExtractionResult | null
  agreement: AgreementResult[]
  source_verification: SourceVerificationResult[]
  sanity_checks: SanityCheckResult[]
  cross_validation: CrossValidationResult[]
  field_confidences: FieldConfidence[]
  additional_findings: Array<{ finding: string; source_page: number | null; importance: string }>
  extraction_warnings: Array<{ warning: string; severity: string }>
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
  total_cost_usd: number
}

export interface PipelineCheckpoint {
  type_result?: TypeDetectionResult
  run1?: SchemaExtractionResult
}

export interface PipelineOptions {
  document_id: string
  organization_id?: string
  /**
   * Styrer Pass 2b (2. extraction-run for agreement-scoring).
   * - undefined (default): confidence-gated — 2b kører kun hvis Pass 2a har min-confidence < 0.75
   * - true: tving 1-run (spar cost; agreement-score bliver tom)
   * - false: tving 2-run (eksplicit opt-in til fuld agreement-scoring)
   */
  skip_agreement?: boolean
  forced_type?: string
  /**
   * Resumable checkpoint fra et tidligere kørsel-forsøg.
   * Hvis til stede, springer orchestrator de færdige passes over.
   */
  checkpoint?: PipelineCheckpoint
  /**
   * Kaldes efter hvert succesfuldt pass med den opdaterede checkpoint-state.
   * Brugt til at persistere checkpoint i DB så retry kan genoptage.
   */
  onCheckpoint?: (cp: PipelineCheckpoint) => Promise<void>
}
