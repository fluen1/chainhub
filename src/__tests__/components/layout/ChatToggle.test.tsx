import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ChatToggle } from '@/components/layout/ChatToggle'

describe('ChatToggle', () => {
  it('renders a button', () => {
    render(<ChatToggle onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has accessible label', () => {
    render(<ChatToggle onClick={vi.fn()} />)
    expect(screen.getByLabelText('Åbn AI-assistent')).toBeInTheDocument()
  })

  it('has tooltip title', () => {
    render(<ChatToggle onClick={vi.fn()} />)
    expect(screen.getByTitle('Åbn AI-assistent')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<ChatToggle onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })

  it('is of type button (not submit)', () => {
    render(<ChatToggle onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('skjules når hidden=true', () => {
    render(<ChatToggle onClick={vi.fn()} hidden />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('vises når hidden=false', () => {
    render(<ChatToggle onClick={vi.fn()} hidden={false} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
