import { describe, it, expect } from 'vitest'
import { contactSchema } from '@/lib/validations/contact'
import { createContractSchema } from '@/lib/validations/contract'
import { reviewDocumentSchema } from '@/lib/validations/document-review'
import { createPersonSchema } from '@/lib/validations/person'

const LONG = 'a'.repeat(6000)

describe('Zod max-grænser på fritekst-felter', () => {
  describe('createPersonSchema', () => {
    it('afviser phone > 30 tegn', () => {
      const result = createPersonSchema.safeParse({
        firstName: 'Test',
        lastName: 'Person',
        phone: 'a'.repeat(31),
      })
      expect(result.success).toBe(false)
    })

    it('afviser notes > 5000 tegn', () => {
      const result = createPersonSchema.safeParse({
        firstName: 'Test',
        lastName: 'Person',
        notes: LONG,
      })
      expect(result.success).toBe(false)
    })

    it('accepterer notes på præcis 5000 tegn', () => {
      const result = createPersonSchema.safeParse({
        firstName: 'Test',
        lastName: 'Person',
        notes: 'a'.repeat(5000),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('contactSchema', () => {
    it('afviser name > 100 tegn', () => {
      const result = contactSchema.safeParse({
        name: 'a'.repeat(101),
        email: 'test@example.com',
        message: 'kort besked her',
      })
      expect(result.success).toBe(false)
    })

    it('afviser message > 3000 tegn', () => {
      const result = contactSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        message: LONG,
      })
      expect(result.success).toBe(false)
    })

    it('accepterer company op til 200 tegn', () => {
      const result = contactSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        company: 'a'.repeat(200),
        message: 'en besked her',
      })
      expect(result.success).toBe(true)
    })

    it('afviser company > 200 tegn', () => {
      const result = contactSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        company: 'a'.repeat(201),
        message: 'en besked',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createContractSchema', () => {
    const BASE = {
      companyId: 'comp-1',
      systemType: 'EJERAFTALE',
      displayName: 'Test kontrakt',
      sensitivity: 'INTERN',
    }

    it('afviser notes > 5000 tegn', () => {
      const result = createContractSchema.safeParse({ ...BASE, notes: LONG })
      expect(result.success).toBe(false)
    })

    it('accepterer en gyldig ISO-dato i effectiveDate', () => {
      const result = createContractSchema.safeParse({
        ...BASE,
        effectiveDate: '2026-01-15',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.effectiveDate).toBeInstanceOf(Date)
      }
    })

    it('afviser ugyldig dato i effectiveDate', () => {
      const result = createContractSchema.safeParse({
        ...BASE,
        effectiveDate: 'ikke-en-dato',
      })
      expect(result.success).toBe(false)
    })

    it('afviser ugyldig dato i expiryDate', () => {
      const result = createContractSchema.safeParse({
        ...BASE,
        expiryDate: '9999-99-99',
      })
      expect(result.success).toBe(false)
    })

    it('accepterer tom streng i expiryDate (ingen udløb)', () => {
      const result = createContractSchema.safeParse({
        ...BASE,
        expiryDate: '',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('reviewDocumentSchema', () => {
    it('afviser comment > 2000 tegn', () => {
      const result = reviewDocumentSchema.safeParse({
        documentId: 'doc-1',
        decision: 'GODKENDT',
        comment: 'a'.repeat(2001),
      })
      expect(result.success).toBe(false)
    })

    it('accepterer comment på præcis 2000 tegn', () => {
      const result = reviewDocumentSchema.safeParse({
        documentId: 'doc-1',
        decision: 'GODKENDT',
        comment: 'a'.repeat(2000),
      })
      expect(result.success).toBe(true)
    })
  })
})
