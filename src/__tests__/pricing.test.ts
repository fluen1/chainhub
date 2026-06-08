import { describe, it, expect } from 'vitest'
import { PRICING_TIERS, ONBOARDING_FEE } from '@/lib/pricing'

describe('PRICING_TIERS — låste kommercielle beslutninger (2026-06-07/08)', () => {
  const byId = (id: string) => PRICING_TIERS.find((t) => t.id === id)!

  it('har præcis tre tiers: basis, plus, enterprise', () => {
    expect(PRICING_TIERS.map((t) => t.id)).toEqual(['basis', 'plus', 'enterprise'])
  })

  it('Basis = 3.500 kr./md uden AI', () => {
    const basis = byId('basis')
    expect(basis.price).toBe('3.500 kr.')
    // Basis er kerne-CRM UDEN AI
    expect(JSON.stringify(basis).toLowerCase()).not.toContain('ai-ekstraktion')
  })

  it('Plus = 9.500 kr./md, 50 ekstraktioner inkl., 75 kr./ekstra', () => {
    const plus = byId('plus')
    expect(plus.price).toBe('9.500 kr.')
    expect(plus.priceNote).toContain('50')
    expect(plus.features.join(' ')).toContain('75 kr.')
  })

  it('Enterprise = forhandles, floor 32.000 kr./md, fair-use 500/md', () => {
    const ent = byId('enterprise')
    expect(ent.price.toLowerCase()).toContain('forhandles')
    expect(ent.priceNote).toContain('32.000')
    expect(ent.priceNote).toContain('500')
  })

  it('onboarding-fee = 1 kr./dokument, maks 2.500 kr.', () => {
    expect(ONBOARDING_FEE.perDocument).toBe(1)
    expect(ONBOARDING_FEE.cap).toBe(2500)
  })

  it('nævner ALDRIG dental/tandlæge (bindende dental-eksklusion)', () => {
    const blob = (JSON.stringify(PRICING_TIERS) + JSON.stringify(ONBOARDING_FEE)).toLowerCase()
    expect(blob).not.toContain('tandlæge')
    expect(blob).not.toContain('tandlaege')
    expect(blob).not.toContain('dental')
  })
})
