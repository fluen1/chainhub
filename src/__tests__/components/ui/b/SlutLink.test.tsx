import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SlutLink } from '@/components/ui/b/SlutLink'

describe('SlutLink', () => {
  it('renders default label "Slut"', () => {
    render(<SlutLink onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Slut' })).toBeInTheDocument()
  })

  it('renders custom label', () => {
    render(<SlutLink onClick={vi.fn()} label="Afslut ejerskab" />)
    expect(screen.getByText('Afslut ejerskab')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<SlutLink onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })

  it('has default title "Slut"', () => {
    render(<SlutLink onClick={vi.fn()} />)
    expect(screen.getByTitle('Slut')).toBeInTheDocument()
  })

  it('renders custom title', () => {
    render(<SlutLink onClick={vi.fn()} title="Afslut rolle" />)
    expect(screen.getByTitle('Afslut rolle')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    const { container } = render(<SlutLink onClick={vi.fn()} className="ml-2" />)
    expect(container.firstChild).toHaveClass('ml-2')
  })

  it('stops event propagation on click', () => {
    const parentClick = vi.fn()
    const childClick = vi.fn()
    render(
      <div onClick={parentClick}>
        <SlutLink onClick={childClick} />
      </div>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(childClick).toHaveBeenCalled()
    expect(parentClick).not.toHaveBeenCalled()
  })
})
