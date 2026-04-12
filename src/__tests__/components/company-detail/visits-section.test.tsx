import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VisitsSection, type VisitRow } from '@/components/company-detail/visits-section'

const rows: VisitRow[] = [
  { id: '1', typeLabel: 'Driftsbesoeg', meta: 'Planlagt 1. apr 2026', badge: { label: 'Planlagt', tone: 'blue' } },
  { id: '2', typeLabel: 'Kvartalsgennemgang Q4', meta: 'Gennemfoert 15. jan 2026', badge: { label: 'Gennemfoert', tone: 'green' } },
]

describe('VisitsSection', () => {
  it('viser tom-state ved 0 besoeg', () => {
    render(<VisitsSection visits={[]} />)
    expect(screen.getByText('Ingen besoeg registreret')).toBeInTheDocument()
  })

  it('viser alle givne rows', () => {
    render(<VisitsSection visits={rows} />)
    expect(screen.getByText('Driftsbesoeg')).toBeInTheDocument()
    expect(screen.getByText('Kvartalsgennemgang Q4')).toBeInTheDocument()
  })

  it('bruger rigtige badge-farver', () => {
    render(<VisitsSection visits={rows} />)
    expect(screen.getByText('Planlagt')).toHaveClass('bg-blue-50')
    expect(screen.getByText('Gennemfoert')).toHaveClass('bg-green-50')
  })

  it('linker til /visits/<id>', () => {
    render(<VisitsSection visits={rows} />)
    const link = screen.getByRole('link', { name: /Driftsbesoeg/ })
    expect(link).toHaveAttribute('href', '/visits/1')
  })
})
