// @vitest-environment jsdom
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// fetch mock — returner success som standard
const fetchMock = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({}),
})
vi.stubGlobal('fetch', fetchMock)

vi.mock('lucide-react', () => ({
  Upload: () => null,
  X: () => null,
  FileIcon: () => null,
  Loader2: () => null,
}))

vi.mock('@/components/ui/b', async () => {
  const React = await import('react')
  return {
    Breadcrumb: ({ current }: { current: string }) =>
      React.createElement('nav', { 'aria-label': 'Brødkrummer' }, current),
    PageTopbar: ({ title }: { title: string }) => React.createElement('h1', null, title),
    BButton: ({
      children,
      onClick,
      disabled,
      href,
    }: {
      children: React.ReactNode
      onClick?: () => void
      disabled?: boolean
      href?: string
    }) => {
      if (href) return React.createElement('a', { href }, children)
      return React.createElement('button', { type: 'button', onClick, disabled }, children)
    },
    BFieldWrap: ({
      label,
      children,
      required,
      error,
      hint,
    }: {
      label: string
      children: React.ReactNode
      required?: boolean
      error?: string | null
      hint?: string
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement('label', null, label, required ? ' *' : ''),
        hint ? React.createElement('span', { className: 'hint' }, hint) : null,
        children,
        error ? React.createElement('span', { role: 'alert' }, error) : null
      ),
  }
})

vi.mock('@/lib/utils', () => ({ cn: (...c: string[]) => c.filter(Boolean).join(' ') }))
vi.mock('@/lib/labels', () => ({
  formatFileSize: (bytes: number) => `${Math.round(bytes / 1024)} KB`,
}))

import { UploadFormB } from '@/app/(dashboard)/documents/upload/upload-form-b'
import { toast } from 'sonner'

const COMPANIES = [
  { id: 'co-1', name: 'Klinik Nord ApS' },
  { id: 'co-2', name: 'Klinik Syd ApS' },
]

function makeFile(name = 'test.pdf', size = 1024, type = 'application/pdf'): File {
  return new File(['x'.repeat(size)], name, { type })
}

describe('UploadFormB', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderer breadcrumb og topbar', () => {
    render(<UploadFormB companies={COMPANIES} />)
    // h1 fra PageTopbar — bruger getAllByText da knappen også har teksten
    const matches = screen.getAllByText('Upload dokument')
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('navigation', { name: 'Brødkrummer' })).toBeTruthy()
  })

  it('renderer selskaber i dropdown', () => {
    render(<UploadFormB companies={COMPANIES} />)
    expect(screen.getByDisplayValue('Intet selskab — generelt dokument')).toBeTruthy()
    expect(screen.getByText('Klinik Nord ApS')).toBeTruthy()
    expect(screen.getByText('Klinik Syd ApS')).toBeTruthy()
  })

  it('upload-knap er disabled uden valgt fil', () => {
    render(<UploadFormB companies={COMPANIES} />)
    const btn = screen.getByRole('button', { name: /Upload dokument/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('viser fejl for for stor fil (> 10 MB)', () => {
    render(<UploadFormB companies={COMPANIES} />)

    const dropZone = screen.getByRole('button', { name: /Vælg fil eller træk og slip/ })
    const input = dropZone.parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    // Simulér fil der er 11 MB
    const bigFile = makeFile('big.pdf', 11 * 1024 * 1024)
    Object.defineProperty(input, 'files', { value: [bigFile], writable: false })
    fireEvent.change(input)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('for stor')
  })

  it('viser filnavn efter valg af gyldig fil', () => {
    render(<UploadFormB companies={COMPANIES} />)

    const dropZone = screen.getByRole('button', { name: /Vælg fil eller træk og slip/ })
    const input = dropZone.parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    const file = makeFile('kontrakt.pdf', 512 * 1024)
    Object.defineProperty(input, 'files', { value: [file], writable: false })
    fireEvent.change(input)

    expect(screen.getByText('kontrakt.pdf')).toBeTruthy()
  })

  it('kalder /api/upload med companyId når selskab er valgt', async () => {
    render(<UploadFormB companies={COMPANIES} />)

    // Vælg selskab
    const select = screen.getByDisplayValue('Intet selskab — generelt dokument')
    fireEvent.change(select, { target: { value: 'co-1' } })

    // Vælg fil
    const dropZone = screen.getByRole('button', { name: /Vælg fil eller træk og slip/ })
    const input = dropZone.parentElement?.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('kontrakt.pdf', 1024)
    Object.defineProperty(input, 'files', { value: [file], writable: false })
    fireEvent.change(input)

    // Upload
    const uploadBtn = screen.getByRole('button', { name: /Upload dokument/i })
    await act(async () => {
      fireEvent.click(uploadBtn)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/upload',
      expect.objectContaining({ method: 'POST' })
    )
    const callArgs = fetchMock.mock.calls[0] as [string, { body: FormData }]
    const formData = callArgs[1].body as FormData
    expect(formData.get('companyId')).toBe('co-1')
    expect(toast.success).toHaveBeenCalledWith('Dokument uploadet')
  })

  it('viser toast.error ved API-fejl', async () => {
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ error: 'Server fejl' }),
    })

    render(<UploadFormB companies={COMPANIES} />)

    const dropZone = screen.getByRole('button', { name: /Vælg fil eller træk og slip/ })
    const input = dropZone.parentElement?.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('doc.pdf', 1024)
    Object.defineProperty(input, 'files', { value: [file], writable: false })
    fireEvent.change(input)

    const uploadBtn = screen.getByRole('button', { name: /Upload dokument/i })
    await act(async () => {
      fireEvent.click(uploadBtn)
    })

    expect(toast.error).toHaveBeenCalledWith('Server fejl')
  })

  it('afviser ukendt filtype', () => {
    render(<UploadFormB companies={COMPANIES} />)

    const dropZone = screen.getByRole('button', { name: /Vælg fil eller træk og slip/ })
    const input = dropZone.parentElement?.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('data.exe', 1024, 'application/octet-stream')
    Object.defineProperty(input, 'files', { value: [file], writable: false })
    fireEvent.change(input)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Filtype ikke understøttet')
  })
})
