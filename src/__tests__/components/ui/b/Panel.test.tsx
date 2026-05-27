import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  Panel,
  PanelHeader,
  PanelBody,
  PanelFooter,
  PanelGroupLabel,
} from '@/components/ui/b/Panel'

// ── Panel ─────────────────────────────────────────────────────────────────────

describe('Panel', () => {
  it('renders children', () => {
    render(<Panel>Indhold</Panel>)
    expect(screen.getByText('Indhold')).toBeInTheDocument()
  })

  it('applies id when provided', () => {
    const { container } = render(<Panel id="my-panel">Content</Panel>)
    expect(container.querySelector('#my-panel')).toBeInTheDocument()
  })

  it('accepts extra className', () => {
    const { container } = render(<Panel className="extra-class">Content</Panel>)
    expect(container.firstChild).toHaveClass('extra-class')
  })
})

// ── PanelHeader ───────────────────────────────────────────────────────────────

describe('PanelHeader', () => {
  it('renders title', () => {
    render(<PanelHeader title="Ejere" />)
    expect(screen.getByText('Ejere')).toBeInTheDocument()
  })

  it('renders meta when provided', () => {
    render(<PanelHeader title="Ejere" meta="3 i alt" />)
    expect(screen.getByText('3 i alt')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    render(<PanelHeader title="Ejere" actions={<button>Tilføj</button>} />)
    expect(screen.getByRole('button', { name: 'Tilføj' })).toBeInTheDocument()
  })

  it('does not render meta area when meta is absent', () => {
    render(<PanelHeader title="Ejere" />)
    // Only the title should be present
    expect(screen.queryByText('3 i alt')).not.toBeInTheDocument()
  })
})

// ── PanelBody ─────────────────────────────────────────────────────────────────

describe('PanelBody', () => {
  it('renders children', () => {
    render(<PanelBody>Body content</PanelBody>)
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('has padding classes by default', () => {
    const { container } = render(<PanelBody>Body</PanelBody>)
    expect(container.firstChild).toHaveClass('px-3')
  })

  it('removes padding when noPadding=true', () => {
    const { container } = render(<PanelBody noPadding>Body</PanelBody>)
    expect(container.firstChild).not.toHaveClass('px-3')
  })
})

// ── PanelFooter ───────────────────────────────────────────────────────────────

describe('PanelFooter', () => {
  it('renders children', () => {
    render(<PanelFooter>Total: 5</PanelFooter>)
    expect(screen.getByText('Total: 5')).toBeInTheDocument()
  })
})

// ── PanelGroupLabel ───────────────────────────────────────────────────────────

describe('PanelGroupLabel', () => {
  it('renders the group label text', () => {
    render(<PanelGroupLabel>Forfaldent</PanelGroupLabel>)
    expect(screen.getByText('Forfaldent')).toBeInTheDocument()
  })
})
