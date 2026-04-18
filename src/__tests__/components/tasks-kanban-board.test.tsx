import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TasksKanbanBoard, type KanbanTask } from '@/components/tasks/tasks-kanban-board'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/actions/tasks', () => ({
  updateTaskStatus: vi.fn().mockResolvedValue({ data: null }),
}))

function makeTask(overrides: Partial<KanbanTask>): KanbanTask {
  return {
    id: 't1',
    title: 'Opgave',
    status: 'NY',
    priority: 'MELLEM',
    due_date: null,
    assigneeName: null,
    caseTitle: null,
    caseId: null,
    ...overrides,
  }
}

describe('TasksKanbanBoard', () => {
  it('renderer 4 kolonner med dansk label', () => {
    render(<TasksKanbanBoard tasks={[]} />)
    expect(screen.getByText('Ny')).toBeInTheDocument()
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText('Afventer')).toBeInTheDocument()
    expect(screen.getByText('Lukket')).toBeInTheDocument()
  })

  it('placerer opgaver i kolonne ud fra status', () => {
    render(
      <TasksKanbanBoard
        tasks={[
          makeTask({ id: 't1', title: 'Ny opgave A', status: 'NY' }),
          makeTask({ id: 't2', title: 'Aktiv opgave B', status: 'AKTIV_TASK' }),
          makeTask({ id: 't3', title: 'Afventer C', status: 'AFVENTER' }),
          makeTask({ id: 't4', title: 'Lukket D', status: 'LUKKET' }),
        ]}
      />
    )
    expect(screen.getByText('Ny opgave A')).toBeInTheDocument()
    expect(screen.getByText('Aktiv opgave B')).toBeInTheDocument()
    expect(screen.getByText('Afventer C')).toBeInTheDocument()
    expect(screen.getByText('Lukket D')).toBeInTheDocument()
  })

  it('viser antal opgaver pr. kolonne', () => {
    render(
      <TasksKanbanBoard
        tasks={[
          makeTask({ id: 't1', status: 'NY' }),
          makeTask({ id: 't2', status: 'NY' }),
          makeTask({ id: 't3', status: 'AKTIV_TASK' }),
        ]}
      />
    )
    // Tre kolonner har "0" (Afventer, Lukket er tomme og én kolonne har måske 0),
    // Men mindst én kolonne viser "2" og én "1"
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('viser "Ingen opgaver" tom-state per tom kolonne', () => {
    render(<TasksKanbanBoard tasks={[]} />)
    expect(screen.getAllByText('Ingen opgaver')).toHaveLength(4)
  })

  it('gør kort draggable og klikbart som link', () => {
    render(
      <TasksKanbanBoard
        tasks={[makeTask({ id: 't1', title: 'Træk mig', status: 'NY' })]}
      />
    )
    const link = screen.getByRole('link', { name: 'Træk mig' })
    expect(link).toHaveAttribute('href', '/tasks/t1')
  })

  it('viser prioritet og due_date på kort', () => {
    render(
      <TasksKanbanBoard
        tasks={[
          makeTask({
            id: 't1',
            title: 'Kritisk opgave',
            priority: 'KRITISK',
            due_date: '2026-04-20T00:00:00.000Z',
          }),
        ]}
      />
    )
    expect(screen.getByText('Kritisk')).toBeInTheDocument()
    // Dansk dato-format vil have '20' og '2026' i sig
    expect(screen.getByText(/20\.4\.2026|20\.04\.2026/)).toBeInTheDocument()
  })

  it('viser assignee og case-link', () => {
    render(
      <TasksKanbanBoard
        tasks={[
          makeTask({
            id: 't1',
            title: 'Sags-opgave',
            assigneeName: 'Philip Larsen',
            caseTitle: 'Opkøb Nordhavn',
            caseId: 'ca1',
          }),
        ]}
      />
    )
    expect(screen.getByText('Philip Larsen')).toBeInTheDocument()
    const caseLink = screen.getByRole('link', { name: '→ Opkøb Nordhavn' })
    expect(caseLink).toHaveAttribute('href', '/cases/ca1')
  })
})
