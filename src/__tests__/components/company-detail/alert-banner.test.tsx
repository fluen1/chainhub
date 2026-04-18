import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertBanner } from '@/components/company-detail/alert-banner'

describe('AlertBanner', () => {
  it('viser title, sub og action-label', () => {
    render(
      <AlertBanner
        severity="critical"
        title="Ejeraftale udloebet"
        sub="Dr. Petersen — frist overskredet"
        actionLabel="Se kontrakt"
        actionHref="/contracts/abc"
      />
    )
    expect(screen.getByText('Ejeraftale udloebet')).toBeInTheDocument()
    expect(screen.getByText('Dr. Petersen — frist overskredet')).toBeInTheDocument()
    expect(screen.getByText('Se kontrakt')).toBeInTheDocument()
  })

  it('bruger roede farver for critical severity', () => {
    const { container } = render(
      <AlertBanner severity="critical" title="t" sub="s" actionLabel="a" actionHref="/x" />
    )
    expect(container.firstChild).toHaveClass('bg-red-50')
  })

  it('bruger amber farver for warning severity', () => {
    const { container } = render(
      <AlertBanner severity="warning" title="t" sub="s" actionLabel="a" actionHref="/x" />
    )
    expect(container.firstChild).toHaveClass('bg-amber-50')
  })

  it('action-link peger paa actionHref', () => {
    render(
      <AlertBanner severity="critical" title="t" sub="s" actionLabel="Go" actionHref="/cases/123" />
    )
    const link = screen.getByRole('link', { name: 'Go' })
    expect(link).toHaveAttribute('href', '/cases/123')
  })
})
