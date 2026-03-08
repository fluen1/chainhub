import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

// Accepterede filtyper
export const ACCEPTED_FILE_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
} as const

export type AcceptedMimeType = keyof typeof ACCEPTED_FILE_TYPES

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

export const ACCEPTED_MIME_TYPES = Object.keys(ACCEPTED_FILE_TYPES) as AcceptedMimeType[]

/**
 * Tjekker om Cloudflare R2 er konfigureret
 */
export function isStorageConfigured(): boolean {
  return !!(
    process.env.R2_BUCKET_NAME &&
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  )
}

/**
 * Vejledning til konfiguration af R2
 */
export function getStorageConfigurationGuide(): string {
  return `Cloudflare R2 er ikke konfigureret. Tilføj følgende miljøvariabler:
  R2_BUCKET_NAME, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY`
}

/**
 * Opretter S3-kompatibel klient til Cloudflare R2
 */
function createR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID!
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

/**
 * Genererer en unik filsti i R2
 * Format: {orgId}/{resourceType}/{resourceId}/{uuid}-{fileName}
 */
export function generateStoragePath(
  organizationId: string,
  resourceType: string,
  resourceId: string,
  fileName: string
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const uniqueId = uuidv4()
  return `${organizationId}/${resourceType}/${resourceId}/${uniqueId}-${safeFileName}`
}

/**
 * Genererer en signeret upload-URL (PUT) — gyldig i 15 minutter
 */
export async function getSignedUploadUrl(
  fileKey: string,
  contentType: string
): Promise<{ uploadUrl: string; fileUrl: string }> {
  if (!isStorageConfigured()) {
    throw new Error('Storage er ikke konfigureret')
  }

  const client = createR2Client()
  const bucketName = process.env.R2_BUCKET_NAME!

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 }) // 15 min
  const fileUrl = `r2://${fileKey}`

  return { uploadUrl, fileUrl }
}

/**
 * Genererer en signeret download-URL (GET) — gyldig i 1 time
 */
export async function getSignedDownloadUrl(
  fileKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error('Storage er ikke konfigureret')
  }

  const client = createR2Client()
  const bucketName = process.env.R2_BUCKET_NAME!

  // Fjern evt. r2:// prefix
  const cleanKey = fileKey.replace(/^r2:\/\//, '')

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
  })

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds })
}

/**
 * Sletter en fil fra R2
 */
export async function deleteStorageFile(fileKey: string): Promise<void> {
  if (!isStorageConfigured()) {
    throw new Error('Storage er ikke konfigureret')
  }

  const client = createR2Client()
  const bucketName = process.env.R2_BUCKET_NAME!

  const cleanKey = fileKey.replace(/^r2:\/\//, '')

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
  })

  await client.send(command)
}

/**
 * Validerer filtype og størrelse
 */
export function validateFile(
  fileName: string,
  mimeType: string,
  fileSizeBytes: number
): { valid: boolean; error?: string } {
  if (!ACCEPTED_MIME_TYPES.includes(mimeType as AcceptedMimeType)) {
    return {
      valid: false,
      error: `Filtypen "${mimeType}" er ikke tilladt. Accepterede typer: PDF, DOCX, XLSX, PNG, JPG`,
    }
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    const sizeMB = Math.round(fileSizeBytes / 1024 / 1024)
    return {
      valid: false,
      error: `Filen er for stor (${sizeMB}MB). Maksimum er 50MB`,
    }
  }

  if (!fileName || fileName.trim().length === 0) {
    return {
      valid: false,
      error: 'Filnavn mangler',
    }
  }

  return { valid: true }
}