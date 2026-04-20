import type { ClaudeModel, ClaudeTool } from './client/types'

/**
 * Minimum cacheable block-sizes pr. Anthropic-docs 2026-04-19.
 * Blocks under disse størrelser kan ikke caches — cache_control ignoreres stille
 * og både cache_creation_input_tokens + cache_read_input_tokens vil være 0.
 */
export const MIN_CACHE_TOKENS: Record<ClaudeModel, number> = {
  'claude-opus-4-7': 4096,
  'claude-sonnet-4-6': 2048,
  'claude-haiku-4-5': 4096,
}

export function canCacheForModel(model: ClaudeModel, estimatedTokens: number): boolean {
  return estimatedTokens >= MIN_CACHE_TOKENS[model]
}

/**
 * Tilføjer cache_control: ephemeral til et tool — immutable, returnerer nyt objekt.
 * Anbefalet placering: sidste tool i tools-array (cache breakpoint).
 */
export function withCacheControl(tool: ClaudeTool): ClaudeTool {
  return { ...tool, cache_control: { type: 'ephemeral' } }
}
