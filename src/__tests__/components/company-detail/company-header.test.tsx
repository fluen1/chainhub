import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompanyHeader } from '@/components/company-detail/company-header'

const baseProps = {
  name: 'Nordklinik ApS',
  cvr: '12345678',
  city: 'Odense',
  status: 'Aktiv',
  foundedYear: 2019,
  statusBadge: { label: 'Kritisk' as const, severity: 'critical' as const },
  healthDimensions: {
    kontrakter: 'red' as const,
    sager: 'red' as const,
    oekonomi: 'green' as const,
    governance: 'green' as const,
  },
  showHealthDims: true,
  editStamdataButton: <button>Rediger stamdata</button>,
  createTaskHref: '/tasks/new?company=abc',
  readOnly: false,
}

describe('CompanyHeader', () => {
  it('viser navn og status-badge', () => {
    render(<CompanyHeader {...baseProps} />)
    expect(screen.getByText('Nordklinik ApS')).toBeInTheDocument()
    expect(screen.getByText('Kritisk')).toBeInTheDocument()
  })

  it('viser meta-row med CVR, by, status, stiftet', () => {
    render(<CompanyHeader {...baseProps} />)
    expect(screen.getByText('CVR 12345678')).toBeInTheDocument()
    expect(screen.getByText('Odense')).toBeInTheDocument()
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText('Stiftet 2019')).toBeInTheDocument()
  })

  it('viser 4 health-dimensions naar showHealthDims er true', () => {
    render(<CompanyHeader {...baseProps} />)
    expect(screen.getByText('Kontrakter')).toBeInTheDocument()
    expect(screen.getByText('Sager')).toBeInTheDocument()
    expect(screen.getByText('Økonomi')).toBeInTheDocument()
    expect(screen.getByText('Governance')).toBeInTheDocument()
  })

  it('skjuler health-dimensions naar showHealthDims er false', () => {
    render(<CompanyHeader {...baseProps} showHealthDims={false} />)
    expect(screen.queryByText('Kontrakter')).toBeNull()
  })

  it('Opret opgave-link peger paa createTaskHref', () => {
    render(<CompanyHeader {...baseProps} />)
    const link = screen.getByText('Opret opgave')
    expect(link).toHaveAttribute('href', '/tasks/new?company=abc')
  })

  it('Opret opgave er disabled visuelt ved readOnly', () => {
    render(<CompanyHeader {...baseProps} readOnly={true} />)
    const link = screen.getByText('Opret opgave')
    expect(link).toHaveClass('cursor-not-allowed')
    expect(link).toHaveAttribute('aria-disabled', 'true')
  })

  it('viser editStamdataButton slot', () => {
    render(<CompanyHeader {...baseProps} />)
    expect(screen.getByText('Rediger stamdata')).toBeInTheDocument()
  })

  it('status-badge farve matcher severity', () => {
    render(<CompanyHeader {...baseProps} statusBadge={{ label: 'Sund', severity: 'healthy' }} />)
    const badge = screen.getByText('Sund')
    expect(badge).toHaveClass('bg-green-50')
  })
})
