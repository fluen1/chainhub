import { describe, it, expect, vi, beforeEach } from 'vitest'

const findUniqueMock = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    document: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
  },
}))

const extractDocumentMock = vi.fn()
vi.mock('@/lib/ai/jobs/extract-document', () => ({
  extractDocument: (...args: unknown[]) => extractDocumentMock(...args),
}))

const downloadMock = vi.fn()
vi.mock('@/lib/storage', () => ({
  getStorageProvider: () => ({ download: (...args: unknown[]) => downloadMock(...args) }),
}))

vi.mock('@/lib/ai/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { extractDocumentById } from '@/lib/ai/jobs/extract-document-by-id'

const SUCCESS_RESULT = {
  extraction_id: 'e1',
  detected_type: 'lejekontrakt',
  field_count: 3,
  total_cost_usd: 0.02,
  skipped: false,
  status: 'success' as const,
}

describe('extractDocumentById', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    extractDocumentMock.mockReset().mockResolvedValue(SUCCESS_RESULT)
    downloadMock.mockReset()
  })

  it('henter buffer via storage.download(rekonstrueret key) og kalder extractDocument', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'doc-123',
      organization_id: 'org-9',
      file_name: 'Min Lejekontrakt.pdf',
      deleted_at: null,
    })
    const buffer = Buffer.from('PDF-bytes')
    downloadMock.mockResolvedValue(buffer)

    const result = await extractDocumentById('doc-123')

    // Key rekonstrueres NØJAGTIGT som upload-ruten: org/doc/sanitized-filnavn.
    // Mellemrum bliver til _ via sanitize-regex.
    expect(downloadMock).toHaveBeenCalledWith('org-9/doc-123/Min_Lejekontrakt.pdf')

    expect(extractDocumentMock).toHaveBeenCalledWith({
      document_id: 'doc-123',
      organization_id: 'org-9',
      file_buffer_base64: buffer.toString('base64'),
      filename: 'Min Lejekontrakt.pdf',
    })
    expect(result).toEqual(SUCCESS_RESULT)
  })

  it('kaster hvis dokumentet ikke findes', async () => {
    findUniqueMock.mockResolvedValue(null)
    await expect(extractDocumentById('mangler')).rejects.toThrow(/ikke fundet/)
    expect(extractDocumentMock).not.toHaveBeenCalled()
  })

  it('kaster hvis dokumentet er soft-deleted', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'doc-1',
      organization_id: 'org-1',
      file_name: 'x.pdf',
      deleted_at: new Date(),
    })
    await expect(extractDocumentById('doc-1')).rejects.toThrow(/slettet/)
    expect(extractDocumentMock).not.toHaveBeenCalled()
  })

  it('kaster hvis filen ikke findes i storage', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'doc-1',
      organization_id: 'org-1',
      file_name: 'x.pdf',
      deleted_at: null,
    })
    downloadMock.mockResolvedValue(null)
    await expect(extractDocumentById('doc-1')).rejects.toThrow(/ikke fundet i storage/)
    expect(extractDocumentMock).not.toHaveBeenCalled()
  })
})
