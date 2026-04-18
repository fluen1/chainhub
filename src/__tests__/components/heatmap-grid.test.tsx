import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeatmapGrid } from '@/components/dashboard/heatmap-grid'
import type { HeatmapCompany } from '@/actions/dashboard'

const companies: HeatmapCompany[] = [
  { id: 'c1', name: 'Tandlæge Aalborg ApS', healthStatus: 'critical', openCaseCount: 2 },
  { id: 'c2', name: 'Tandlæge Aarhus ApS', healthStatus: 'warning', openCaseCount: 1 },
  { id: 'c3', name: 'Tandlæge Odense ApS', healthStatus: 'healthy', openCaseCount: 0 },
]

describe('HeatmapGrid', () => {
  it('renderer forkortede navne', () => {
    render(<HeatmapGrid companies={companies} />)
    expect(screen.getByText('Aalborg')).toBeInTheDocument()
    expect(screen.getByText('Aarhus')).toBeInTheDocument()
    expect(screen.getByText('Odense')).toBeInTheDocument()
  })

  it('sorterer critical først', () => {
    render(<HeatmapGrid companies={companies} />)
    const cellLinks = screen
      .getAllByRole('link')
      .filter(
        (l) =>
          l.getAttribute('href')?.startsWith('/companies/') &&
          l.getAttribute('href') !== '/companies'
      )
    expect(cellLinks[0]).toHaveAttribute('href', '/companies/c1')
    expect(cellLinks[1]).toHaveAttribute('href', '/companies/c2')
    expect(cellLinks[2]).toHaveAttribute('href', '/companies/c3')
  })

  it('viser openCaseCount når > 0, ellers dot', () => {
    render(<HeatmapGrid companies={companies} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('·')).toBeInTheDocument()
  })

  it('viser tom-state ved ingen selskaber', () => {
    render(<HeatmapGrid companies={[]} />)
    expect(screen.getByText('Ingen selskaber')).toBeInTheDocument()
  })

  it('capper ved 15 selskaber', () => {
    const many: HeatmapCompany[] = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      name: `Company ${i}`,
      healthStatus: 'healthy' as const,
      openCaseCount: 0,
    }))
    render(<HeatmapGrid companies={many} />)
    const cellLinks = screen
      .getAllByRole('link')
      .filter(
        (l) =>
          l.getAttribute('href')?.startsWith('/companies/') &&
          l.getAttribute('href') !== '/companies'
      )
    expect(cellLinks).toHaveLength(15)
  })
})
