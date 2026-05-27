import { render, screen } from '@testing-library/react'
import { Building2, FileText } from 'lucide-react'
import { describe, it, expect } from 'vitest'
import { EmptyState } from '@/components/ui/empty-state'

describe('EmptyState', () => {
  it('renderer title', () => {
    render(<EmptyState icon={Building2} title="Ingen selskaber" />)
    expect(screen.getByText('Ingen selskaber')).toBeInTheDocument()
  })

  it('renderer description hvis angivet', () => {
    render(
      <EmptyState
        icon={Building2}
        title="Ingen selskaber"
        description="Opret dit første selskab for at komme i gang"
      />
    )
    expect(screen.getByText('Opret dit første selskab for at komme i gang')).toBeInTheDocument()
  })

  it('renderer ikke description hvis ikke angivet', () => {
    render(<EmptyState icon={Building2} title="Ingen selskaber" />)
    // Ingen p-element med gray-500 tekst
    expect(screen.queryByRole('paragraph')).toBeNull()
  })

  it('renderer CTA-link med korrekt href og label', () => {
    render(
      <EmptyState
        icon={Building2}
        title="Ingen selskaber"
        action={{ label: 'Opret selskab', href: '/companies/new' }}
      />
    )
    const link = screen.getByRole('link', { name: /opret selskab/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/companies/new')
  })

  it('renderer ikke CTA-link når action ikke er angivet', () => {
    render(<EmptyState icon={Building2} title="Ingen selskaber" />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renderer ikon (aria-hidden)', () => {
    const { container } = render(<EmptyState icon={FileText} title="Ingen filer" />)
    // Ikon er aria-hidden — ikke synlig for screenreaders
    const svgs = container.querySelectorAll('svg[aria-hidden]')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('anvender compact variant med korrekt padding', () => {
    const { container } = render(<EmptyState icon={Building2} title="Tom" variant="compact" />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('p-4')
  })

  it('anvender filtered variant med p-8', () => {
    const { container } = render(<EmptyState icon={Building2} title="Tom" variant="filtered" />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('p-8')
  })

  it('anvender slate theme', () => {
    const { container } = render(<EmptyState icon={Building2} title="Tom" theme="slate" />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('bg-slate-50/50')
  })

  it('accepterer custom className', () => {
    const { container } = render(
      <EmptyState icon={Building2} title="Tom" className="min-h-[200px]" />
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('min-h-[200px]')
  })
})
