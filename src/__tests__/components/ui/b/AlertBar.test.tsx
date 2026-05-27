import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AlertBar } from '@/components/ui/b/AlertBar'

describe('AlertBar', () => {
  it('renders children content', () => {
    render(<AlertBar>Kontrakten udløber om 14 dage</AlertBar>)
    expect(screen.getByText('Kontrakten udløber om 14 dage')).toBeInTheDocument()
  })

  it('renders with role="alert" for screen readers', () => {
    render(<AlertBar>Vigtig besked</AlertBar>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    render(<AlertBar actions={<button>Start forny-flow</button>}>Kritisk kontrakt</AlertBar>)
    expect(screen.getByRole('button', { name: 'Start forny-flow' })).toBeInTheDocument()
  })

  it('does not render action area when no actions are provided', () => {
    render(<AlertBar>Besked uden actions</AlertBar>)
    // Only one child div (the content), no shrink-0 actions container
    const alert = screen.getByRole('alert')
    expect(alert.children).toHaveLength(1)
  })

  it('uses red tone by default', () => {
    render(<AlertBar>Fejl</AlertBar>)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('bg-b-red-bg')
  })

  it('applies amber tone styles', () => {
    render(<AlertBar tone="amber">Advarsel</AlertBar>)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('bg-b-amber-bg')
  })

  it('applies blue tone styles', () => {
    render(<AlertBar tone="blue">Info</AlertBar>)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('bg-b-blue-bg')
  })

  it('accepts custom className', () => {
    render(<AlertBar className="my-bar">Tekst</AlertBar>)
    expect(screen.getByRole('alert').className).toContain('my-bar')
  })
})
