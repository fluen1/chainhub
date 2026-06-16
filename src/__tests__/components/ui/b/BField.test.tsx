import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  BFieldWrap,
  BTextField,
  BTextareaField,
  BSegmentedField,
  BFieldRow,
} from '@/components/ui/b/BField'

describe('BFieldWrap', () => {
  it('renders label text', () => {
    render(
      <BFieldWrap label="Fornavn">
        <input />
      </BFieldWrap>
    )
    expect(screen.getByText('Fornavn')).toBeInTheDocument()
  })

  it('renders required asterisk when required', () => {
    render(
      <BFieldWrap label="Navn" required>
        <input />
      </BFieldWrap>
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('renders hint when provided', () => {
    render(
      <BFieldWrap label="CVR" hint="8 cifre">
        <input />
      </BFieldWrap>
    )
    expect(screen.getByText('8 cifre')).toBeInTheDocument()
  })

  it('renders error message with role=alert', () => {
    render(
      <BFieldWrap label="Email" error="Ugyldig email">
        <input />
      </BFieldWrap>
    )
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Ugyldig email')
  })

  it('does not render error when error is null', () => {
    render(
      <BFieldWrap label="Email" error={null}>
        <input />
      </BFieldWrap>
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('BTextField', () => {
  it('renders with label', () => {
    render(<BTextField label="Firmanavn" value="" onChange={vi.fn()} />)
    expect(screen.getByText('Firmanavn')).toBeInTheDocument()
  })

  it('shows current value', () => {
    render(<BTextField label="Navn" value="Tandlæge ApS" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('Tandlæge ApS')).toBeInTheDocument()
  })

  it('calls onChange when user types', () => {
    const onChange = vi.fn()
    render(<BTextField label="Navn" value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ny tekst' } })
    expect(onChange).toHaveBeenCalledWith('Ny tekst')
  })

  it('renders placeholder', () => {
    render(<BTextField label="Søg" value="" onChange={vi.fn()} placeholder="Skriv her..." />)
    expect(screen.getByPlaceholderText('Skriv her...')).toBeInTheDocument()
  })

  it('is disabled when disabled=true', () => {
    render(<BTextField label="Felt" value="" onChange={vi.fn()} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('shows error styling when error provided', () => {
    const { container } = render(
      <BTextField label="Email" value="" onChange={vi.fn()} error="Fejl" />
    )
    const input = container.querySelector('input')!
    expect(input.className).toContain('border-b-red-fg')
  })
})

describe('BTextareaField', () => {
  it('renders with label', () => {
    render(<BTextareaField label="Beskrivelse" value="" onChange={vi.fn()} />)
    expect(screen.getByText('Beskrivelse')).toBeInTheDocument()
  })

  it('calls onChange on input', () => {
    const onChange = vi.fn()
    render(<BTextareaField label="Note" value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ny note' } })
    expect(onChange).toHaveBeenCalledWith('Ny note')
  })

  it('renders as textarea element', () => {
    render(<BTextareaField label="Note" value="" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
  })
})

describe('BSegmentedField', () => {
  const options = [
    { value: 'FYSISK', label: 'Fysisk' },
    { value: 'DIGITAL', label: 'Digital' },
  ]

  it('renders label', () => {
    render(<BSegmentedField label="Type" options={options} value="FYSISK" onChange={vi.fn()} />)
    expect(screen.getByText('Type')).toBeInTheDocument()
  })

  it('renders all options', () => {
    render(<BSegmentedField label="Type" options={options} value="FYSISK" onChange={vi.fn()} />)
    expect(screen.getByText('Fysisk')).toBeInTheDocument()
    expect(screen.getByText('Digital')).toBeInTheDocument()
  })

  it('marks selected option with aria-checked=true', () => {
    render(<BSegmentedField label="Type" options={options} value="DIGITAL" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Digital' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Fysisk' })).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange when option clicked', () => {
    const onChange = vi.fn()
    render(<BSegmentedField label="Type" options={options} value="FYSISK" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Digital' }))
    expect(onChange).toHaveBeenCalledWith('DIGITAL')
  })
})

describe('BFieldRow', () => {
  it('renders children in grid layout', () => {
    const { container } = render(
      <BFieldRow>
        <div>Felt 1</div>
        <div>Felt 2</div>
      </BFieldRow>
    )
    // BFieldRow er responsiv: grid-cols-1 på mobil, sm:grid-cols-2 på tablet+
    expect(container.firstChild).toHaveClass('grid')
    expect(container.firstChild).toHaveClass('sm:grid-cols-2')
    expect(screen.getByText('Felt 1')).toBeInTheDocument()
    expect(screen.getByText('Felt 2')).toBeInTheDocument()
  })
})
