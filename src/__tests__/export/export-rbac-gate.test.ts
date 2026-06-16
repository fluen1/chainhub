import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
const { permsMock } = vi.hoisted(() => ({
  permsMock: { canExportAllScope: vi.fn() },
}))
vi.mock('@/lib/permissions', () => permsMock)
vi.mock('@/lib/export/entities', () => ({
  fetchEntityForExport: vi.fn().mockResolvedValue({ filename: 'x', rows: [], columns: [] }),
}))
vi.mock('@/lib/export/csv', () => ({ toCsvBuffer: vi.fn().mockResolvedValue(Buffer.from('')) }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))

import { auth } from '@/lib/auth'
import { GET } from '@/app/api/export/[entity]/route'

const session = { user: { id: 'u1', organizationId: 'org-1' }, expires: '2099-01-01' }

describe('export-route — kun ALL-scope-admins', () => {
  beforeEach(() => vi.clearAllMocks())

  it('COMPANY_READONLY (ingen ALL-scope) → 403', async () => {
    vi.mocked(auth).mockResolvedValue(session as never)
    permsMock.canExportAllScope.mockResolvedValue(false)
    const res = await GET(new Request('http://x'), {
      params: Promise.resolve({ entity: 'contracts' }),
    })
    expect(res.status).toBe(403)
  })

  it('GROUP_OWNER (ALL-scope) → 200', async () => {
    vi.mocked(auth).mockResolvedValue(session as never)
    permsMock.canExportAllScope.mockResolvedValue(true)
    const res = await GET(new Request('http://x'), {
      params: Promise.resolve({ entity: 'contracts' }),
    })
    expect(res.status).toBe(200)
  })
})
