/**
 * Storage-abstraktion: typer.
 *
 * Alle providers (local, R2, evt. andre S3-kompatible) skal implementere
 * {@link StorageProvider}. Factory i `./index.ts` vælger provider baseret
 * på env var STORAGE_PROVIDER.
 */

export interface StorageKey {
  /** Full path/key inden for bucket. Eks: 'org-uuid/doc-uuid/filename.pdf' */
  key: string
}

export interface UploadInput extends StorageKey {
  buffer: Buffer
  contentType: string
}

export interface StorageProvider {
  readonly providerName: 'local' | 'r2'

  /** Gem fil. Idempotent: overwrites hvis key eksisterer. */
  upload(input: UploadInput): Promise<void>

  /** Læs fil som Buffer. Returnerer null hvis ikke fundet. */
  download(key: string): Promise<Buffer | null>

  /** Slet fil. No-op hvis ikke fundet. */
  delete(key: string): Promise<void>

  /**
   * Returnerer en URL brugeren kan downloade direkte fra.
   * For local: relative URL til /api/uploads/[...path] (der streamer via download())
   * For R2: presigned URL direct til R2 (expires om 1 time)
   */
  getDownloadUrl(key: string): Promise<string>
}
