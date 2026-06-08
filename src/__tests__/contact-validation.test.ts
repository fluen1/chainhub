import { describe, it, expect } from 'vitest'
import { contactSchema } from '@/lib/validations/contact'

const valid = {
  name: 'Test Tester',
  email: 'test@optikgruppen.dk',
  company: 'OptikGruppen',
  message: 'Vi vil gerne høre mere om Plus-planen til vores kæde.',
}

describe('contactSchema', () => {
  it('accepterer gyldigt input', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })

  it('company er valgfrit', () => {
    const { company: _omit, ...rest } = valid
    expect(contactSchema.safeParse(rest).success).toBe(true)
  })

  it('afviser ugyldig e-mail', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'ikke-en-email' }).success).toBe(false)
  })

  it('afviser for kort navn', () => {
    expect(contactSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false)
  })

  it('afviser for kort besked (< 10 tegn)', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'kort' }).success).toBe(false)
  })
})
