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
vi.mock('@/lib/export/gdpr', () => ({
  gdprDeletePerson: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { recordAuditEvent } from '@/lib/audit'
import { gdprDeletePerson } from '@/lib/export/gdpr'
import { prepareGdprExport, executeGdprDelete } from '@/actions/gdpr'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

function makeSession() {
  return {
    user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
    expires: '',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(recordAuditEvent).mockResolvedValue(undefined)
})

describe('prepareGdprExport', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await prepareGdprExport(VALID_UUID)
    expect(result).toMatchObject({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl ved ugyldigt UUID', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    const result = await prepareGdprExport('ikke-et-uuid')
    expect(result).toMatchObject({ error: 'Ugyldigt input' })
  })

  it('returnerer fejl uden settings-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await prepareGdprExport(VALID_UUID)
    expect(result).toMatchObject({ error: 'Kun admin kan håndtere GDPR-eksport' })
  })

  it('returnerer download-URL (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)

    const result = await prepareGdprExport(VALID_UUID)

    expect(result).toMatchObject({ data: { downloadUrl: `/api/export/gdpr/${VALID_UUID}` } })
    expect(recordAuditEvent).toHaveBeenCalledOnce()
  })

  it('returnerer fejl hvis audit-log kaster', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(recordAuditEvent).mockRejectedValue(new Error('fejl'))

    const result = await prepareGdprExport(VALID_UUID)
    expect(result).toMatchObject({ error: 'GDPR-eksport kunne ikke forberedes' })
  })
})

describe('executeGdprDelete', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await executeGdprDelete(VALID_UUID)
    expect(result).toMatchObject({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl ved ugyldigt UUID', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    const result = await executeGdprDelete('ikke-et-uuid')
    expect(result).toMatchObject({ error: 'Ugyldigt input' })
  })

  it('returnerer fejl uden admin-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await executeGdprDelete(VALID_UUID)
    expect(result).toMatchObject({ error: 'Kun admin kan slette persondata' })
  })

  it('returnerer fejl hvis person ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(gdprDeletePerson).mockResolvedValue({
      deleted: false,
      summary: {
        personUpdated: 0,
        companyPersonsEnded: 0,
        ownershipsEnded: 0,
        contractPartiesDeleted: 0,
        casePersonsDeleted: 0,
      },
    })

    const result = await executeGdprDelete(VALID_UUID)
    expect(result).toMatchObject({ error: 'Person ikke fundet' })
  })

  it('sletter person og returnerer summary (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(gdprDeletePerson).mockResolvedValue({
      deleted: true,
      summary: {
        personUpdated: 1,
        companyPersonsEnded: 2,
        ownershipsEnded: 1,
        contractPartiesDeleted: 3,
        casePersonsDeleted: 1,
      },
    })

    const result = await executeGdprDelete(VALID_UUID)

    expect(result).toMatchObject({ data: { personUpdated: 1, total: 7 } })
    expect(recordAuditEvent).toHaveBeenCalledOnce()
  })

  it('returnerer fejl hvis gdprDeletePerson kaster', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(gdprDeletePerson).mockRejectedValue(new Error('DB fejl'))

    const result = await executeGdprDelete(VALID_UUID)
    expect(result).toMatchObject({ error: 'GDPR-sletning fejlede' })
  })
})
