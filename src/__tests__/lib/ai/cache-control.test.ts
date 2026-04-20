import { describe, it, expect } from 'vitest'
import { withCacheControl, canCacheForModel, MIN_CACHE_TOKENS } from '@/lib/ai/cache-control'
import type { ClaudeTool } from '@/lib/ai/client/types'

describe('cache-control helpers', () => {
  it('MIN_CACHE_TOKENS matcher Anthropic-docs 2026-04-19', () => {
    expect(MIN_CACHE_TOKENS['claude-sonnet-4-6']).toBe(2048)
    expect(MIN_CACHE_TOKENS['claude-haiku-4-5']).toBe(4096)
    expect(MIN_CACHE_TOKENS['claude-opus-4-7']).toBe(4096)
  })

  it('canCacheForModel returnerer true når estimeret tokens >= minimum', () => {
    expect(canCacheForModel('claude-sonnet-4-6', 2500)).toBe(true)
    expect(canCacheForModel('claude-sonnet-4-6', 1500)).toBe(false)
    expect(canCacheForModel('claude-haiku-4-5', 4500)).toBe(true)
    expect(canCacheForModel('claude-haiku-4-5', 3500)).toBe(false)
  })

  it('withCacheControl tilføjer ephemeral cache_control til tool', () => {
    const tool: ClaudeTool = {
      name: 'extract_test',
      description: 'desc',
      input_schema: { type: 'object' },
    }
    const cached = withCacheControl(tool)
    expect(cached.cache_control).toEqual({ type: 'ephemeral' })
    expect(cached.name).toBe('extract_test')
  })

  it('withCacheControl returnerer nyt objekt (immutability)', () => {
    const tool: ClaudeTool = { name: 't', description: 'd', input_schema: {} }
    const cached = withCacheControl(tool)
    expect(tool.cache_control).toBeUndefined()
    expect(cached).not.toBe(tool)
  })
})
