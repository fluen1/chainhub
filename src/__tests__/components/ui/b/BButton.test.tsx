import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BButton, BAddButton } from '@/components/ui/b/BButton'

// ── BButton ───────────────────────────────────────────────────────────────────

describe('BButton — as button', () => {
  it('renders children as button text', () => {
    render(<BButton>Gem</BButton>)
    expect(screen.getByRole('button', { name: 'Gem' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<BButton onClick={onClick}>Klik</BButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders as submit button when type="submit"', () => {
    render(<BButton type="submit">Send</BButton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('is disabled when disabled prop is true', () => {
    render(<BButton disabled>Deaktiveret</BButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <BButton disabled onClick={onClick}>
        Deaktiveret
      </BButton>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('BButton — as link', () => {
  it('renders an anchor element when href is provided', () => {
    render(<BButton href="/contracts">Kontrakter</BButton>)
    expect(screen.getByRole('link', { name: 'Kontrakter' })).toBeInTheDocument()
  })

  it('link points to the correct href', () => {
    render(<BButton href="/contracts/new">Ny kontrakt</BButton>)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/contracts/new')
  })
})

describe('BButton — primary variant', () => {
  it('renders button with primary class when primary prop is set', () => {
    render(<BButton primary>Primær</BButton>)
    const btn = screen.getByRole('button')
    // The primary variant has bg-b-blue-fg class
    expect(btn.className).toContain('bg-b-blue-fg')
  })

  it('renders default (non-primary) button without primary class', () => {
    render(<BButton>Standard</BButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).not.toContain('bg-b-blue-fg')
  })
})

// ── BAddButton ────────────────────────────────────────────────────────────────

describe('BAddButton', () => {
  it('renders as button with children', () => {
    render(<BAddButton onClick={vi.fn()}>+ Tilføj ejer</BAddButton>)
    expect(screen.getByRole('button', { name: '+ Tilføj ejer' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<BAddButton onClick={onClick}>+ Tilføj</BAddButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders as link when href is provided', () => {
    render(<BAddButton href="/companies/new">+ Nyt selskab</BAddButton>)
    expect(screen.getByRole('link', { name: '+ Nyt selskab' })).toHaveAttribute(
      'href',
      '/companies/new'
    )
  })
})
