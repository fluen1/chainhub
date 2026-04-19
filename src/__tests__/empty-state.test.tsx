// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '@/components/ui/empty-state'
import { Briefcase } from 'lucide-react'

describe('EmptyState', () => {
  it('renderer titel + beskrivelse', () => {
    render(<EmptyState icon={Briefcase} title="Ingen sager" description="Opret din første." />)
    expect(screen.getByText('Ingen sager')).toBeDefined()
    expect(screen.getByText('Opret din første.')).toBeDefined()
  })

  it('renderer action-knap når action leveret', () => {
    render(
      <EmptyState
        icon={Briefcase}
        title="Ingen sager"
        action={{ label: 'Opret sag', href: '/cases/new' }}
      />
    )
    const link = screen.getByRole('link', { name: /Opret sag/ })
    expect(link.getAttribute('href')).toBe('/cases/new')
  })

  it('renderer ingen action-knap når action mangler', () => {
    render(<EmptyState icon={Briefcase} title="Ingen match" description="Prøv andre filtre." />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('understøtter variant: filtered (mindre padding, ingen CTA-default)', () => {
    const { container } = render(
      <EmptyState icon={Briefcase} title="Ingen match" variant="filtered" />
    )
    const box = container.firstChild as HTMLElement
    expect(box.className).toContain('p-8')
  })

  it('understøtter variant: compact (p-4 padding + h-8 ikon)', () => {
    const { container } = render(
      <EmptyState icon={Briefcase} title="Ingen tilknytninger" variant="compact" />
    )
    const box = container.firstChild as HTMLElement
    expect(box.className).toContain('p-4')
    const svg = box.querySelector('svg') as SVGElement
    expect(svg.getAttribute('class') ?? '').toContain('h-8')
  })

  it('understøtter theme: slate (slate-border, ikke dashed)', () => {
    const { container } = render(
      <EmptyState icon={Briefcase} title="Ingen dokumenter" theme="slate" />
    )
    const box = container.firstChild as HTMLElement
    expect(box.className).toContain('border-slate-200')
    expect(box.className).not.toContain('border-dashed')
  })

  it('kombinerer variant: compact + theme: slate', () => {
    const { container } = render(
      <EmptyState icon={Briefcase} title="Ingen events" variant="compact" theme="slate" />
    )
    const box = container.firstChild as HTMLElement
    expect(box.className).toContain('p-4')
    expect(box.className).toContain('border-slate-200')
  })
})
