// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OnboardingPanel } from '@/components/dashboard/onboarding-panel'
import type { OnboardingStatus } from '@/actions/onboarding'

function makeStatus(overrides: Partial<OnboardingStatus> = {}): OnboardingStatus {
  return {
    shouldShow: true,
    hasCompany: false,
    hasContract: false,
    hasAdditionalUser: false,
    completedCount: 0,
    totalCount: 3,
    orgAgeInDays: 1,
    ...overrides,
  }
}

describe('OnboardingPanel', () => {
  it('renderer intet når shouldShow=false', () => {
    const { container } = render(<OnboardingPanel status={makeStatus({ shouldShow: false })} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderer header og 3 steps når shouldShow=true', () => {
    render(<OnboardingPanel status={makeStatus()} />)
    expect(screen.getByText(/Kom godt i gang med ChainHub/)).toBeDefined()
    expect(screen.getByText(/Opret dit første selskab/)).toBeDefined()
    expect(screen.getByText(/Tilføj din første kontrakt/)).toBeDefined()
    expect(screen.getByText(/Invitér en kollega/)).toBeDefined()
  })

  it('viser progress "0 af 3 færdige" i initial state', () => {
    render(<OnboardingPanel status={makeStatus()} />)
    expect(screen.getByText(/0 af 3 færdige/)).toBeDefined()
  })

  it('viser "Færdig"-label og line-through på done-step', () => {
    render(<OnboardingPanel status={makeStatus({ hasCompany: true, completedCount: 1 })} />)
    expect(screen.getAllByText(/Færdig/).length).toBeGreaterThan(0)
    const title = screen.getByText(/Opret dit første selskab/)
    expect(title.className).toContain('line-through')
  })

  it('kontrakt-step er disabled når intet selskab findes og viser disabledReason', () => {
    render(<OnboardingPanel status={makeStatus()} />)
    expect(screen.getByText(/Opret først et selskab/)).toBeDefined()
    // kontrakt-link må ikke findes som link når disabled
    const links = screen.getAllByRole('link')
    expect(links.some((l) => l.getAttribute('href') === '/contracts/new')).toBe(false)
  })

  it('kontrakt-step er klikbart når selskab findes', () => {
    render(<OnboardingPanel status={makeStatus({ hasCompany: true, completedCount: 1 })} />)
    const links = screen.getAllByRole('link')
    expect(links.some((l) => l.getAttribute('href') === '/contracts/new')).toBe(true)
  })

  it('selskab-step er link til /companies/new', () => {
    render(<OnboardingPanel status={makeStatus()} />)
    const links = screen.getAllByRole('link')
    expect(links.some((l) => l.getAttribute('href') === '/companies/new')).toBe(true)
  })

  it('user-step er link til /settings', () => {
    render(<OnboardingPanel status={makeStatus()} />)
    const links = screen.getAllByRole('link')
    expect(links.some((l) => l.getAttribute('href') === '/settings')).toBe(true)
  })
})
