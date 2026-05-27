import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BFieldWrap, BTextField, BTextareaField } from '@/components/ui/b/BField'

// ── BFieldWrap ────────────────────────────────────────────────────────────────

describe('BFieldWrap', () => {
  it('renderer label-tekst', () => {
    render(
      <BFieldWrap label="Selskabsnavn">
        <input />
      </BFieldWrap>
    )
    expect(screen.getByText('Selskabsnavn')).toBeInTheDocument()
  })

  it('linker label til child via htmlFor + id', () => {
    render(
      <BFieldWrap label="CVR-nummer" inputId="cvr-field">
        <input />
      </BFieldWrap>
    )
    const label = screen.getByText('CVR-nummer')
    expect(label).toHaveAttribute('for', 'cvr-field')
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'cvr-field')
  })

  it('viser påkrævet-indikator når required=true', () => {
    render(
      <BFieldWrap label="Email" required>
        <input />
      </BFieldWrap>
    )
    expect(screen.getByText('*')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true')
  })

  it('viser ikke påkrævet-indikator som standard', () => {
    render(
      <BFieldWrap label="Email">
        <input />
      </BFieldWrap>
    )
    expect(screen.queryByText('*')).toBeNull()
  })

  it('viser fejlbesked med role="alert" ved error', () => {
    render(
      <BFieldWrap label="Email" error="Ugyldig email-adresse">
        <input />
      </BFieldWrap>
    )
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Ugyldig email-adresse')
  })

  it('sætter aria-invalid på child ved error', () => {
    render(
      <BFieldWrap label="Email" error="Påkrævet">
        <input />
      </BFieldWrap>
    )
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('linker fejlbesked med aria-describedby', () => {
    render(
      <BFieldWrap label="Email" error="Påkrævet" inputId="email-field">
        <input />
      </BFieldWrap>
    )
    const input = screen.getByRole('textbox')
    const errorId = input.getAttribute('aria-describedby')
    expect(errorId).toBe('email-field-error')
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'email-field-error')
  })

  it('sætter ikke aria-invalid uden error', () => {
    render(
      <BFieldWrap label="Email">
        <input />
      </BFieldWrap>
    )
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid')
  })

  it('viser hint-tekst i stedet for fejl når ingen error', () => {
    render(
      <BFieldWrap label="Adresse" hint="Brug officiel adresse fra CVR">
        <input />
      </BFieldWrap>
    )
    expect(screen.getByText('Brug officiel adresse fra CVR')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('viser fejl frem for hint når begge er angivet', () => {
    render(
      <BFieldWrap label="Adresse" hint="Hjælpetekst" error="Fejl">
        <input />
      </BFieldWrap>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Fejl')
    expect(screen.queryByText('Hjælpetekst')).toBeNull()
  })
})

// ── BTextField ────────────────────────────────────────────────────────────────

describe('BTextField', () => {
  it('renderer label og input', () => {
    render(<BTextField label="Navn" value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText(/Navn/i)).toBeInTheDocument()
  })

  it('kalder onChange med ny værdi', () => {
    const onChange = vi.fn()
    render(<BTextField label="Navn" value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Tandlæge ApS' } })
    expect(onChange).toHaveBeenCalledWith('Tandlæge ApS')
  })

  it('viser fejlstate via BFieldWrap', () => {
    render(<BTextField label="Navn" value="" onChange={vi.fn()} error="Navn er påkrævet" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Navn er påkrævet')
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('er disabled når disabled=true', () => {
    render(<BTextField label="Navn" value="test" onChange={vi.fn()} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})

// ── BTextareaField ────────────────────────────────────────────────────────────

describe('BTextareaField', () => {
  it('renderer textarea med label', () => {
    render(<BTextareaField label="Beskrivelse" value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText(/Beskrivelse/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
  })

  it('kalder onChange med ny tekst', () => {
    const onChange = vi.fn()
    render(<BTextareaField label="Beskrivelse" value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Lang tekst' } })
    expect(onChange).toHaveBeenCalledWith('Lang tekst')
  })

  it('viser fejlstate', () => {
    render(<BTextareaField label="Notat" value="" onChange={vi.fn()} error="Notat er påkrævet" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Notat er påkrævet')
  })

  it('anvender rows-prop', () => {
    render(<BTextareaField label="Notat" value="" onChange={vi.fn()} rows={5} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5')
  })
})
