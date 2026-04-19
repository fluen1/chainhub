import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { LocalStorageProvider } from '@/lib/storage/local'

let tempRoot: string
let provider: LocalStorageProvider

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), 'chainhub-storage-test-'))
  provider = new LocalStorageProvider(tempRoot)
})

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true })
})

describe('LocalStorageProvider', () => {
  it('upload + download roundtrip', async () => {
    const buffer = Buffer.from('hello world', 'utf-8')
    await provider.upload({ key: 'org-1/doc-1/file.txt', buffer, contentType: 'text/plain' })
    const result = await provider.download('org-1/doc-1/file.txt')
    expect(result).not.toBeNull()
    expect(result!.toString('utf-8')).toBe('hello world')
  })

  it('download returnerer null for ukendt key', async () => {
    const result = await provider.download('ikke-her')
    expect(result).toBeNull()
  })

  it('delete fjerner filen', async () => {
    await provider.upload({ key: 'test', buffer: Buffer.from('x'), contentType: 'text/plain' })
    await provider.delete('test')
    expect(await provider.download('test')).toBeNull()
  })

  it('delete på ukendt key er no-op', async () => {
    await expect(provider.delete('ukendt')).resolves.toBeUndefined()
  })

  it('afviser path-traversal', async () => {
    await expect(
      provider.upload({
        key: '../evil',
        buffer: Buffer.from('x'),
        contentType: 'text/plain',
      })
    ).rejects.toThrow(/Invalid/)
  })

  it('getDownloadUrl returnerer API-sti', async () => {
    const url = await provider.getDownloadUrl('org-1/doc-1/my file.pdf')
    expect(url).toBe('/api/uploads/org-1/doc-1/my%20file.pdf')
  })
})
