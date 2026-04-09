import type { SanityRule } from '@/lib/ai/schemas/types'
import type { ExtractedField, SanityCheckResult } from './types'

export function runSanityChecks(
  fields: Record<string, ExtractedField>,
  rules: SanityRule[],
): SanityCheckResult[] {
  const values = extractValues(fields)
  return rules.map((rule) => {
    const field = fields[rule.field]
    const passed = field ? rule.check(field.value, values) : true
    return {
      field_name: rule.field,
      passed,
      rule: rule.message,
      message: passed ? undefined : rule.message,
    }
  })
}

function extractValues(fields: Record<string, ExtractedField>): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(fields)) {
    values[key] = field.value
  }
  return values
}
