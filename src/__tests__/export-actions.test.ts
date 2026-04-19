import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

import { prepareExport } from '@/actions/export'

describe('prepareExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returnerer download-URL og skriver audit-log ved happy path', async () => {
    const { recordAuditEvent } = await import('@/lib/audit')
    const result = await prepareExport({ entity: 'companies' })

    expect('data' in result).toBe(true)
    if ('data' in result && result.data) {
      expect(result.data.downloadUrl).toBe('/api/export/companies')
    }
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'EXPORT',
        resourceType: 'companies',
        resourceId: 'bulk',
        sensitivity: 'INTERN',
        changes: { entity: 'companies' },
      })
    )
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)

    const result = await prepareExport({ entity: 'contracts' })
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser ikke-admin brugere', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)

    const result = await prepareExport({ entity: 'cases' })
    expect(result).toEqual({ error: 'Kun admin kan eksportere data' })
  })
})
