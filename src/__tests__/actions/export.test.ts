import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn(),
}))
vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi
    .fn()
    .mockReturnValue({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))

import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { recordAuditEvent } from '@/lib/audit'
import { prepareExport } from '@/actions/export'

function makeSession() {
  return {
    user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
    expires: '',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('prepareExport', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await prepareExport({ entity: 'companies' })
    expect(result).toMatchObject({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl ved ugyldigt entity', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    const result = await prepareExport({ entity: 'invalid' as any })
    expect(result).toMatchObject({ error: 'Ugyldigt input' })
  })

  it('returnerer fejl hvis mangler export-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await prepareExport({ entity: 'companies' })
    expect(result).toMatchObject({ error: 'Du har ikke adgang til at eksportere data' })
  })

  it('returnerer download-URL (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)

    const result = await prepareExport({ entity: 'companies' })

    expect(result).toMatchObject({ data: { downloadUrl: '/api/export/companies' } })
    expect(recordAuditEvent).toHaveBeenCalledOnce()
  })

  it('returnerer download-URL for alle entity-typer', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)

    const entities = ['companies', 'contracts', 'cases', 'tasks', 'persons', 'visits'] as const
    for (const entity of entities) {
      const result = await prepareExport({ entity })
      expect(result).toMatchObject({ data: { downloadUrl: `/api/export/${entity}` } })
    }
  })

  it('returnerer fejl hvis audit-log kaster', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(recordAuditEvent).mockRejectedValue(new Error('DB fejl'))

    const result = await prepareExport({ entity: 'companies' })
    expect(result).toMatchObject({ error: 'Eksport kunne ikke forberedes' })
  })
})
