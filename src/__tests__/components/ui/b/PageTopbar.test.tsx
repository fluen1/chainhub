import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageTopbar } from '@/components/ui/b/PageTopbar'

describe('PageTopbar', () => {
  it('renders title text', () => {
    render(<PageTopbar title="Min portefølje · Onsdag 14. maj 2026" />)
    expect(screen.getByText('Min portefølje · Onsdag 14. maj 2026')).toBeInTheDocument()
  })

  it('renders as h1', () => {
    render(<PageTopbar title="Selskaber" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Selskaber')
  })

  it('renders meta when provided', () => {
    render(<PageTopbar title="Selskaber" meta="Sidst opdateret 14:32" />)
    expect(screen.getByText('Sidst opdateret 14:32')).toBeInTheDocument()
  })

  it('does not render meta section when omitted', () => {
    render(<PageTopbar title="Selskaber" />)
    expect(screen.queryByText(/Sidst opdateret/)).not.toBeInTheDocument()
  })

  it('renders ReactNode as title', () => {
    render(<PageTopbar title={<span data-testid="custom-title">Brugerdefineret</span>} />)
    expect(screen.getByTestId('custom-title')).toBeInTheDocument()
  })
})
