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

// ── FilterSearch ─────────────────────────────────────────────────────────────

describe('FilterSearch', () => {
  it('renderer søge-input med placeholder', () => {
    render(<FilterSearch value="" onChange={vi.fn()} placeholder="Søg selskaber..." />)
    expect(screen.getByPlaceholderText('Søg selskaber...')).toBeInTheDocument()
  })

  it('bruger default placeholder "Søg..." hvis ingen angives', () => {
    render(<FilterSearch value="" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Søg...')).toBeInTheDocument()
  })

  it('kalder onChange med input-tekst', () => {
    const onChange = vi.fn()
    render(<FilterSearch value="" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('Søg...'), { target: { value: 'tandlæge' } })
    expect(onChange).toHaveBeenCalledWith('tandlæge')
  })

  it('viser controlled value', () => {
    render(<FilterSearch value="test" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('test')).toBeInTheDocument()
  })
})

// ── FilterButton ──────────────────────────────────────────────────────────────

describe('FilterButton', () => {
  it('renderer children', () => {
    render(<FilterButton>Alle</FilterButton>)
    expect(screen.getByText('Alle')).toBeInTheDocument()
  })

  it('kalder onClick ved klik', () => {
    const onClick = vi.fn()
    render(<FilterButton onClick={onClick}>Filtrer</FilterButton>)
    fireEvent.click(screen.getByText('Filtrer'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('viser aktiv styling når active=true', () => {
    render(<FilterButton active>Aktiv</FilterButton>)
    expect(screen.getByText('Aktiv').className).toContain('bg-b-blue-bg')
  })

  it('viser inaktiv styling som standard', () => {
    render(<FilterButton>Inaktiv</FilterButton>)
    expect(screen.getByText('Inaktiv').className).not.toContain('bg-b-blue-bg')
  })
})

// ── FilterDropdown ────────────────────────────────────────────────────────────

describe('FilterDropdown', () => {
  const options = ['Alle', 'Aktiv', 'Inaktiv', 'Afsluttet']

  it('renderer knap med label', () => {
    render(<FilterDropdown label="Status" options={options} value="" onChange={vi.fn()} />)
    expect(screen.getByText(/Status/)).toBeInTheDocument()
  })

  it('åbner dropdown ved klik', () => {
    render(<FilterDropdown label="Status" options={options} value="" onChange={vi.fn()} />)
    fireEvent.click(screen.getByText(/Status/))
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText('Inaktiv')).toBeInTheDocument()
  })

  it('lukker dropdown og kalder onChange ved valg', () => {
    const onChange = vi.fn()
    render(<FilterDropdown label="Status" options={options} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText(/Status/))
    fireEvent.click(screen.getByText('Aktiv'))
    expect(onChange).toHaveBeenCalledWith('Aktiv')
    // Dropdown er lukket igen
    expect(screen.queryByText('Inaktiv')).toBeNull()
  })

  it('viser valgt værdi i knap-tekst når aktiv', () => {
    render(<FilterDropdown label="Status" options={options} value="Afsluttet" onChange={vi.fn()} />)
    expect(screen.getByText(/Afsluttet/)).toBeInTheDocument()
  })

  it('viser divider hvis angivet', () => {
    render(
      <FilterDropdown
        label="Status"
        options={options}
        value=""
        onChange={vi.fn()}
        divider="Filter"
      />
    )
    fireEvent.click(screen.getByText(/Status/))
    expect(screen.getByText('Filter')).toBeInTheDocument()
  })
})

// ── FilterReset ───────────────────────────────────────────────────────────────

describe('FilterReset', () => {
  it('renderer "Nulstil ×" knap', () => {
    render(<FilterReset onClick={vi.fn()} />)
    expect(screen.getByText('Nulstil ×')).toBeInTheDocument()
  })

  it('kalder onClick ved klik', () => {
    const onClick = vi.fn()
    render(<FilterReset onClick={onClick} />)
    fireEvent.click(screen.getByText('Nulstil ×'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

// ── SegmentedToggle ───────────────────────────────────────────────────────────

describe('SegmentedToggle', () => {
  const options = [
    { value: 'flat', label: 'Flat' },
    { value: 'grouped', label: 'Grupperet' },
    { value: 'kanban', label: 'Kanban' },
  ] as const

  it('renderer alle options', () => {
    render(<SegmentedToggle options={[...options]} value="flat" onChange={vi.fn()} />)
    expect(screen.getByText('Flat')).toBeInTheDocument()
    expect(screen.getByText('Grupperet')).toBeInTheDocument()
    expect(screen.getByText('Kanban')).toBeInTheDocument()
  })

  it('kalder onChange med valgt option', () => {
    const onChange = vi.fn()
    render(<SegmentedToggle options={[...options]} value="flat" onChange={onChange} />)
    fireEvent.click(screen.getByText('Grupperet'))
    expect(onChange).toHaveBeenCalledWith('grouped')
  })

  it('fremhæver aktiv option', () => {
    render(<SegmentedToggle options={[...options]} value="kanban" onChange={vi.fn()} />)
    expect(screen.getByText('Kanban').className).toContain('bg-b-1')
    expect(screen.getByText('Flat').className).not.toContain('bg-b-1')
  })
})

// ── FilterRow ────────────────────────────────────────────────────────────────

describe('FilterRow', () => {
  it('renderer children', () => {
    render(
      <FilterRow>
        <span>barn1</span>
        <span>barn2</span>
      </FilterRow>
    )
    expect(screen.getByText('barn1')).toBeInTheDocument()
    expect(screen.getByText('barn2')).toBeInTheDocument()
  })
})
