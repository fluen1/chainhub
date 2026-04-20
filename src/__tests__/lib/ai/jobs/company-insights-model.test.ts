import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('company-insights — model-valg', () => {
  it('bruger claude-haiku-4-5 (ikke Sonnet)', () => {
    const src = readFileSync(resolve('src/lib/ai/jobs/company-insights.ts'), 'utf-8')
    expect(src).toMatch(/MODEL\s*:\s*ClaudeModel\s*=\s*['"]claude-haiku-4-5['"]/)
    expect(src).not.toMatch(/claude-sonnet/)
  })
})
