import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  detectFileType,
  isPdfEncrypted,
  loadForExtraction,
  ContentLoaderError,
} from '@/lib/ai/content-loader'

const FIXTURE_PATH = join(__dirname, '..', 'fixtures', 'test-contract.pdf')

describe('content-loader', () => {
  let pdfBuffer: Buffer

  beforeAll(() => {
    pdfBuffer = readFileSync(FIXTURE_PATH)
  })

  describe('detectFileType', () => {
    it('detects PDF via magic bytes', async () => {
      const result = await detectFileType(pdfBuffer)
      expect(result).toEqual({ ext: 'pdf', mime: 'application/pdf' })
    })

    it('returns null for unknown buffer', async () => {
      const garbage = Buffer.from('not a real file')
      const result = await detectFileType(garbage)
      expect(result).toBeNull()
    })
  })

  describe('isPdfEncrypted', () => {
    it('returns false for unencrypted PDF', async () => {
      const encrypted = await isPdfEncrypted(pdfBuffer)
      expect(encrypted).toBe(false)
    })
  })

  describe('loadForExtraction', () => {
    it('loads a PDF buffer and returns extraction content', async () => {
      const result = await loadForExtraction(pdfBuffer, 'test-contract.pdf')
      expect(result.type).toBe('pdf_binary')
      if (result.type !== 'pdf_binary') return
      expect(result.data).toEqual(pdfBuffer)
      expect(result.detectedMime).toBe('application/pdf')
    })

    it('throws ContentLoaderError for unsupported file types', async () => {
      const textBuffer = Buffer.from('plain text, not a supported file')
      await expect(loadForExtraction(textBuffer, 'note.txt')).rejects.toThrow(ContentLoaderError)
    })

    it('throws ContentLoaderError for files over 50 MB', async () => {
      const hugeBuffer = Buffer.alloc(51 * 1024 * 1024)
      await expect(loadForExtraction(hugeBuffer, 'huge.pdf')).rejects.toThrow(ContentLoaderError)
    })
  })
})
