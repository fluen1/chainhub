/**
 * Phase A audit-fixes — API sikkerhed (Fase A #7-10)
 * Fix 7: upload/route.ts — caseId/contractId tenant-verifikation + audit
 * Fix 8: daily-digest/route.ts — timing-safe secret + generisk fejlbesked
 * Fix 9: export/[entity]/route.ts — audit + RFC 5987 Content-Disposition
 * Fix 10: export/gdpr/[personId]/route.ts — UUID-validering + audit + RFC 5987
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Helper: læs fil relativt til projektroden
function readSrc(path: string): string {
  return readFileSync(join(process.cwd(), 'src', path), 'utf-8')
}

// ─────────────────────────────────────────────────────────
// FÆLLES MOCKS
// ─────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: 'user-1',
      organizationId: 'org-1',
    },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    case: {
      findFirst: vi.fn(),
    },
    contract: {
      findFirst: vi.fn(),
    },
    document: {
      create: vi.fn().mockResolvedValue({ id: 'doc-1' }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue([]),
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

vi.mock('@/lib/storage', () => ({
  getStorageProvider: vi.fn(() => ({
    upload: vi.fn().mockResolvedValue(undefined),
    getDownloadUrl: vi.fn().mockResolvedValue('https://example.com/file.pdf'),
  })),
}))

vi.mock('@/lib/ai/queue', () => ({
  createQueue: vi.fn().mockRejectedValue(new Error('queue disabled in test')),
  JOB_NAMES: { EXTRACT_DOCUMENT: 'extract-document' },
}))

vi.mock('@/lib/ai/rate-limit', () => ({
  checkUploadRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock('@/lib/email/resend', () => ({
  resend: null,
  DIGEST_FROM: 'test@chainhub.dk',
}))

vi.mock('@/lib/notifications/deadlines', () => ({
  getOverdueTasks: vi.fn().mockResolvedValue([]),
  getUpcomingTasks: vi.fn().mockResolvedValue([]),
  getExpiringContracts: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/email/templates/digest', () => ({
  buildDigestHtml: vi.fn().mockReturnValue('<html>test</html>'),
  buildDigestSubject: vi.fn().mockReturnValue('Test digest'),
}))

vi.mock('@/lib/export/entities', () => ({
  fetchEntityForExport: vi.fn().mockResolvedValue({
    filename: 'selskaber-2026-05-14',
    rows: [],
    columns: [],
  }),
}))

vi.mock('@/lib/export/csv', () => ({
  toCsvBuffer: vi.fn().mockResolvedValue(Buffer.from('id,name')),
}))

vi.mock('@/lib/export/gdpr', () => ({
  gdprExportPerson: vi.fn().mockResolvedValue({
    person: { id: 'person-1', first_name: 'Test', last_name: 'Person' },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ─────────────────────────────────────────────────────────
// Fix 7: upload/route.ts — caseId/contractId tenant-verifikation (kode-analyse)
// Upload-routes testes via kode-analyse da FormData/File kræver browser-runtime
// ─────────────────────────────────────────────────────────

describe('upload/route.ts — kode indeholder tenant-verifikation', () => {
  it('upload-route verificerer caseId mod organisationen', () => {
    const src = readSrc('app/api/upload/route.ts')
    // Tjek at vi laver findFirst med organization_id på case
    expect(src).toContain('prisma.case.findFirst')
    expect(src).toContain('organization_id: session.user.organizationId')
    expect(src).toContain("'Sag ikke fundet'")
  })

  it('upload-route verificerer contractId mod organisationen', () => {
    const src = readSrc('app/api/upload/route.ts')
    expect(src).toContain('prisma.contract.findFirst')
    expect(src).toContain("'Kontrakt ikke fundet'")
  })

  it('upload-route kalder recordAuditEvent med UPLOAD action', () => {
    const src = readSrc('app/api/upload/route.ts')
    expect(src).toContain('recordAuditEvent')
    expect(src).toContain("action: 'UPLOAD'")
    expect(src).toContain("sensitivity: 'INTERN'")
  })

  it('upload-route saniterer filnavn i storage-key', () => {
    const src = readSrc('app/api/upload/route.ts')
    // Filnavnet saniteres — ikke brugt rå i storage-key
    expect(src).toContain('sanitizedFileName')
    expect(src).toContain('replace(')
  })
})

// ─────────────────────────────────────────────────────────
// Fix 8: daily-digest/route.ts — timing-safe secret
// ─────────────────────────────────────────────────────────

describe('daily-digest/route.ts — timing-safe secret comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DIGEST_CRON_SECRET = 'test-secret-abc123'
  })

  it('returnerer 401 uden Authorization header', async () => {
    const { POST } = await import('@/app/api/cron/daily-digest/route')
    const request = new Request('http://localhost/api/cron/daily-digest', { method: 'POST' })
    const response = await POST(request as never)
    expect(response.status).toBe(401)
  })

  it('returnerer 401 med forkert secret', async () => {
    const { POST } = await import('@/app/api/cron/daily-digest/route')
    const request = new Request('http://localhost/api/cron/daily-digest', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const response = await POST(request as never)
    expect(response.status).toBe(401)
  })

  it('returnerer 401 med secret af anden længde (length-mismatch guard)', async () => {
    const { POST } = await import('@/app/api/cron/daily-digest/route')
    const request = new Request('http://localhost/api/cron/daily-digest', {
      method: 'POST',
      headers: { Authorization: 'Bearer short' },
    })
    const response = await POST(request as never)
    expect(response.status).toBe(401)
  })

  it('returnerer 500 når RESEND_API_KEY ikke er konfigureret (resend=null)', async () => {
    const { POST } = await import('@/app/api/cron/daily-digest/route')
    const request = new Request('http://localhost/api/cron/daily-digest', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret-abc123' },
    })
    const response = await POST(request as never)
    // resend er null i mocks → returnerer 500
    expect(response.status).toBe(500)
  })
})

// ─────────────────────────────────────────────────────────
// Fix 9: export/[entity]/route.ts — audit + RFC 5987
// ─────────────────────────────────────────────────────────

describe('export/[entity]/route.ts — audit og RFC 5987 Content-Disposition', () => {
  beforeEach(() => vi.clearAllMocks())

  it('logger audit-event FØR eksport', async () => {
    const audit = await import('@/lib/audit')
    const { GET } = await import('@/app/api/export/[entity]/route')
    const request = new Request('http://localhost/api/export/companies')
    await GET(request, { params: Promise.resolve({ entity: 'companies' }) })

    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPORT',
        resourceType: 'EXPORT',
        sensitivity: 'FORTROLIG',
        changes: { entity: 'companies' },
      })
    )
  })

  it('returnerer RFC 5987 Content-Disposition header', async () => {
    const { GET } = await import('@/app/api/export/[entity]/route')
    const request = new Request('http://localhost/api/export/companies')
    const response = await GET(request, { params: Promise.resolve({ entity: 'companies' }) })

    const disposition = response.headers.get('Content-Disposition') ?? ''
    // Skal indeholde både legacy filename og RFC 5987 filename*
    expect(disposition).toContain('filename=')
    expect(disposition).toContain("filename*=UTF-8''")
  })

  it('returnerer 400 for ugyldig entity', async () => {
    const { GET } = await import('@/app/api/export/[entity]/route')
    const request = new Request('http://localhost/api/export/invalid')
    const response = await GET(request, { params: Promise.resolve({ entity: 'invalid' }) })
    expect(response.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────
// Fix 10: export/gdpr/[personId]/route.ts — UUID-validering + audit + RFC 5987
// ─────────────────────────────────────────────────────────

describe('export/gdpr/[personId]/route.ts — UUID-validering og audit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer 400 for ikke-UUID personId', async () => {
    const { GET } = await import('@/app/api/export/gdpr/[personId]/route')
    const request = new Request('http://localhost/api/export/gdpr/not-a-uuid')
    const response = await GET(request as never, {
      params: Promise.resolve({ personId: 'not-a-uuid' }),
    })
    expect(response.status).toBe(400)
  })

  it('returnerer 400 for SQL injection forsøg i personId', async () => {
    const { GET } = await import('@/app/api/export/gdpr/[personId]/route')
    const request = new Request("http://localhost/api/export/gdpr/'; DROP TABLE persons; --")
    const response = await GET(request as never, {
      params: Promise.resolve({ personId: "'; DROP TABLE persons; --" }),
    })
    expect(response.status).toBe(400)
  })

  it('logger audit-event FØR data returneres', async () => {
    const audit = await import('@/lib/audit')
    const validUuid = 'a1b2c3d4-e5f6-4789-9abc-def012345678'
    const { GET } = await import('@/app/api/export/gdpr/[personId]/route')
    const request = new Request(`http://localhost/api/export/gdpr/${validUuid}`)
    await GET(request as never, { params: Promise.resolve({ personId: validUuid }) })

    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GDPR_EXPORT',
        resourceType: 'PERSON',
        resourceId: validUuid,
        sensitivity: 'FORTROLIG',
      })
    )
  })

  it('returnerer RFC 5987 Content-Disposition header', async () => {
    const validUuid = 'a1b2c3d4-e5f6-4789-9abc-def012345678'
    const { GET } = await import('@/app/api/export/gdpr/[personId]/route')
    const request = new Request(`http://localhost/api/export/gdpr/${validUuid}`)
    const response = await GET(request as never, {
      params: Promise.resolve({ personId: validUuid }),
    })

    const disposition = response.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('filename=')
    expect(disposition).toContain("filename*=UTF-8''")
  })

  it('accepterer valid UUID og returnerer 200', async () => {
    const validUuid = 'a1b2c3d4-e5f6-4789-9abc-def012345678'
    const { GET } = await import('@/app/api/export/gdpr/[personId]/route')
    const request = new Request(`http://localhost/api/export/gdpr/${validUuid}`)
    const response = await GET(request as never, {
      params: Promise.resolve({ personId: validUuid }),
    })
    expect(response.status).toBe(200)
  })
})
