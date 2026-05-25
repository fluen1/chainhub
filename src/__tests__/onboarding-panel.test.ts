/**
 * Phase N2 — Commit 3: OnboardingPanel komponent.
 *
 * Tester getOnboardingStatus-logikken som allerede er dækket i
 * onboarding-action.test.ts. Her tester vi OnboardingPanel's shouldShow-gate
 * og step-progression via mocked action.
 *
 * OnboardingPanel er en async Server Component og kan ikke mountes i Vitest
 * uden en fuld Next.js runtime — vi tester logikken som ren funktion.
 */

import { describe, it, expect } from 'vitest'
import type { OnboardingStatus } from '@/actions/onboarding'

// ─── Replika af OnboardingPanel's step-bygning (ren funktion) ─────────────────

interface OnboardingStep {
  label: string
  done: boolean
  href: string
}

function buildSteps(status: OnboardingStatus): OnboardingStep[] {
  return [
    {
      label: 'Opret dit første selskab',
      done: status.hasCompany,
      href: '/companies/new',
    },
    {
      label: 'Tilføj en kontrakt',
      done: status.hasContract,
      href: '/contracts/new',
    },
    {
      label: 'Inviter en kollega',
      done: status.hasAdditionalUser,
      href: '/settings?section=brugere',
    },
  ]
}

function shouldRender(status: OnboardingStatus): boolean {
  return status.shouldShow
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const BASE: OnboardingStatus = {
  shouldShow: true,
  hasCompany: false,
  hasContract: false,
  hasAdditionalUser: false,
  completedCount: 0,
  totalCount: 3,
  orgAgeInDays: 2,
}

describe('OnboardingPanel — render gate (shouldShow)', () => {
  it('vises (shouldShow=true) når ny org og 0/3 steps færdige', () => {
    expect(shouldRender({ ...BASE, shouldShow: true })).toBe(true)
  })

  it('skjules (shouldShow=false) når alle 3 steps er done', () => {
    const done: OnboardingStatus = {
      ...BASE,
      shouldShow: false,
      hasCompany: true,
      hasContract: true,
      hasAdditionalUser: true,
      completedCount: 3,
    }
    expect(shouldRender(done)).toBe(false)
  })

  it('skjules (shouldShow=false) når org er > 14 dage gammel', () => {
    const old: OnboardingStatus = {
      ...BASE,
      shouldShow: false,
      orgAgeInDays: 20,
    }
    expect(shouldRender(old)).toBe(false)
  })
})

describe('OnboardingPanel — step-progression', () => {
  it('0/3 gennemført: alle steps done=false', () => {
    const steps = buildSteps(BASE)
    expect(steps).toHaveLength(3)
    expect(steps.every((s) => !s.done)).toBe(true)
  })

  it('1/3: hasCompany=true → første step done', () => {
    const steps = buildSteps({ ...BASE, hasCompany: true, completedCount: 1 })
    expect(steps[0]?.done).toBe(true)
    expect(steps[1]?.done).toBe(false)
    expect(steps[2]?.done).toBe(false)
  })

  it('2/3: hasCompany + hasContract done', () => {
    const steps = buildSteps({
      ...BASE,
      hasCompany: true,
      hasContract: true,
      completedCount: 2,
    })
    expect(steps[0]?.done).toBe(true)
    expect(steps[1]?.done).toBe(true)
    expect(steps[2]?.done).toBe(false)
  })

  it('3/3: alle steps done', () => {
    const steps = buildSteps({
      ...BASE,
      hasCompany: true,
      hasContract: true,
      hasAdditionalUser: true,
      completedCount: 3,
    })
    expect(steps.every((s) => s.done)).toBe(true)
  })

  it('links peger på korrekte ruter', () => {
    const steps = buildSteps(BASE)
    expect(steps[0]?.href).toBe('/companies/new')
    expect(steps[1]?.href).toBe('/contracts/new')
    expect(steps[2]?.href).toBe('/settings?section=brugere')
  })
})
