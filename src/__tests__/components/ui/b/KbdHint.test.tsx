import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { KbdHint } from '@/components/ui/b/KbdHint'

describe('KbdHint', () => {
  it('renders the keyboard shortcut key', () => {
    render(<KbdHint k="⌘K" />)
    expect(screen.getByText('⌘K')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<KbdHint k="⌘K" label="global søgning" />)
    expect(screen.getByText('global søgning')).toBeInTheDocument()
  })

  it('does not render label when omitted', () => {
    const { container } = render(<KbdHint k="Esc" />)
    // Kun ét tekstnode: selve shortcut
    expect(container.querySelectorAll('span').length).toBe(2) // outer + .b-kbd
  })

  it('renders multi-key hints', () => {
    render(<KbdHint k="⌘" label="gem" />)
    expect(screen.getByText('⌘')).toBeInTheDocument()
    expect(screen.getByText('gem')).toBeInTheDocument()
  })

  it('renders as inline element', () => {
    const { container } = render(<KbdHint k="G" label="gå til" />)
    expect(container.firstChild).toHaveClass('inline-flex')
  })
})
