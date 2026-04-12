import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractsSection, type ContractRow } from '@/components/company-detail/contracts-section'

const baseRows: ContractRow[] = [
  { id: 'c1', iconLetters: 'EA', iconTone: 'red', name: 'Ejeraftale', meta: 'Udloebet 28. mar', badge: { label: 'Udloebet', tone: 'red' } },
  { id: 'c2', iconLetters: 'LK', iconTone: 'green', name: 'Lejekontrakt', meta: 'Udloeber 15. sep 2027', badge: { label: 'Aktiv', tone: 'green' } },
]

describe('ContractsSection', () => {
  it('viser tom state ved 0 kontrakter', () => {
    render(<ContractsSection contracts={[]} totalCount={0} companyId="abc" />)
    expect(screen.getByText('Ingen aktive kontrakter')).toBeInTheDocument()
  })

  it('viser kontrakt-rows', () => {
    render(<ContractsSection contracts={baseRows} totalCount={2} companyId="abc" />)
    expect(screen.getByText('Ejeraftale')).toBeInTheDocument()
    expect(screen.getByText('Lejekontrakt')).toBeInTheDocument()
  })

  it('badge viser antal udloebne i roed tone', () => {
    render(<ContractsSection contracts={baseRows} totalCount={2} companyId="abc" />)
    const badge = screen.getByText('1 udloebet')
    expect(badge).toHaveClass('bg-red-50')
  })

  it('viser Vis alle-link kun naar total > 3', () => {
    const { rerender } = render(<ContractsSection contracts={baseRows} totalCount={2} companyId="abc" />)
    expect(screen.queryByText(/Vis alle/)).toBeNull()

    rerender(<ContractsSection contracts={baseRows} totalCount={8} companyId="abc" />)
    const link = screen.getByRole('link', { name: /Vis alle 8 kontrakter/ })
    expect(link).toHaveAttribute('href', '/contracts?company=abc')
  })

  it('capper ved 3 rows selv hvis flere givet', () => {
    const many: ContractRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      iconLetters: 'KK',
      iconTone: 'green',
      name: `Kontrakt ${i}`,
      meta: 'Aktiv',
      badge: { label: 'Aktiv', tone: 'green' },
    }))
    render(<ContractsSection contracts={many} totalCount={5} companyId="abc" />)
    // 3 row-links + 1 footer-link = 4
    expect(screen.getAllByRole('link')).toHaveLength(4)
  })
})
