import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BottomBar, SyncDot } from '@/components/ui/b/BottomBar'

describe('BottomBar', () => {
  it('renders left content', () => {
    render(<BottomBar left="Sidst synkroniseret 14:32" />)
    expect(screen.getByText('Sidst synkroniseret 14:32')).toBeInTheDocument()
  })

  it('renders right content', () => {
    render(<BottomBar right={<button>⌘K</button>} />)
    expect(screen.getByRole('button', { name: '⌘K' })).toBeInTheDocument()
  })

  it('renders both left and right content', () => {
    render(<BottomBar left="Venstre" right="Højre" />)
    expect(screen.getByText('Venstre')).toBeInTheDocument()
    expect(screen.getByText('Højre')).toBeInTheDocument()
  })

  it('renders with no content (empty)', () => {
    const { container } = render(<BottomBar />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<BottomBar className="pb-4" />)
    expect(container.firstChild).toHaveClass('pb-4')
  })

  it('has mt-auto for positioning at page bottom', () => {
    const { container } = render(<BottomBar />)
    expect(container.firstChild).toHaveClass('mt-auto')
  })
})

describe('SyncDot', () => {
  it('renders a dot element', () => {
    const { container } = render(<SyncDot />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('has green color class', () => {
    const { container } = render(<SyncDot />)
    expect(container.firstChild).toHaveClass('bg-b-green-fg')
  })

  it('is rounded (circular)', () => {
    const { container } = render(<SyncDot />)
    expect(container.firstChild).toHaveClass('rounded-full')
  })
})
