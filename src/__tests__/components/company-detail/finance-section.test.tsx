import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinanceSection, type FinanceData } from '@/components/company-detail/finance-section'

const healthy: FinanceData = {
  omsaetning: { value_mio: 4.2, yoy_pct: 8 },
  ebitda: { value_k: 490, yoy_pct: -12 },
  margin_pct: 11.7,
  resultat: { value_k: 320, positive: true },
  quarterly: [
    { label: 'Q1', fraction: 0.6 },
    { label: 'Q2', fraction: 0.72 },
    { label: 'Q3', fraction: 0.68 },
    { label: 'Q4', fraction: 1.0 },
  ],
  statusBadge: { label: 'Positiv', tone: 'green' },
}

describe('FinanceSection', () => {
  it('viser tom-state naar data er null', () => {
    render(<FinanceSection data={null} />)
    expect(screen.getByText('Ingen økonomi-data registreret for 2025')).toBeInTheDocument()
  })

  it('viser 4 data-rows med formatterede vaerdier', () => {
    render(<FinanceSection data={healthy} />)
    expect(screen.getByText('4.2M kr.')).toBeInTheDocument()
    expect(screen.getByText('490K kr.')).toBeInTheDocument()
    expect(screen.getByText('11.7%')).toBeInTheDocument()
    expect(screen.getByText('320K kr.')).toBeInTheDocument()
  })

  it('positive YoY vises i groen, negative i roed', () => {
    render(<FinanceSection data={healthy} />)
    const positive = screen.getByText('+8%')
    expect(positive).toHaveClass('text-green-600')
    const negative = screen.getByText('-12%')
    expect(negative).toHaveClass('text-red-600')
  })

  it('negativt resultat vises i roed', () => {
    render(
      <FinanceSection
        data={{ ...healthy, resultat: { value_k: -50, positive: false } }}
      />
    )
    const res = screen.getByText('-50K kr.')
    expect(res).toHaveClass('text-red-600')
  })

  it('viser Positiv badge ved healthy status', () => {
    render(<FinanceSection data={healthy} />)
    expect(screen.getByText('Positiv')).toBeInTheDocument()
  })

  it('renderer 4 quarterly bars', () => {
    const { container } = render(<FinanceSection data={healthy} />)
    const bars = container.querySelectorAll('.flex.h-12 > div')
    expect(bars).toHaveLength(4)
  })
})
