import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NotificationBell } from '@/components/layout/NotificationBell'

describe('NotificationBell', () => {
  it('viser klokke-link', () => {
    render(<NotificationBell count={0} />)
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('linker til /dashboard', () => {
    render(<NotificationBell count={0} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard')
  })

  it('viser ingen badge ved count=0', () => {
    render(<NotificationBell count={0} />)
    // Badge indeholder det numeriske antal — ikke synligt ved 0
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('viser badge med antal ved count > 0', () => {
    render(<NotificationBell count={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('begrænser badge til "99+" ved count > 99', () => {
    render(<NotificationBell count={150} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
    expect(screen.queryByText('150')).not.toBeInTheDocument()
  })

  it('viser præcist 99 uden at begrænse til 99+', () => {
    render(<NotificationBell count={99} />)
    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('inkluderer aria-label med antal advarsler', () => {
    render(<NotificationBell count={3} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('aria-label', expect.stringContaining('3'))
  })

  it('inkluderer aria-label "Ingen advarsler" ved count=0', () => {
    render(<NotificationBell count={0} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('aria-label', 'Ingen advarsler')
  })
})
