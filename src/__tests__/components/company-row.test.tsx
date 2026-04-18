import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompanyRow } from '@/components/ui/company-row'

describe('CompanyRow', () => {
  it('renderer initials, navn og meta', () => {
    render(
      <CompanyRow
        initials="TØ"
        name="Tandlæge Østerbro ApS"
        meta="CVR 87654321"
        status={{ label: 'Aktiv', type: 'ok' }}
        avatarColor="#3b82f6"
      />
    )
    expect(screen.getByText('TØ')).toBeInTheDocument()
    expect(screen.getByText('Tandlæge Østerbro ApS')).toBeInTheDocument()
    expect(screen.getByText('CVR 87654321')).toBeInTheDocument()
  })

  it('viser status badge med grøn farve for ok', () => {
    render(
      <CompanyRow
        initials="X"
        name="Test"
        meta="t"
        avatarColor="#000"
        status={{ label: 'Aktiv', type: 'ok' }}
      />
    )
    expect(screen.getByText('Aktiv')).toHaveClass('bg-green-50', 'text-green-600')
  })

  it('wrapper i <a> når href er angivet', () => {
    render(
      <CompanyRow
        initials="X"
        name="Klikbar"
        meta="t"
        avatarColor="#000"
        status={{ label: 'Aktiv', type: 'ok' }}
        href="/companies/123"
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/companies/123')
  })

  it('anvender avatarColor som inline backgroundColor', () => {
    render(
      <CompanyRow
        initials="AB"
        name="T"
        meta="t"
        avatarColor="#ef4444"
        status={{ label: 'Kritisk', type: 'critical' }}
      />
    )
    const avatar = screen.getByText('AB')
    expect(avatar).toHaveStyle({ backgroundColor: 'rgb(239, 68, 68)' })
  })
})
