import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('company-insights — model-valg', () => {
  it('bruger gpt-5-nano (ikke større model)', () => {
    const src = readFileSync(resolve('src/lib/ai/jobs/company-insights.ts'), 'utf-8')
    expect(src).toMatch(/MODEL\s*:\s*ClaudeModel\s*=\s*['"]gpt-5-nano['"]/)
    expect(src).not.toMatch(/gpt-5-mini|gpt-5(?!-nano)/)
  })
})
