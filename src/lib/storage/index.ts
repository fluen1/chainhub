import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Tjek om R2 er konfigureret
export const isStorageConfigured = Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME
)

// S3-kompatibel client til Cloudflare R2
const s3Client = isStorageConfigured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || ''

// Tilladte filtyper
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'image/png',
  'image/jpeg',
] as const

// Filtype til extension mapping
export const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

// Extension til MIME mapping
export const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

// Max filstørrelse: 50MB
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

/**
 * Generér en unik storage-sti til en fil
 */
export function generateStoragePath(
  organizationId: string,
  entityType: 'document' | 'contract-version' | 'contract-attachment',
  entityId: string,
  fileName: string
): string {
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${organizationId}/${entityType}/${entityId}/${timestamp}-${sanitizedFileName}`
}

/**
 * Generer signeret upload URL (PUT)
 */
export async function getSignedUploadUrl(
  storagePath: string,
  contentType: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (!s3Client) {
    throw new Error('Storage er ikke konfigureret')
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storagePath,
    ContentType: contentType,
  })

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
}

/**
 * Generer signeret download URL (GET)
 */
export async function getSignedDownloadUrl(
  storagePath: string,
  expiresInSeconds: number = 3600,
  downloadFileName?: string
): Promise<string> {
  if (!s3Client) {
    throw new Error('Storage er ikke konfigureret')
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storagePath,
    ...(downloadFileName && {
      ResponseContentDisposition: `attachment; filename="${downloadFileName}"`,
    }),
  })

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
}

/**
 * Slet fil fra storage
 */
export async function deleteFile(storagePath: string): Promise<void> {
  if (!s3Client) {
    throw new Error('Storage er ikke konfigureret')
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storagePath,
  })

  await s3Client.send(command)
}

/**
 * Validér filtype
 */
export function isAllowedFileType(mimeType: string): boolean {
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(mimeType)
}

/**
 * Hent file extension fra filnavn
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

/**
 * Tjek om fil er previewable (PDF eller billede)
 */
export function isPreviewable(mimeType: string): boolean {
  return (
    mimeType === 'application/pdf' ||
    mimeType === 'image/png' ||
    mimeType === 'image/jpeg'
  )
}