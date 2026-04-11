import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHeader } from '@/components/layout/app-header'
import type { InlineKpi } from '@/types/ui'

const kpis: InlineKpi[] = [
  { label: 'Selskaber', value: '7' },
  { label: 'Udløbende', value: '3', color: 'amber' },
  { label: 'Forfaldne', value: '12', color: 'red' },
]

describe('AppHeader', () => {
  it('viser hilsen med fornavn', () => {
    render(<AppHeader userName="Philip Larsen" kpis={kpis} />)
    expect(screen.getByText(/Philip/)).toBeInTheDocument()
    // Greeting varierer efter tidspunkt — tjek at én af de tre muligheder er i DOM
    const greetings = ['Godmorgen', 'God eftermiddag', 'God aften']
    const found = greetings.some((g) => screen.queryByText(new RegExp(g)) !== null)
    expect(found).toBe(true)
  })

  it('viser alle KPIs', () => {
    render(<AppHeader userName="T" kpis={kpis} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Selskaber')).toBeInTheDocument()
  })

  it('farver amber-KPI korrekt', () => {
    render(<AppHeader userName="T" kpis={kpis} />)
    expect(screen.getByText('3')).toHaveClass('text-amber-600')
  })

  it('farver red-KPI korrekt', () => {
    render(<AppHeader userName="T" kpis={kpis} />)
    expect(screen.getByText('12')).toHaveClass('text-red-600')
  })

  it('viser initialer fra userName', () => {
    render(<AppHeader userName="Philip Larsen" kpis={[]} />)
    expect(screen.getByText('PL')).toBeInTheDocument()
  })

  it('viser notifikations-bell med aria-label', () => {
    render(<AppHeader userName="T" kpis={[]} />)
    expect(screen.getByLabelText('Notifikationer')).toBeInTheDocument()
  })

  it('viser readonly søge-input', () => {
    render(<AppHeader userName="T" kpis={[]} />)
    const input = screen.getByPlaceholderText(/Søg efter/)
    expect(input).toHaveAttribute('readOnly')
  })
})
