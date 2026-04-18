import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskHeader } from '@/components/task-detail/task-header'

describe('TaskHeader', () => {
  const base = {
    title: 'Forny erhvervslejekontrakt',
    status: 'AKTIV_TASK',
    priority: 'HOEJ',
  }

  it('viser titel, status og prioritet', () => {
    render(
      <TaskHeader
        {...base}
        dueDate={null}
        urgency="none"
      />
    )
    expect(screen.getByRole('heading', { name: 'Forny erhvervslejekontrakt' })).toBeInTheDocument()
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText('Høj')).toBeInTheDocument()
  })

  it('viser Forfalden-badge ved urgency=overdue', () => {
    render(
      <TaskHeader
        {...base}
        dueDate={new Date('2026-04-10')}
        urgency="overdue"
      />
    )
    expect(screen.getByText('Forfalden')).toBeInTheDocument()
  })

  it('viser Haster-badge ved urgency=due-soon', () => {
    render(
      <TaskHeader
        {...base}
        dueDate={new Date('2026-04-20')}
        urgency="due-soon"
      />
    )
    expect(screen.getByText('Haster')).toBeInTheDocument()
  })

  it('skjuler urgency-badge ved urgency=none', () => {
    render(
      <TaskHeader
        {...base}
        dueDate={null}
        urgency="none"
      />
    )
    expect(screen.queryByText('Forfalden')).not.toBeInTheDocument()
    expect(screen.queryByText('Haster')).not.toBeInTheDocument()
  })

  it('renderer editButton-slot', () => {
    render(
      <TaskHeader
        {...base}
        dueDate={null}
        urgency="none"
        editButton={<button>Redigér</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Redigér' })).toBeInTheDocument()
  })
})
