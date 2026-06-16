import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth + prisma + storage + queue + audit + file-type — vi tester kun MIME-logikken
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

// file-type er ESM-only — mock den så vi kan styre hvad den returnerer per test
let mockFileType: { mime: string; ext: string } | undefined
vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn().mockImplementation(async () => mockFileType),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    document: { create: vi.fn() },
    case: { findFirst: vi.fn() },
    contract: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/storage', () => ({
  getStorageProvider: vi.fn(() => ({
    upload: vi.fn().mockResolvedValue(undefined),
    getDownloadUrl: vi.fn().mockResolvedValue('https://example.com/file'),
  })),
}))
vi.mock('@/lib/ai/queue', () => ({
  createQueue: vi.fn(),
  JOB_NAMES: { EXTRACT_DOCUMENT: 'extract_document' },
}))
vi.mock('@/lib/ai/feature-flags', () => ({ isAIEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/permissions', () => ({ canAccessCompany: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/ai/rate-limit', () => ({
  checkUploadRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))
vi.mock('@/lib/ai/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  })),
}))

import { POST } from '@/app/api/upload/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

const SESSION = {
  user: { id: 'user-1', organizationId: 'org-1' },
}

function makePdfBytes(): Uint8Array {
  // Ægte PDF magic bytes: %PDF-
  return new TextEncoder().encode('%PDF-1.4 fake content')
}

function makeExeBytes(): Uint8Array {
  // Windows PE executable magic bytes: MZ (0x4D 0x5A)
  return new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
}

function makeDocxBytes(): Uint8Array {
  // DOCX er ZIP: magic bytes PK (0x50 0x4B 0x03 0x04)
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])
}

// Laver en NextRequest der mock-resolver formData uden at bruge Blob/File i node-miljø
function makeRequest(bytes: Uint8Array, claimedMime: string, filename: string): NextRequest {
  // Kopier til en ny ArrayBuffer for at undgå shared-buffer issues
  const arraybuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const mockFile = {
    name: filename,
    type: claimedMime,
    size: bytes.length,
    arrayBuffer: () => Promise.resolve(arraybuf),
  }

  const mockFormData = {
    get: (key: string) => {
      if (key === 'file') return mockFile
      return null
    },
  }

  const req = {
    formData: () => Promise.resolve(mockFormData),
  } as unknown as NextRequest

  return req
}

describe('POST /api/upload — magic-bytes-validering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(SESSION as never)
    vi.mocked(prisma.document.create).mockResolvedValue({ id: 'doc-1' } as never)
    mockFileType = undefined
  })

  it('accepterer en ægte PDF-fil (magic bytes %PDF-)', async () => {
    mockFileType = { mime: 'application/pdf', ext: 'pdf' }
    const req = makeRequest(makePdfBytes(), 'application/pdf', 'kontrakt.pdf')
    const res = await POST(req)
    expect(res.status).not.toBe(400)
  })

  it('afviser .exe maskeret som PDF — magic bytes MZ afvises selv med Content-Type application/pdf', async () => {
    mockFileType = { mime: 'application/x-msdownload', ext: 'exe' }
    const req = makeRequest(makeExeBytes(), 'application/pdf', 'malware.pdf')
    const res = await POST(req)
    const body = (await res.json()) as { error: string }
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/filtype|magic/i)
  })

  it('accepterer ægte DOCX-fil (ZIP magic bytes)', async () => {
    // DOCX er ZIP-baseret — file-type returnerer application/zip for DOCX-filer
    // Routen accepterer zip-base hvis claimed MIME er et Office-format
    mockFileType = { mime: 'application/zip', ext: 'zip' }
    const req = makeRequest(
      makeDocxBytes(),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'aftale.docx'
    )
    const res = await POST(req)
    expect(res.status).not.toBe(400)
  })

  it('afviser en fil hvor MIME og magic bytes ikke stemmer overens (exe med docx-MIME)', async () => {
    mockFileType = { mime: 'application/x-msdownload', ext: 'exe' }
    const req = makeRequest(
      makeExeBytes(),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'malware.docx'
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
