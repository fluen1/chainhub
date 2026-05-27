import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  FilterRow,
  FilterSearch,
  FilterButton,
  FilterDropdown,
  FilterReset,
  SegmentedToggle,
} from '@/components/ui/b/FilterRow'

// ── FilterRow ─────────────────────────────────────────────────────────────────

describe('FilterRow', () => {
  it('renders children', () => {
    render(
      <FilterRow>
        <span>child</span>
      </FilterRow>
    )
    expect(screen.getByText('child')).toBeInTheDocument()
  })
})

// ── FilterSearch ──────────────────────────────────────────────────────────────

describe('FilterSearch', () => {
  it('renders an input with the given value', () => {
    render(<FilterSearch value="tandlæge" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('tandlæge')).toBeInTheDocument()
  })

  it('calls onChange with new value on input change', () => {
    const onChange = vi.fn()
    render(<FilterSearch value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalledWith('test')
  })

  it('renders with default placeholder "Søg..."', () => {
    render(<FilterSearch value="" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Søg...')).toBeInTheDocument()
  })

  it('renders with custom placeholder', () => {
    render(<FilterSearch value="" onChange={vi.fn()} placeholder="Søg selskaber..." />)
    expect(screen.getByPlaceholderText('Søg selskaber...')).toBeInTheDocument()
  })
})

// ── FilterButton ──────────────────────────────────────────────────────────────

describe('FilterButton', () => {
  it('renders children', () => {
    render(<FilterButton>Type</FilterButton>)
    expect(screen.getByText('Type')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<FilterButton onClick={onClick}>Klik</FilterButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies active styles when active=true', () => {
    render(<FilterButton active>Aktiv</FilterButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-b-blue-bg')
  })

  it('applies default styles when active is false', () => {
    render(<FilterButton active={false}>Inaktiv</FilterButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).not.toContain('bg-b-blue-bg')
  })
})

// ── FilterDropdown ────────────────────────────────────────────────────────────

describe('FilterDropdown', () => {
  const options = ['Alle', 'Aktiv', 'Udløbet', 'Opsagt']

  it('renders the label when no value is selected', () => {
    render(<FilterDropdown label="Status" options={options} value="Alle" onChange={vi.fn()} />)
    expect(screen.getByText('Status ▾')).toBeInTheDocument()
  })

  it('shows the selected value instead of label when value is set', () => {
    render(<FilterDropdown label="Status" options={options} value="Aktiv" onChange={vi.fn()} />)
    expect(screen.getByText('Aktiv ▾')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<FilterDropdown label="Status" options={options} value="Alle" onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Status ▾'))
    // All options should be visible in the open dropdown
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText('Udløbet')).toBeInTheDocument()
  })

  it('calls onChange and closes dropdown on option select', () => {
    const onChange = vi.fn()
    render(<FilterDropdown label="Status" options={options} value="Alle" onChange={onChange} />)
    fireEvent.click(screen.getByText('Status ▾'))
    fireEvent.click(screen.getByText('Aktiv'))
    expect(onChange).toHaveBeenCalledWith('Aktiv')
    // Dropdown closes — option list should no longer be visible
    expect(screen.queryByText('Udløbet')).not.toBeInTheDocument()
  })

  it('renders divider label when divider prop is provided', () => {
    render(
      <FilterDropdown
        label="Type"
        options={options}
        value="Alle"
        onChange={vi.fn()}
        divider="Filtrer"
      />
    )
    fireEvent.click(screen.getByText('Type ▾'))
    expect(screen.getByText('Filtrer')).toBeInTheDocument()
  })
})

// ── FilterReset ───────────────────────────────────────────────────────────────

describe('FilterReset', () => {
  it('renders "Nulstil ×"', () => {
    render(<FilterReset onClick={vi.fn()} />)
    expect(screen.getByText('Nulstil ×')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<FilterReset onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

// ── SegmentedToggle ───────────────────────────────────────────────────────────

describe('SegmentedToggle', () => {
  const options = [
    { value: 'flat' as const, label: 'Flat' },
    { value: 'grouped' as const, label: 'Grupperet' },
    { value: 'kanban' as const, label: 'Kanban' },
  ]

  it('renders all option labels', () => {
    render(<SegmentedToggle options={options} value="flat" onChange={vi.fn()} />)
    expect(screen.getByText('Flat')).toBeInTheDocument()
    expect(screen.getByText('Grupperet')).toBeInTheDocument()
    expect(screen.getByText('Kanban')).toBeInTheDocument()
  })

  it('applies active style to selected option', () => {
    render(<SegmentedToggle options={options} value="grouped" onChange={vi.fn()} />)
    const activeBtn = screen.getByText('Grupperet')
    expect(activeBtn.className).toContain('bg-b-1')
    expect(activeBtn.className).toContain('text-white')
  })

  it('calls onChange with the clicked option value', () => {
    const onChange = vi.fn()
    render(<SegmentedToggle options={options} value="flat" onChange={onChange} />)
    fireEvent.click(screen.getByText('Kanban'))
    expect(onChange).toHaveBeenCalledWith('kanban')
  })

  it('does not apply active style to non-selected options', () => {
    render(<SegmentedToggle options={options} value="flat" onChange={vi.fn()} />)
    const inactiveBtn = screen.getByText('Grupperet')
    expect(inactiveBtn.className).not.toContain('bg-b-1 text-white')
  })
})
