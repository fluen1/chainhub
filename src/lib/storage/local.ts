import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { dirname, join } from 'path'
import { createLogger } from '@/lib/logger'
import type { StorageProvider, UploadInput } from './types'

const log = createLogger('storage-local')

/**
 * Filesystem-baseret storage — bruges til dev/test.
 *
 * Gemmer filer i `{rootDir}/{key}` hvor `rootDir` default er
 * `process.cwd()/uploads`.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly providerName = 'local' as const
  private readonly root: string

  constructor(rootDir: string = join(process.cwd(), 'uploads')) {
    this.root = rootDir
  }

  private resolvePath(key: string): string {
    // Sanitize — block path traversal
    if (key.includes('..')) throw new Error('Invalid storage key')
    return join(this.root, key)
  }

  async upload(input: UploadInput): Promise<void> {
    const path = this.resolvePath(input.key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, input.buffer)
    log.debug({ key: input.key, size: input.buffer.length }, 'Uploaded to local storage')
  }

  async download(key: string): Promise<Buffer | null> {
    try {
      const path = this.resolvePath(key)
      return await readFile(path)
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'ENOENT'
      ) {
        return null
      }
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(key))
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code !== 'ENOENT'
      ) {
        throw err
      }
      // ENOENT = already gone, ok
    }
  }

  async getDownloadUrl(key: string): Promise<string> {
    // Local: route via API download-endpoint, som streamer via download()
    return `/api/uploads/${key.split('/').map(encodeURIComponent).join('/')}`
  }
}
