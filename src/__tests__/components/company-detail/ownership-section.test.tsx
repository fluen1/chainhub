import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OwnershipSection } from '@/components/company-detail/ownership-section'

describe('OwnershipSection', () => {
  it('viser tom-state naar data er null', () => {
    render(<OwnershipSection data={null} />)
    expect(screen.getByText('Ingen ejerskabsdata registreret')).toBeInTheDocument()
  })

  it('viser alle 4 data-rows', () => {
    render(
      <OwnershipSection
        data={{
          kaedegruppePct: 51,
          localPartner: { name: 'Dr. Petersen', pct: 49 },
          ejeraftaleStatus: { label: 'Aktiv', danger: false },
          holdingCompanyName: 'DentalGroup Holding ApS',
        }}
      />
    )
    expect(screen.getByText('Kaedegruppe-andel')).toBeInTheDocument()
    expect(screen.getByText('51%')).toBeInTheDocument()
    expect(screen.getByText('Dr. Petersen (49%)')).toBeInTheDocument()
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText('DentalGroup Holding ApS')).toBeInTheDocument()
  })

  it('markerer udloebet ejeraftale som danger', () => {
    render(
      <OwnershipSection
        data={{
          kaedegruppePct: 51,
          localPartner: null,
          ejeraftaleStatus: { label: 'Udloebet 28. mar 2026', danger: true },
          holdingCompanyName: null,
        }}
      />
    )
    const status = screen.getByText('Udloebet 28. mar 2026')
    expect(status).toHaveClass('text-red-600')
  })

  it('renderer ownership-bar split korrekt', () => {
    render(
      <OwnershipSection
        data={{
          kaedegruppePct: 60,
          localPartner: null,
          ejeraftaleStatus: null,
          holdingCompanyName: null,
        }}
      />
    )
    expect(screen.getByText('Kaedegruppe 60%')).toBeInTheDocument()
    expect(screen.getByText('Partnere 40%')).toBeInTheDocument()
  })
})
