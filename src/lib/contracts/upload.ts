/**
 * File upload placeholder for Cloudflare R2
 * 
 * KONFIGURATION PÅKRÆVET:
 * 1. Opret en R2 bucket i Cloudflare Dashboard
 * 2. Generer R2 API tokens med read/write adgang
 * 3. Tilføj følgende environment variables:
 *    - R2_BUCKET_NAME: Dit bucket navn
 *    - R2_ACCOUNT_ID: Din Cloudflare account ID
 *    - R2_ACCESS_KEY_ID: R2 API access key
 *    - R2_SECRET_ACCESS_KEY: R2 API secret key
 *    - R2_PUBLIC_URL: (valgfrit) Custom domain for public access
 */

export interface FileUploadConfig {
  bucketName: string
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  publicUrl?: string
}

export interface UploadedFile {
  fileUrl: string
  fileName: string
  fileSizeBytes: number
  fileType: string
}

export interface UploadError {
  error: string
  code: 'CONFIG_MISSING' | 'UPLOAD_FAILED' | 'FILE_TOO_LARGE' | 'INVALID_TYPE'
}

const MAX_FILE_SIZE_MB = 50
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]

/**
 * Tjekker om R2 er konfigureret
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_BUCKET_NAME &&
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  )
}

/**
 * Returnerer konfigurationsvejledning hvis R2 ikke er sat op
 */
export function getR2ConfigurationGuide(): string {
  return `
Cloudflare R2 er ikke konfigureret.

For at aktivere fil-upload, tilføj følgende til din .env fil:

R2_BUCKET_NAME=dit-bucket-navn
R2_ACCOUNT_ID=din-cloudflare-account-id
R2_ACCESS_KEY_ID=din-r2-access-key
R2_SECRET_ACCESS_KEY=din-r2-secret-key
R2_PUBLIC_URL=https://files.din-domain.dk (valgfrit)

Se Cloudflare R2 dokumentation for opsætningsvejledning:
https://developers.cloudflare.com/r2/
  `.trim()
}

/**
 * Validerer en fil før upload
 */
export function validateFile(
  file: File
): { valid: true } | { valid: false; error: UploadError } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: {
        error: `Filen er for stor. Maksimum er ${MAX_FILE_SIZE_MB} MB`,
        code: 'FILE_TOO_LARGE',
      },
    }
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: {
        error: 'Filtypen er ikke understøttet. Tilladte typer: PDF, Word, Excel, PNG, JPEG',
        code: 'INVALID_TYPE',
      },
    }
  }

  return { valid: true }
}

/**
 * Genererer en unik filsti til R2
 */
export function generateFilePath(
  organizationId: string,
  contractId: string,
  fileName: string,
  isVersion: boolean = true
): string {
  const timestamp = Date.now()
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  const folder = isVersion ? 'versions' : 'attachments'
  
  return `${organizationId}/contracts/${contractId}/${folder}/${timestamp}_${sanitizedName}`
}

/**
 * Placeholder upload funktion
 * Returnerer fejl med vejledning hvis R2 ikke er konfigureret
 */
export async function uploadFile(
  file: File,
  organizationId: string,
  contractId: string,
  isVersion: boolean = true
): Promise<UploadedFile | UploadError> {
  // Tjek konfiguration
  if (!isR2Configured()) {
    return {
      error: getR2ConfigurationGuide(),
      code: 'CONFIG_MISSING',
    }
  }

  // Validér fil
  const validation = validateFile(file)
  if (!validation.valid) {
    return validation.error
  }

  // Generér filsti
  const filePath = generateFilePath(organizationId, contractId, file.name, isVersion)

  // TODO: Implementer faktisk R2 upload når konfigureret
  // const s3Client = new S3Client({
  //   region: 'auto',
  //   endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  //   credentials: {
  //     accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  //     secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  //   },
  // })
  //
  // await s3Client.send(new PutObjectCommand({
  //   Bucket: process.env.R2_BUCKET_NAME,
  //   Key: filePath,
  //   Body: await file.arrayBuffer(),
  //   ContentType: file.type,
  // }))

  // Placeholder response
  const publicUrl = process.env.R2_PUBLIC_URL || `https://${process.env.R2_BUCKET_NAME}.r2.dev`
  
  return {
    fileUrl: `${publicUrl}/${filePath}`,
    fileName: file.name,
    fileSizeBytes: file.size,
    fileType: file.type,
  }
}

/**
 * Placeholder delete funktion
 */
export async function deleteFile(fileUrl: string): Promise<boolean> {
  if (!isR2Configured()) {
    console.warn('R2 not configured, cannot delete file:', fileUrl)
    return false
  }

  // TODO: Implementer faktisk R2 delete
  // const key = extractKeyFromUrl(fileUrl)
  // await s3Client.send(new DeleteObjectCommand({
  //   Bucket: process.env.R2_BUCKET_NAME,
  //   Key: key,
  // }))

  return true
}