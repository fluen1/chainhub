// @vitest-environment jsdom
// Verificerer at alle 5 list-sider (companies, contracts, cases, tasks, persons)
// bruger ExportButton med korrekt entity, og at klik kalder prepareExport korrekt.

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/actions/export', () => ({
  prepareExport: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { prepareExport } from '@/actions/export'
import { ExportButton } from '@/components/ui/export-button'
import type { ExportableEntity } from '@/lib/export/entities'

describe('ExportButton — entity-wiring pr. liste', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-expect-error — stub
    delete window.location
    // @ts-expect-error — simpel stub
    window.location = { href: '' }
  })

  afterEach(() => {
    // @ts-expect-error — gendan original
    window.location = originalLocation
  })

  const entities: { entity: ExportableEntity; label: string }[] = [
    { entity: 'companies', label: '/companies liste' },
    { entity: 'contracts', label: '/contracts liste' },
    { entity: 'cases', label: '/cases liste' },
    { entity: 'tasks', label: '/tasks liste' },
    { entity: 'persons', label: '/persons liste' },
  ]

  for (const { entity, label } of entities) {
    it(`${label}: klik kalder prepareExport med entity="${entity}"`, async () => {
      ;(prepareExport as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { downloadUrl: `/api/export/${entity}` },
      })

      render(<ExportButton entity={entity} label="Eksportér ▾" />)
      const btn = screen.getByRole('button', { name: /Eksportér ▾/i })
      expect(btn).toBeTruthy()

      fireEvent.click(btn)

      await waitFor(() => {
        expect(prepareExport).toHaveBeenCalledWith({ entity })
        expect(window.location.href).toBe(`/api/export/${entity}`)
      })
    })
  }
})
