import { PDFDocument } from 'pdf-lib'
import { createLogger } from './logger'

const log = createLogger('content-loader')

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export type ExtractionContent = {
  type: 'pdf_binary'
  data: Buffer
  detectedMime: string
}

export class ContentLoaderError extends Error {
  constructor(
    message: string,
    public readonly reason: 'unsupported_type' | 'file_too_large' | 'encrypted_pdf' | 'corrupt_file',
  ) {
    super(message)
    this.name = 'ContentLoaderError'
  }
}

export async function detectFileType(buffer: Buffer): Promise<{ ext: string; mime: string } | null> {
  const { fileTypeFromBuffer } = await import('file-type')
  // file-type requires a true Uint8Array — Buffer may be treated as plain object in jsdom
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const type = await fileTypeFromBuffer(uint8)
  if (!type) return null
  return { ext: type.ext, mime: type.mime }
}

export async function isPdfEncrypted(buffer: Buffer): Promise<boolean> {
  // pdf-lib requires Uint8Array — coerce Buffer to ensure compatibility
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  try {
    await PDFDocument.load(uint8, { ignoreEncryption: false })
    return false
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('encrypted')) return true
    throw err
  }
}

export async function loadForExtraction(
  buffer: Buffer,
  filename: string,
): Promise<ExtractionContent> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ContentLoaderError(
      `File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE_BYTES})`,
      'file_too_large',
    )
  }

  const type = await detectFileType(buffer)
  if (!type) {
    throw new ContentLoaderError(`Could not detect file type for ${filename}`, 'unsupported_type')
  }

  log.debug({ filename, detected_ext: type.ext, size: buffer.length }, 'File detected')

  if (type.ext === 'pdf') {
    try {
      const encrypted = await isPdfEncrypted(buffer)
      if (encrypted) {
        throw new ContentLoaderError(`PDF is password-protected: ${filename}`, 'encrypted_pdf')
      }
    } catch (err) {
      if (err instanceof ContentLoaderError) throw err
      throw new ContentLoaderError(
        `Failed to parse PDF ${filename}: ${err instanceof Error ? err.message : 'unknown'}`,
        'corrupt_file',
      )
    }
    return { type: 'pdf_binary', data: buffer, detectedMime: type.mime }
  }

  throw new ContentLoaderError(
    `Unsupported file type: ${type.ext}. Only PDF supported in v1.`,
    'unsupported_type',
  )
}
