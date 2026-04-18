import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskHistory } from '@/components/task-detail/task-history'

describe('TaskHistory', () => {
  it('viser tom-state ved ingen historik', () => {
    render(<TaskHistory entries={[]} />)
    expect(screen.getByText('Ingen ændringer registreret endnu')).toBeInTheDocument()
  })

  it('viser historik-entries med fra→til-værdier', () => {
    render(
      <TaskHistory
        entries={[
          {
            id: 'h1',
            fieldLabel: 'Status',
            oldLabel: 'Ny',
            newLabel: 'Aktiv',
            changedAt: new Date(),
            changedByName: 'Philip Larsen',
          },
        ]}
      />
    )
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Ny')).toBeInTheDocument()
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText(/Philip Larsen/)).toBeInTheDocument()
  })

  it('viser flere entries i rækkefølge', () => {
    render(
      <TaskHistory
        entries={[
          {
            id: 'h1',
            fieldLabel: 'Prioritet',
            oldLabel: 'Lav',
            newLabel: 'Kritisk',
            changedAt: new Date(),
            changedByName: 'Maria Nielsen',
          },
          {
            id: 'h2',
            fieldLabel: 'Frist',
            oldLabel: '—',
            newLabel: '20. apr. 2026',
            changedAt: new Date(),
            changedByName: 'Philip Larsen',
          },
        ]}
      />
    )
    expect(screen.getByText('Prioritet')).toBeInTheDocument()
    expect(screen.getByText('Frist')).toBeInTheDocument()
    expect(screen.getByText('Lav')).toBeInTheDocument()
    expect(screen.getByText('Kritisk')).toBeInTheDocument()
    expect(screen.getByText('20. apr. 2026')).toBeInTheDocument()
  })
})
