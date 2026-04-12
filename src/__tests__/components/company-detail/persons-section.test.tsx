import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PersonsSection, type PersonRow } from '@/components/company-detail/persons-section'

const rows: PersonRow[] = [
  { id: '1', initials: 'AP', name: 'Dr. Anders Petersen', role: 'Partner · Klinisk leder' },
  { id: '2', initials: 'ML', name: 'Maria Larsen', role: 'Klinikchef' },
]

describe('PersonsSection', () => {
  it('viser tom-state ved 0 personer', () => {
    render(<PersonsSection persons={[]} totalCount={0} companyId="abc" />)
    expect(screen.getByText('Ingen noeglepersoner registreret')).toBeInTheDocument()
  })

  it('viser initialer og navne', () => {
    render(<PersonsSection persons={rows} totalCount={2} companyId="abc" />)
    expect(screen.getByText('AP')).toBeInTheDocument()
    expect(screen.getByText('Dr. Anders Petersen')).toBeInTheDocument()
    expect(screen.getByText('Partner · Klinisk leder')).toBeInTheDocument()
  })

  it('skjuler Vis alle-link naar total <= 3', () => {
    render(<PersonsSection persons={rows} totalCount={2} companyId="abc" />)
    expect(screen.queryByText(/Vis alle/)).toBeNull()
  })

  it('viser Vis alle-link naar total > 3', () => {
    render(<PersonsSection persons={rows} totalCount={12} companyId="abc" />)
    const link = screen.getByRole('link', { name: /Vis alle 12 medarbejdere/ })
    expect(link).toHaveAttribute('href', '/persons?company=abc')
  })
})
