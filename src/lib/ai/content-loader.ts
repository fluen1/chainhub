import { PDFDocument } from 'pdf-lib'
import { createLogger } from './logger'

const log = createLogger('content-loader')

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export type ExtractionContent =
  | { type: 'pdf_binary'; data: Buffer; detectedMime: string }
  | { type: 'text_html'; html: string; detectedMime: string }
  | { type: 'text_markdown'; markdown: string; detectedMime: string }

export class ContentLoaderError extends Error {
  constructor(
    message: string,
    public readonly reason: 'unsupported_type' | 'file_too_large' | 'encrypted_pdf' | 'corrupt_file'
  ) {
    super(message)
    this.name = 'ContentLoaderError'
  }
}

export async function detectFileType(
  buffer: Buffer
): Promise<{ ext: string; mime: string } | null> {
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
  filename: string
): Promise<ExtractionContent> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ContentLoaderError(
      `File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE_BYTES})`,
      'file_too_large'
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
        'corrupt_file'
      )
    }
    return { type: 'pdf_binary', data: buffer, detectedMime: type.mime }
  }

  if (type.ext === 'docx') {
    const mammoth = await import('mammoth')
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    // mammoth's types expect Buffer but accepts Uint8Array at runtime — cast to satisfy TS
    const result = await mammoth.convertToHtml({ buffer: uint8 as unknown as Buffer })
    log.debug({ filename, html_length: result.value.length }, 'Word converted to HTML')
    return { type: 'text_html', html: result.value, detectedMime: type.mime }
  }

  if (type.ext === 'xlsx') {
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.default.Workbook()
    // exceljs load() accepts ArrayBuffer | Buffer — cast to satisfy strict TS
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
    let markdown = ''
    wb.eachSheet((sheet) => {
      markdown += `## ${sheet.name}\n\n`
      const rows: string[][] = []
      sheet.eachRow((row) => {
        const values = (row.values as (string | number | null)[]).slice(1)
        rows.push(values.map((v) => String(v ?? '')))
      })
      if (rows.length > 0) {
        markdown += '| ' + rows[0].join(' | ') + ' |\n'
        markdown += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n'
        for (let i = 1; i < rows.length; i++) {
          markdown += '| ' + rows[i].join(' | ') + ' |\n'
        }
      }
      markdown += '\n'
    })
    log.debug({ filename, markdown_length: markdown.length }, 'Excel converted to Markdown')
    return { type: 'text_markdown', markdown, detectedMime: type.mime }
  }

  throw new ContentLoaderError(
    `Unsupported file type: ${type.ext}. Supported: pdf, docx, xlsx.`,
    'unsupported_type'
  )
}
