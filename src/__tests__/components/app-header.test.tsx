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
  it('viser Godmorgen før kl 12', () => {
    const date = new Date('2026-04-11T08:30:00')
    render(<AppHeader userName="Philip Larsen" kpis={kpis} currentDate={date} />)
    expect(screen.getByText(/Godmorgen, Philip/)).toBeInTheDocument()
  })

  it('viser God eftermiddag mellem 12-18', () => {
    const date = new Date('2026-04-11T14:00:00')
    render(<AppHeader userName="Philip" kpis={[]} currentDate={date} />)
    expect(screen.getByText(/God eftermiddag/)).toBeInTheDocument()
  })

  it('viser God aften fra kl 18', () => {
    const date = new Date('2026-04-11T20:00:00')
    render(<AppHeader userName="Philip" kpis={[]} currentDate={date} />)
    expect(screen.getByText(/God aften/)).toBeInTheDocument()
  })

  it('formaterer dansk dato korrekt', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="T" kpis={[]} currentDate={date} />)
    expect(screen.getByText(/Lørdag 11\. april 2026/)).toBeInTheDocument()
  })

  it('viser alle KPIs med korrekte farver', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="T" kpis={kpis} currentDate={date} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toHaveClass('text-amber-600')
    expect(screen.getByText('12')).toHaveClass('text-red-600')
    expect(screen.getByText('Selskaber')).toBeInTheDocument()
  })

  it('viser initialer fra userName', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="Philip Larsen" kpis={[]} currentDate={date} />)
    expect(screen.getByText('PL')).toBeInTheDocument()
  })

  it('viser notifikations-bell med aria-label', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="T" kpis={[]} currentDate={date} />)
    expect(screen.getByLabelText('Notifikationer')).toBeInTheDocument()
  })

  it('viser readonly søge-input', () => {
    const date = new Date('2026-04-11T10:00:00')
    render(<AppHeader userName="T" kpis={[]} currentDate={date} />)
    const input = screen.getByPlaceholderText(/Søg efter/)
    expect(input).toHaveAttribute('readOnly')
  })
})
