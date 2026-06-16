import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Vi gengiver skemaet manuelt for at teste det isoleret fra process.env.
// Alternativet — at importere env.ts — ville kaste ved manglende variabler.

const isBuildPhase = false
const isProd = true

const requiredInProd = (msg: string) =>
  isProd
    ? z
        .string({ error: () => `${msg} — påkrævet i production` })
        .min(1, `${msg} — påkrævet i production`)
    : z.string().optional()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  OPENAI_API_KEY: requiredInProd('OPENAI_API_KEY'),
  AI_EXTRACTION_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  OPENAI_BASE_URL: z.string().url().optional(),
})

describe('env-skema — prod-krav', () => {
  it('OPENAI_API_KEY er påkrævet i prod — fejler uden den', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      // OPENAI_API_KEY mangler bevidst
    })
    expect(result.success).toBe(false)
    const messages = result.success ? [] : result.error.issues.map((i) => i.message)
    expect(messages.some((m) => m.includes('OPENAI_API_KEY'))).toBe(true)
  })

  it('OPENAI_API_KEY er tilladt i prod når sat', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test-1234',
    })
    expect(result.success).toBe(true)
  })

  it('AI_EXTRACTION_ENABLED defaulter til false', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.AI_EXTRACTION_ENABLED).toBe('false')
    }
  })

  it('AI_EXTRACTION_ENABLED accepterer kun "true" eller "false"', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test',
      AI_EXTRACTION_ENABLED: 'yes',
    })
    expect(result.success).toBe(false)
  })

  it('OPENAI_BASE_URL er valgfri men valideres som URL', () => {
    const bad = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_BASE_URL: 'ikke-en-url',
    })
    expect(bad.success).toBe(false)

    const good = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
    })
    expect(good.success).toBe(true)
  })
})
