import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SkipToMain } from '@/components/layout/SkipToMain'

describe('SkipToMain', () => {
  it('renders an anchor element', () => {
    render(<SkipToMain />)
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('links to #main-content', () => {
    render(<SkipToMain />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '#main-content')
  })

  it('contains the expected Danish label text', () => {
    render(<SkipToMain />)
    expect(screen.getByText('Spring til indhold')).toBeInTheDocument()
  })

  it('is visually hidden by default (sr-only class)', () => {
    render(<SkipToMain />)
    const link = screen.getByRole('link')
    expect(link.className).toContain('sr-only')
  })
})
