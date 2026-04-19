// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock prepareExport — skal mockes FØR komponenten importeres
vi.mock('@/actions/export', () => ({
  prepareExport: vi.fn(),
}))

// Mock sonner — vi vil verificere at toast.error kaldes
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

import { ExportButton } from '@/components/ui/export-button'
import { prepareExport } from '@/actions/export'
import { toast } from 'sonner'

describe('ExportButton', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    // Erstat window.location med en mockable version
    // @ts-expect-error — vi nulstiller til en simpel stub
    delete window.location
    // @ts-expect-error — simpel stub matcher ikke fuld Location
    window.location = { href: '' }
  })

  afterEach(() => {
    // @ts-expect-error — gendan original
    window.location = originalLocation
  })

  it('renderer med default-label', () => {
    render(<ExportButton entity="companies" />)
    expect(screen.getByRole('button', { name: /Eksportér CSV/i })).toBeTruthy()
  })

  it('klik kalder prepareExport og navigerer til download-URL ved success', async () => {
    ;(prepareExport as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { downloadUrl: '/api/export/companies' },
    })

    render(<ExportButton entity="companies" />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(prepareExport).toHaveBeenCalledWith({ entity: 'companies' })
      expect(window.location.href).toBe('/api/export/companies')
    })
  })

  it('viser toast ved fejl fra prepareExport', async () => {
    ;(prepareExport as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: 'Kun admin kan eksportere data',
    })

    render(<ExportButton entity="contracts" />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Kun admin kan eksportere data')
      expect(window.location.href).toBe('')
    })
  })
})
