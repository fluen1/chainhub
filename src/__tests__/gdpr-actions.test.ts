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

vi.mock('@/lib/export/gdpr', () => ({
  gdprExportPerson: vi.fn().mockResolvedValue({
    exportedAt: new Date(),
    person: { id: 'p-1' },
    companyPersons: [],
    ownerships: [],
    contractParties: [],
    casePersons: [],
    comments: [],
    metadata: { note: 'test' },
  }),
  gdprDeletePerson: vi.fn().mockResolvedValue({
    deleted: true,
    summary: {
      personUpdated: 1,
      companyPersonsEnded: 2,
      ownershipsEnded: 1,
      contractPartiesDeleted: 0,
      casePersonsDeleted: 0,
    },
  }),
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { prepareGdprExport, executeGdprDelete } from '@/actions/gdpr'

describe('prepareGdprExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returnerer download-URL og logger FORTROLIG audit-event ved happy path', async () => {
    const { recordAuditEvent } = await import('@/lib/audit')
    const result = await prepareGdprExport('person-123')

    expect('data' in result).toBe(true)
    if ('data' in result && result.data) {
      expect(result.data.downloadUrl).toBe('/api/export/gdpr/person-123')
    }
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'GDPR_EXPORT',
        resourceType: 'person',
        resourceId: 'person-123',
        sensitivity: 'FORTROLIG',
      })
    )
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)

    const result = await prepareGdprExport('person-123')
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser ikke-admin brugere', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)

    const result = await prepareGdprExport('person-123')
    expect(result).toEqual({ error: 'Kun admin kan håndtere GDPR-eksport' })
  })
})

describe('executeGdprDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sletter persondata og logger STRENGT_FORTROLIG audit-event ved happy path', async () => {
    const { recordAuditEvent } = await import('@/lib/audit')
    const result = await executeGdprDelete('person-123')

    expect('data' in result).toBe(true)
    if ('data' in result && result.data) {
      // summary: companyPersonsEnded=2 + ownershipsEnded=1 + contractPartiesDeleted=0 + casePersonsDeleted=0 = 3
      expect(result.data.total).toBe(3)
      expect(result.data.personUpdated).toBe(1)
    }
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'GDPR_DELETE',
        resourceType: 'person',
        resourceId: 'person-123',
        sensitivity: 'STRENGT_FORTROLIG',
      })
    )
  })

  it('returnerer fejl hvis person ikke findes', async () => {
    const gdpr = await import('@/lib/export/gdpr')
    vi.mocked(gdpr.gdprDeletePerson).mockResolvedValueOnce({
      deleted: false,
      summary: {
        personUpdated: 0,
        companyPersonsEnded: 0,
        ownershipsEnded: 0,
        contractPartiesDeleted: 0,
        casePersonsDeleted: 0,
      },
    })

    const result = await executeGdprDelete('missing-person')
    expect(result).toEqual({ error: 'Person ikke fundet' })
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)

    const result = await executeGdprDelete('person-123')
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })

  it('afviser ikke-admin brugere', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)

    const result = await executeGdprDelete('person-123')
    expect(result).toEqual({ error: 'Kun admin kan slette persondata' })
  })
})
