import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionCard } from '@/components/company-detail/section-card'

describe('SectionCard', () => {
  it('viser title og children', () => {
    render(
      <SectionCard title="Kontrakter">
        <div>indhold</div>
      </SectionCard>
    )
    expect(screen.getByText('Kontrakter')).toBeInTheDocument()
    expect(screen.getByText('indhold')).toBeInTheDocument()
  })

  it('viser badge med rigtig tone-farve', () => {
    render(
      <SectionCard title="Sager" badge={{ label: '2 aktive', tone: 'red' }}>
        -
      </SectionCard>
    )
    const badge = screen.getByText('2 aktive')
    expect(badge).toHaveClass('bg-red-50', 'text-red-600')
  })

  it('viser footer-link naar href + label givet', () => {
    render(
      <SectionCard title="T" footerLinkHref="/contracts?company=abc" footerLinkLabel="Vis alle 8 →">
        -
      </SectionCard>
    )
    const link = screen.getByRole('link', { name: 'Vis alle 8 →' })
    expect(link).toHaveAttribute('href', '/contracts?company=abc')
  })

  it('viser ikke footer-link uden href', () => {
    render(<SectionCard title="T">-</SectionCard>)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
