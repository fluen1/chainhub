import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CasesSection, type CaseRow } from '@/components/company-detail/cases-section'

const rows: CaseRow[] = [
  { id: '1', iconLetter: 'C', iconTone: 'red', title: 'Compliance-sag', meta: 'Oprettet 12. feb · Eskaleret', badge: { label: 'Aktiv', tone: 'red' } },
  { id: '2', iconLetter: 'G', iconTone: 'amber', title: 'Governance', meta: 'Oprettet 1. mar', badge: { label: 'Afventer', tone: 'amber' } },
]

describe('CasesSection', () => {
  it('viser tom-state ved 0 sager', () => {
    render(<CasesSection cases={[]} totalCount={0} />)
    expect(screen.getByText('Ingen åbne sager')).toBeInTheDocument()
  })

  it('viser badge med antal aktive', () => {
    render(<CasesSection cases={rows} totalCount={2} />)
    expect(screen.getByText('2 aktive')).toBeInTheDocument()
  })

  it('viser alle givne rows', () => {
    render(<CasesSection cases={rows} totalCount={2} />)
    expect(screen.getByText('Compliance-sag')).toBeInTheDocument()
    expect(screen.getByText('Governance')).toBeInTheDocument()
  })

  it('linker til /cases/<id>', () => {
    render(<CasesSection cases={rows} totalCount={2} />)
    const link = screen.getByRole('link', { name: /Compliance-sag/ })
    expect(link).toHaveAttribute('href', '/cases/1')
  })
})
