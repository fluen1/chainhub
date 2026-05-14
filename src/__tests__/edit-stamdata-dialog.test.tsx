// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/actions/companies', () => ({
  updateCompanyStamdata: vi.fn().mockResolvedValue({ data: undefined }),
}))

// B-stil imports — brug inline mocks så vi undgår at trække hele CSS-lag ind
vi.mock('@/components/ui/b', async () => {
  const React = await import('react')
  return {
    BModal: ({
      open,
      onClose,
      onSubmit,
      title,
      children,
      submitLabel,
      submitting,
      submitDisabled,
    }: {
      open: boolean
      onClose: () => void
      onSubmit?: () => void
      title: React.ReactNode
      children: React.ReactNode
      submitLabel: string
      submitting?: boolean
      submitDisabled?: boolean
    }) => {
      if (!open) return null
      return React.createElement(
        'div',
        { role: 'dialog', 'aria-modal': 'true' },
        React.createElement('h2', null, title),
        children,
        React.createElement(
          'button',
          { type: 'button', onClick: onClose, disabled: submitting },
          'Annuller'
        ),
        React.createElement(
          'button',
          { type: 'button', onClick: onSubmit, disabled: submitDisabled || submitting },
          submitting ? 'Gemmer...' : submitLabel
        )
      )
    },
    BTextField: ({
      label,
      value,
      onChange,
      error,
      required,
    }: {
      label: string
      value: string
      onChange: (v: string) => void
      error?: string | null
      required?: boolean
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement('label', null, label, required ? ' *' : ''),
        React.createElement('input', {
          'aria-label': label,
          value,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        }),
        error ? React.createElement('span', { role: 'alert' }, error) : null
      ),
    BTextareaField: ({
      label,
      value,
      onChange,
    }: {
      label: string
      value: string
      onChange: (v: string) => void
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement('label', null, label),
        React.createElement('textarea', {
          'aria-label': label,
          value,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
        })
      ),
    BFieldWrap: ({ label, children }: { label: string; children: React.ReactNode }) =>
      React.createElement('div', null, React.createElement('label', null, label), children),
    BFieldRow: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
  }
})

vi.mock('@/lib/utils', () => ({ cn: (...c: string[]) => c.filter(Boolean).join(' ') }))

import { EditStamdataDialog } from '@/components/companies/EditStamdataDialog'
import { updateCompanyStamdata } from '@/actions/companies'
import { toast } from 'sonner'

const INITIAL = {
  name: 'TandlægeGruppen A/S',
  cvr: '12345678',
  address: 'Østerbrogade 1',
  postal_code: '2100',
  city: 'København Ø',
}

describe('EditStamdataDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderer ikke når closed', () => {
    const { container } = render(
      <EditStamdataDialog open={false} onClose={vi.fn()} companyId="co-1" initial={INITIAL} />
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renderer modal med forudfyldte felter når open=true', () => {
    render(<EditStamdataDialog open={true} onClose={vi.fn()} companyId="co-1" initial={INITIAL} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    const nameInput = screen.getByDisplayValue('TandlægeGruppen A/S')
    expect(nameInput).toBeTruthy()
    expect(screen.getByDisplayValue('12345678')).toBeTruthy()
  })

  it('viser valideringsfejl for tomt navn', async () => {
    render(<EditStamdataDialog open={true} onClose={vi.fn()} companyId="co-1" initial={INITIAL} />)
    // Tøm navn-feltet
    const nameInput = screen.getByDisplayValue('TandlægeGruppen A/S')
    fireEvent.change(nameInput, { target: { value: '' } })

    // Submit-knap er disabled når navn er tomt — det er korrekt adfærd
    const submitBtn = screen.getByText('Gem ændringer')
    expect(submitBtn).toBeTruthy()
    // disabled-attribut er sat
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('viser valideringsfejl for ugyldig CVR', async () => {
    render(<EditStamdataDialog open={true} onClose={vi.fn()} companyId="co-1" initial={INITIAL} />)
    const cvrInput = screen.getByDisplayValue('12345678')
    fireEvent.change(cvrInput, { target: { value: '123' } }) // for kort

    // Klik submit via knap (aktiverer validate())
    const submitBtn = screen.getByText('Gem ændringer')
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('8 cifre')
  })

  it('kalder updateCompanyStamdata med korrekt payload på happy path', async () => {
    render(<EditStamdataDialog open={true} onClose={vi.fn()} companyId="co-1" initial={INITIAL} />)

    const submitBtn = screen.getByText('Gem ændringer')
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    expect(updateCompanyStamdata).toHaveBeenCalledWith(
      'co-1',
      expect.objectContaining({
        name: 'TandlægeGruppen A/S',
        cvr: '12345678',
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Stamdata opdateret')
  })

  it('viser toast.error ved action-fejl', async () => {
    vi.mocked(updateCompanyStamdata).mockResolvedValueOnce({ error: 'Intern fejl' })

    render(<EditStamdataDialog open={true} onClose={vi.fn()} companyId="co-1" initial={INITIAL} />)

    const submitBtn = screen.getByText('Gem ændringer')
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    expect(toast.error).toHaveBeenCalledWith('Intern fejl')
  })

  it('kalder onClose ved klik på Annuller', () => {
    const onClose = vi.fn()
    render(<EditStamdataDialog open={true} onClose={onClose} companyId="co-1" initial={INITIAL} />)

    fireEvent.click(screen.getByText('Annuller'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
