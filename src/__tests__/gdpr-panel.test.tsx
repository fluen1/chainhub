// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock GDPR actions FØR komponenten importeres
vi.mock('@/actions/gdpr', () => ({
  prepareGdprExport: vi.fn(),
  executeGdprDelete: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock useRouter
const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { GdprPanel } from '@/app/(dashboard)/persons/[id]/gdpr-panel'
import { prepareGdprExport, executeGdprDelete } from '@/actions/gdpr'
import { toast } from 'sonner'

describe('GdprPanel', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-expect-error — nulstil til stub
    delete window.location
    // @ts-expect-error — simpel stub
    window.location = { href: '' }
  })

  afterEach(() => {
    // @ts-expect-error — gendan original
    window.location = originalLocation
  })

  it('renderer begge GDPR-knapper', () => {
    render(<GdprPanel personId="p1" personName="Maria Hansen" />)
    expect(screen.getByRole('button', { name: /Eksportér persondata/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Slet persondata/i })).toBeTruthy()
  })

  it('export-klik kalder prepareGdprExport og redirecter til downloadUrl', async () => {
    ;(prepareGdprExport as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { downloadUrl: '/api/export/gdpr/p1' },
    })

    render(<GdprPanel personId="p1" personName="Maria Hansen" />)
    fireEvent.click(screen.getByRole('button', { name: /Eksportér persondata/i }))

    await waitFor(() => {
      expect(prepareGdprExport).toHaveBeenCalledWith('p1')
      expect(window.location.href).toBe('/api/export/gdpr/p1')
    })
  })

  it('delete-klik åbner dialog med navn i teksten', () => {
    render(<GdprPanel personId="p1" personName="Maria Hansen" />)
    fireEvent.click(screen.getByRole('button', { name: /Slet persondata/i }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/Slet persondata — GDPR Art\. 17/i)).toBeTruthy()
    // Navnet skal optræde i dialogen
    expect(screen.getByText('Maria Hansen')).toBeTruthy()
  })

  it('Slet permanent er disabled med forkert navn — executeGdprDelete kaldes ikke', () => {
    render(<GdprPanel personId="p1" personName="Maria Hansen" />)
    fireEvent.click(screen.getByRole('button', { name: /Slet persondata/i }))

    const input = screen.getByLabelText('Bekræft navn') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Forkert navn' } })

    const slet = screen.getByRole('button', { name: /Slet permanent/i }) as HTMLButtonElement
    expect(slet.disabled).toBe(true)

    fireEvent.click(slet)
    expect(executeGdprDelete).not.toHaveBeenCalled()
  })

  it('korrekt navn kalder executeGdprDelete + viser success + router.push', async () => {
    ;(executeGdprDelete as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { personUpdated: 1, total: 5 },
    })

    render(<GdprPanel personId="p1" personName="Maria Hansen" />)
    fireEvent.click(screen.getByRole('button', { name: /Slet persondata/i }))

    const input = screen.getByLabelText('Bekræft navn') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Maria Hansen' } })

    const slet = screen.getByRole('button', { name: /Slet permanent/i }) as HTMLButtonElement
    expect(slet.disabled).toBe(false)
    fireEvent.click(slet)

    await waitFor(() => {
      expect(executeGdprDelete).toHaveBeenCalledWith('p1')
      expect(toast.success).toHaveBeenCalled()
      expect(pushMock).toHaveBeenCalledWith('/persons')
    })
  })
})
