import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PanelEmpty } from '@/components/ui/b/PanelEmpty'

describe('PanelEmpty — single-line mode', () => {
  it('renders children as single-line empty state', () => {
    render(<PanelEmpty>Ingen sager</PanelEmpty>)
    expect(screen.getByText('Ingen sager')).toBeInTheDocument()
  })
})

describe('PanelEmpty — title + hint mode', () => {
  it('renders title', () => {
    render(<PanelEmpty title="Ingen parter" />)
    expect(screen.getByText('Ingen parter')).toBeInTheDocument()
  })

  it('renders hint', () => {
    render(<PanelEmpty hint="Tilføj for at signere" />)
    expect(screen.getByText('Tilføj for at signere')).toBeInTheDocument()
  })

  it('renders both title and hint together', () => {
    render(<PanelEmpty title="Ingen parter" hint="Tilføj for at signere" />)
    expect(screen.getByText('Ingen parter')).toBeInTheDocument()
    expect(screen.getByText('Tilføj for at signere')).toBeInTheDocument()
  })
})

describe('PanelEmpty — custom className', () => {
  it('applies custom className', () => {
    const { container } = render(<PanelEmpty className="my-empty">Tom</PanelEmpty>)
    expect(container.firstChild).toHaveClass('my-empty')
  })
})
