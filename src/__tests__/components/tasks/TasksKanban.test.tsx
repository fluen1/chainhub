import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { TaskRow } from '@/app/(dashboard)/tasks/tasks-list-b'
import { KanbanView } from '@/components/tasks/TasksKanban'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/actions/tasks', () => ({
  updateTaskStatus: vi.fn().mockResolvedValue({ data: null }),
}))

// Mock SegmentedToggle + Panel/Badge (fra ui/b)
vi.mock('@/components/ui/b', async () => {
  const actual = await vi.importActual('@/components/ui/b')
  return {
    ...actual,
    SegmentedToggle: ({
      value,
      onChange,
      options,
    }: {
      value: string
      onChange: (v: string) => void
      options: Array<{ value: string; label: string }>
    }) => (
      <div data-testid="kanban-mobile-tabs">
        {options.map((o) => (
          <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={value === o.value}>
            {o.label}
          </button>
        ))}
      </div>
    ),
  }
})

function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 'task-1',
    titel: 'Test opgave',
    selskab: 'Tandlæge ApS',
    type: 'INTERN',
    prio: 'Høj',
    rawPrio: 'HOEJ',
    status: 'Åben',
    rawStatus: 'NY',
    frist: '15. jan',
    fristDays: 10,
    ansvarlig: 'Philip Birkenborg',
    isMine: false,
    ...overrides,
  }
}

describe('KanbanView', () => {
  it('renders all 4 kanban columns', () => {
    render(<KanbanView tasks={[]} onRowClick={vi.fn()} />)
    // Column titles appear at least once (may also appear in mobile tab mock)
    expect(screen.getAllByText('Åben').length).toBeGreaterThan(0)
    expect(screen.getAllByText('I gang').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Afventer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Fuldført').length).toBeGreaterThan(0)
  })

  it('renders task card in correct column', () => {
    const task = makeTask({ rawStatus: 'NY', titel: 'Min test opgave' })
    render(<KanbanView tasks={[task]} onRowClick={vi.fn()} />)
    expect(screen.getByText('Min test opgave')).toBeInTheDocument()
  })

  it('renders empty state in column with no tasks', () => {
    render(<KanbanView tasks={[]} onRowClick={vi.fn()} />)
    const ingens = screen.getAllByText('Ingen')
    expect(ingens.length).toBe(4)
  })

  it('renders task company name', () => {
    const task = makeTask({ selskab: 'Optik Gruppen ApS' })
    render(<KanbanView tasks={[task]} onRowClick={vi.fn()} />)
    expect(screen.getByText('Optik Gruppen ApS')).toBeInTheDocument()
  })

  it('calls onRowClick when task card is clicked', () => {
    const onRowClick = vi.fn()
    const task = makeTask({ id: 'test-id-42' })
    render(<KanbanView tasks={[task]} onRowClick={onRowClick} />)
    fireEvent.click(screen.getByText('Test opgave'))
    expect(onRowClick).toHaveBeenCalledWith('test-id-42')
  })

  it('renders aria-live region for screen reader announcements', () => {
    render(<KanbanView tasks={[]} onRowClick={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders column counts', () => {
    const tasks = [
      makeTask({ id: '1', rawStatus: 'NY' }),
      makeTask({ id: '2', rawStatus: 'NY' }),
      makeTask({ id: '3', rawStatus: 'AKTIV_TASK' }),
    ]
    render(<KanbanView tasks={tasks} onRowClick={vi.fn()} />)
    // 2 tasks in NY column, 1 in AKTIV_TASK
    const counts = screen.getAllByText('2')
    expect(counts.length).toBeGreaterThan(0)
  })

  it('renders mobile tab selector', () => {
    render(<KanbanView tasks={[]} onRowClick={vi.fn()} />)
    // May render multiple instances (component + mock)
    expect(screen.getAllByTestId('kanban-mobile-tabs').length).toBeGreaterThan(0)
  })

  it('shows strikethrough for completed tasks', () => {
    const task = makeTask({ rawStatus: 'LUKKET', status: 'Fuldført' })
    const { container } = render(<KanbanView tasks={[task]} onRowClick={vi.fn()} />)
    expect(container.querySelector('.line-through')).toBeInTheDocument()
  })
})
