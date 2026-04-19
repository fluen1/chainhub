import { LocalStorageProvider } from './local'
import { R2StorageProvider } from './r2'
import type { StorageProvider } from './types'

let singletonInstance: StorageProvider | null = null

/**
 * Factory — returnerer singleton storage-provider baseret på env var.
 *
 * STORAGE_PROVIDER=local (default) → LocalStorageProvider (filesystem)
 * STORAGE_PROVIDER=r2              → R2StorageProvider (kræver R2_* vars)
 */
export function getStorageProvider(): StorageProvider {
  if (singletonInstance) return singletonInstance

  const providerName = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase()

  if (providerName === 'r2') {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucket = process.env.R2_BUCKET
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('R2 storage valgt men R2_* env vars mangler')
    }
    singletonInstance = new R2StorageProvider({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
    })
  } else {
    singletonInstance = new LocalStorageProvider()
  }

  return singletonInstance
}

// Re-export types
export type { StorageProvider, UploadInput } from './types'
