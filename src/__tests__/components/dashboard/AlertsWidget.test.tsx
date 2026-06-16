import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { AlertItem } from '@/actions/alerts'
import { AlertsWidget } from '@/components/dashboard/AlertsWidget'

const makeAlert = (overrides: Partial<AlertItem> = {}): AlertItem => ({
  id: 'alert-1',
  severity: 'CRITICAL',
  category: 'DEADLINE',
  entityType: 'contract',
  entityId: 'c1',
  entityName: 'Ejeraftale Test ApS',
  message: 'Kontrakten udløber om 3 dage',
  details: null,
  createdAt: new Date('2026-05-26'),
  ...overrides,
})

describe('AlertsWidget', () => {
  it('viser "Ingen aktive advarsler" ved tom liste', () => {
    render(<AlertsWidget alerts={[]} />)
    expect(screen.getByText('Ingen aktive advarsler')).toBeInTheDocument()
  })

  it('viser alert-besked', () => {
    render(<AlertsWidget alerts={[makeAlert()]} />)
    expect(screen.getByText('Kontrakten udløber om 3 dage')).toBeInTheDocument()
  })

  it('viser "Kritisk" badge for CRITICAL severity', () => {
    render(<AlertsWidget alerts={[makeAlert({ severity: 'CRITICAL' })]} />)
    expect(screen.getByText('Kritisk')).toBeInTheDocument()
  })

  it('viser "Advarsel" badge for WARNING severity', () => {
    render(<AlertsWidget alerts={[makeAlert({ severity: 'WARNING' })]} />)
    expect(screen.getByText('Advarsel')).toBeInTheDocument()
  })

  it('viser "Info" badge for INFO severity', () => {
    render(<AlertsWidget alerts={[makeAlert({ severity: 'INFO' })]} />)
    expect(screen.getByText('Info')).toBeInTheDocument()
  })

  it('linker kontrakt-alert til /contracts/[id]', () => {
    render(<AlertsWidget alerts={[makeAlert({ entityType: 'contract', entityId: 'c123' })]} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/contracts/c123')
  })

  it('linker task-alert til /tasks/[id]', () => {
    render(
      <AlertsWidget
        alerts={[
          makeAlert({
            entityType: 'task',
            entityId: 'task-42',
            category: 'COMPLIANCE',
            severity: 'WARNING',
          }),
        ]}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/tasks/task-42')
  })

  it('linker company-alert til /companies/[id]', () => {
    render(
      <AlertsWidget
        alerts={[
          makeAlert({
            entityType: 'company',
            entityId: 'comp-7',
            category: 'MISSING',
            severity: 'INFO',
          }),
        ]}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/companies/comp-7')
  })

  it('viser antal aktive i header', () => {
    const alerts = [makeAlert(), makeAlert({ id: 'alert-2' })]
    render(<AlertsWidget alerts={alerts} />)
    expect(screen.getByText('2 aktive')).toBeInTheDocument()
  })

  it('viser ikke meta-tekst (N aktive) ved tom liste', () => {
    render(<AlertsWidget alerts={[]} />)
    // "X aktive" i panelheaderen vises kun når der er alerts — kun "Ingen aktive advarsler" vises
    expect(screen.queryByText(/^\d+ aktive$/)).not.toBeInTheDocument()
  })
})
