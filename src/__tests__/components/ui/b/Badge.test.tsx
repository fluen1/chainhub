import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge, type BadgeTone } from '@/components/ui/b/Badge'

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Aktiv</Badge>)
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
  })

  it('uses gray tone by default', () => {
    render(<Badge>Neutral</Badge>)
    const badge = screen.getByText('Neutral')
    expect(badge.className).toContain('bg-b-gray-bg')
    expect(badge.className).toContain('text-b-gray-fg')
  })

  const tones: Array<{ tone: BadgeTone; bgClass: string; fgClass: string }> = [
    { tone: 'red', bgClass: 'bg-b-red-bg', fgClass: 'text-b-red-fg' },
    { tone: 'amber', bgClass: 'bg-b-amber-bg', fgClass: 'text-b-amber-fg' },
    { tone: 'green', bgClass: 'bg-b-green-bg', fgClass: 'text-b-green-fg' },
    { tone: 'blue', bgClass: 'bg-b-blue-bg', fgClass: 'text-b-blue-fg' },
    { tone: 'gray', bgClass: 'bg-b-gray-bg', fgClass: 'text-b-gray-fg' },
  ]

  tones.forEach(({ tone, bgClass, fgClass }) => {
    it(`applies correct classes for tone="${tone}"`, () => {
      render(<Badge tone={tone}>{tone}</Badge>)
      const badge = screen.getByText(tone)
      expect(badge.className).toContain(bgClass)
      expect(badge.className).toContain(fgClass)
    })
  })

  it('renders as a span element', () => {
    render(<Badge>Label</Badge>)
    expect(screen.getByText('Label').tagName).toBe('SPAN')
  })

  it('accepts and applies custom className', () => {
    render(<Badge className="custom-cls">Test</Badge>)
    expect(screen.getByText('Test').className).toContain('custom-cls')
  })
})
