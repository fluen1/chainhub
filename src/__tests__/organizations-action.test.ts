import { describe, it, expect } from 'vitest'
import { updateOrganizationSchema } from '@/lib/validations/organization'

describe('updateOrganizationSchema', () => {
  it('accepterer gyldigt input med CVR', () => {
    const result = updateOrganizationSchema.safeParse({
      name: 'TandlægeGruppen A/S',
      cvr: '10000001',
      chain_structure: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepterer tom CVR', () => {
    const result = updateOrganizationSchema.safeParse({
      name: 'Test ApS',
      cvr: '',
      chain_structure: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepterer manglende CVR (undefined)', () => {
    const result = updateOrganizationSchema.safeParse({
      name: 'Test ApS',
      chain_structure: false,
    })
    expect(result.success).toBe(true)
  })

  it('afviser tomt navn', () => {
    const result = updateOrganizationSchema.safeParse({
      name: '',
      cvr: '10000001',
      chain_structure: true,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Navn er påkrævet')
    }
  })

  it('afviser CVR der ikke er 8 cifre', () => {
    const result = updateOrganizationSchema.safeParse({
      name: 'Test ApS',
      cvr: '1234',
      chain_structure: false,
    })
    expect(result.success).toBe(false)
  })

  it('afviser navn over 255 tegn', () => {
    const result = updateOrganizationSchema.safeParse({
      name: 'A'.repeat(256),
      cvr: '',
      chain_structure: false,
    })
    expect(result.success).toBe(false)
  })

  it('afviser manglende chain_structure', () => {
    const result = updateOrganizationSchema.safeParse({
      name: 'Test ApS',
      cvr: '',
    })
    expect(result.success).toBe(false)
  })
})
