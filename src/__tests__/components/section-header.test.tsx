import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionHeader } from '@/components/ui/section-header'

describe('SectionHeader', () => {
  it('renderer title i uppercase-tracking', () => {
    render(<SectionHeader title="Porteføljeoverblik" />)
    const el = screen.getByText('Porteføljeoverblik')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('uppercase', 'tracking-[0.08em]')
  })

  it('renderer divider-linjen', () => {
    const { container } = render(<SectionHeader title="Test" />)
    expect(container.querySelector('.h-px.bg-gray-200')).not.toBeNull()
  })
})
