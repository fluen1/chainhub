import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageHeader, MetaSep } from '@/components/ui/b/PageHeader'

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Lejekontrakt erhverv" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lejekontrakt erhverv')
  })

  it('renders statusBadge inside the heading when provided', () => {
    render(<PageHeader title="Ejeraftale" statusBadge={<span data-testid="badge">Aktiv</span>} />)
    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByRole('heading')).toContainElement(screen.getByTestId('badge'))
  })

  it('renders meta text when provided', () => {
    render(<PageHeader title="Kontrakt" meta="Tandlæge Østerbro · LEJEKONTRAKT" />)
    expect(screen.getByText('Tandlæge Østerbro · LEJEKONTRAKT')).toBeInTheDocument()
  })

  it('does not render meta section when meta is absent', () => {
    render(<PageHeader title="Kontrakt" />)
    // Only the h1 should exist — no meta div
    expect(screen.queryByText(/Tandlæge/)).not.toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    render(<PageHeader title="Kontrakt" actions={<button>Rediger</button>} />)
    expect(screen.getByRole('button', { name: 'Rediger' })).toBeInTheDocument()
  })

  it('renders as a <header> element', () => {
    const { container } = render(<PageHeader title="Test" />)
    expect(container.querySelector('header')).toBeInTheDocument()
  })
})

describe('MetaSep', () => {
  it('renders a "·" separator character', () => {
    render(<MetaSep />)
    expect(screen.getByText('·')).toBeInTheDocument()
  })
})
