import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AIInsightCard, PlusBadge } from '@/components/ui/b/AIInsightCard'

describe('AIInsightCard', () => {
  it('renders label', () => {
    render(<AIInsightCard label="⚡ Renewal-risk">Analysetekst</AIInsightCard>)
    expect(screen.getByText('⚡ Renewal-risk')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <AIInsightCard label="Test">Forventet markedsleje er 10–12% over markedsværdi</AIInsightCard>
    )
    expect(
      screen.getByText('Forventet markedsleje er 10–12% over markedsværdi')
    ).toBeInTheDocument()
  })

  it('renders confidence when provided', () => {
    render(
      <AIInsightCard label="Risk" confidence="82% konfidens">
        Indhold
      </AIInsightCard>
    )
    expect(screen.getByText('82% konfidens')).toBeInTheDocument()
  })

  it('does not render confidence section when omitted', () => {
    render(<AIInsightCard label="Risk">Indhold</AIInsightCard>)
    expect(screen.queryByText(/konfidens/)).not.toBeInTheDocument()
  })

  it('renders cite when provided', () => {
    render(
      <AIInsightCard label="Risk" cite="Kilde: Ejeraftale §4">
        Indhold
      </AIInsightCard>
    )
    expect(screen.getByText('Kilde: Ejeraftale §4')).toBeInTheDocument()
  })

  it('renders action link when actionHref provided', () => {
    render(
      <AIInsightCard label="Risk" actionHref="/contracts/123" actionLabel="Se kontrakt →">
        Indhold
      </AIInsightCard>
    )
    expect(screen.getByRole('link', { name: 'Se kontrakt →' })).toHaveAttribute(
      'href',
      '/contracts/123'
    )
  })

  it('uses default action label "Se mere →" when actionHref set but no actionLabel', () => {
    render(
      <AIInsightCard label="Risk" actionHref="/contracts/123">
        Indhold
      </AIInsightCard>
    )
    expect(screen.getByText('Se mere →')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    const { container } = render(
      <AIInsightCard label="Test" className="mt-4">
        Indhold
      </AIInsightCard>
    )
    expect(container.firstChild).toHaveClass('mt-4')
  })
})

describe('PlusBadge', () => {
  it('renders "Plus" text', () => {
    render(<PlusBadge />)
    expect(screen.getByText('Plus')).toBeInTheDocument()
  })
})
