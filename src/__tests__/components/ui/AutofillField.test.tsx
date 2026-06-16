import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AutofillField } from '@/components/ui/AutofillField'

// ── fixtures ─────────────────────────────────────────────────────────────────

const suggestion = {
  value: 'Tandlæge Østerbro ApS',
  source: 'cvr_api' as const,
  confidence: 0.99,
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AutofillField', () => {
  it('renderer normalt BTextField uden suggestion', () => {
    render(<AutofillField label="Selskabsnavn" value="" onChange={vi.fn()} suggestion={null} />)
    expect(screen.getByLabelText(/selskabsnavn/i)).toBeInTheDocument()
    expect(screen.queryByText('Forslag fra CVR:')).toBeNull()
  })

  it('renderer normalt BTextField når value allerede er udfyldt', () => {
    render(
      <AutofillField
        label="Selskabsnavn"
        value="Andet navn"
        onChange={vi.fn()}
        suggestion={suggestion}
      />
    )
    // Feltet er udfyldt — forslagsbar skal ikke vises
    expect(screen.queryByLabelText('Acceptér')).toBeNull()
  })

  it('viser forslagsbar når suggestion er tilgængelig og feltet er tomt', () => {
    render(
      <AutofillField label="Selskabsnavn" value="" onChange={vi.fn()} suggestion={suggestion} />
    )
    expect(screen.getByText('Forslag fra CVR:')).toBeInTheDocument()
    expect(screen.getByText('Tandlæge Østerbro ApS')).toBeInTheDocument()
    expect(screen.getByLabelText('Acceptér')).toBeInTheDocument()
    expect(screen.getByLabelText('Afvis')).toBeInTheDocument()
  })

  it('kalder onChange med forslaget ved accept og skjuler baren', () => {
    const onChange = vi.fn()
    render(
      <AutofillField label="Selskabsnavn" value="" onChange={onChange} suggestion={suggestion} />
    )
    fireEvent.click(screen.getByLabelText('Acceptér'))
    expect(onChange).toHaveBeenCalledWith('Tandlæge Østerbro ApS')
    expect(screen.queryByText('Forslag fra CVR:')).toBeNull()
  })

  it('skjuler forslagsbar ved afvis uden at kalde onChange', () => {
    const onChange = vi.fn()
    render(
      <AutofillField label="Selskabsnavn" value="" onChange={onChange} suggestion={suggestion} />
    )
    fireEvent.click(screen.getByLabelText('Afvis'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByText('Forslag fra CVR:')).toBeNull()
  })

  it('viser korrekt kildebeskrivelse for internal', () => {
    render(
      <AutofillField
        label="Adresse"
        value=""
        onChange={vi.fn()}
        suggestion={{ value: 'Østerbrogade 1', source: 'internal', confidence: 1.0 }}
      />
    )
    expect(screen.getByText('Forslag fra intern data:')).toBeInTheDocument()
  })

  it('viser korrekt kildebeskrivelse for document_extraction', () => {
    render(
      <AutofillField
        label="By"
        value=""
        onChange={vi.fn()}
        suggestion={{ value: 'København', source: 'document_extraction', confidence: 0.8 }}
      />
    )
    expect(screen.getByText('Forslag fra dokument:')).toBeInTheDocument()
  })
})
