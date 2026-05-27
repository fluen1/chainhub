import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SkipToMain } from '@/components/layout/SkipToMain'

describe('SkipToMain', () => {
  it('renderer "Spring til indhold"-link', () => {
    render(<SkipToMain />)
    expect(screen.getByText('Spring til indhold')).toBeInTheDocument()
  })

  it('linker til #main-content', () => {
    render(<SkipToMain />)
    const link = screen.getByRole('link', { name: 'Spring til indhold' })
    expect(link).toHaveAttribute('href', '#main-content')
  })

  it('er visuelt skjult via sr-only klasse', () => {
    render(<SkipToMain />)
    const link = screen.getByRole('link', { name: 'Spring til indhold' })
    expect(link.className).toContain('sr-only')
  })

  it('er et anchor-element', () => {
    render(<SkipToMain />)
    expect(screen.getByRole('link').tagName).toBe('A')
  })
})
