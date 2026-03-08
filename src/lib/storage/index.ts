// Cloudflare R2 fil-upload placeholder
// DEC-030: Storage helper til kontrakt-versioner og bilag

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

/**
 * Tjekker om R2 storage er konfigureret korrekt
 */
export function isStorageConfigured(): boolean {
  return !!(
    R2_BUCKET_NAME &&
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY
  )
}

/**
 * Returnerer konfigurationsvejledning hvis R2 ikke er opsat
 */
export function getStorageConfigurationGuide(): string {
  const missing: string[] = []
  if (!R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME')
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID')
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID')
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY')

  return `
Cloudflare R2 er ikke konfigureret. Manglende miljøvariabler: ${missing.join(', ')}

Opsætning:
1. Opret en R2 bucket i Cloudflare Dashboard
2. Generer API-nøgler med R2-skriveadgang
3. Tilføj følgende til din .env.local:

   R2_BUCKET_NAME=din-bucket-navn
   R2_ACCOUNT_ID=dit-cloudflare-account-id
   R2_ACCESS_KEY_ID=din-r2-access-key
   R2_SECRET_ACCESS_KEY=din-r2-secret-key
   R2_PUBLIC_URL=https://pub-xxxxx.r2.dev (valgfri — til direkte adgang)

Dokumentation: https://developers.cloudflare.com/r2/
`.trim()
}

/**
 * Genererer en unik sti til filen i R2 bucketen
 * Format: {organizationId}/{resourceType}/{resourceId}/{timestamp}-{fileName}
 */
export function generateStoragePath(
  organizationId: string,
  resourceType: 'contracts' | 'attachments' | 'documents',
  resourceId: string,
  fileName: string
): string {
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  return `${organizationId}/${resourceType}/${resourceId}/${timestamp}-${sanitizedFileName}`
}

/**
 * Genererer en pre-signed upload URL til Cloudflare R2
 *
 * PLACEHOLDER: Kræver aws4 eller @aws-sdk/client-s3 pakke
 * R2 er S3-kompatibel og bruger samme pre-signed URL mekanisme
 */
export async function getSignedUploadUrl(
  fileKey: string,
  contentType: string,
  expiresInSeconds: number = 3600
): Promise<{ uploadUrl: string; fileUrl: string }> {
  if (!isStorageConfigured()) {
    throw new Error(
      `Fil-upload er ikke tilgængeligt. ${getStorageConfigurationGuide()}`
    )
  }

  // PLACEHOLDER IMPLEMENTATION
  // I produktion skal dette bruge @aws-sdk/client-s3 med R2-endpoint:
  //
  // import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
  // import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
  //
  // const s3 = new S3Client({
  //   region: 'auto',
  //   endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  //   credentials: {
  //     accessKeyId: R2_ACCESS_KEY_ID!,
  //     secretAccessKey: R2_SECRET_ACCESS_KEY!,
  //   },
  // })
  //
  // const command = new PutObjectCommand({
  //   Bucket: R2_BUCKET_NAME,
  //   Key: fileKey,
  //   ContentType: contentType,
  // })
  //
  // const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
  // const fileUrl = R2_PUBLIC_URL
  //   ? `${R2_PUBLIC_URL}/${fileKey}`
  //   : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${fileKey}`
  //
  // return { uploadUrl, fileUrl }

  throw new Error(
    'Fil-upload er ikke fuldt implementeret endnu. Installer @aws-sdk/client-s3 og @aws-sdk/s3-request-presigner og uncomment koden ovenfor.'
  )
}

/**
 * Genererer en pre-signed download URL til Cloudflare R2
 */
export async function getSignedDownloadUrl(
  fileKey: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error(
      `Fil-download er ikke tilgængeligt. ${getStorageConfigurationGuide()}`
    )
  }

  // PLACEHOLDER IMPLEMENTATION
  // import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
  // import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
  //
  // const s3 = new S3Client({
  //   region: 'auto',
  //   endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  //   credentials: {
  //     accessKeyId: R2_ACCESS_KEY_ID!,
  //     secretAccessKey: R2_SECRET_ACCESS_KEY!,
  //   },
  // })
  //
  // const command = new GetObjectCommand({
  //   Bucket: R2_BUCKET_NAME,
  //   Key: fileKey,
  // })
  //
  // return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })

  // Hvis R2_PUBLIC_URL er sat, brug direkte URL (kun til offentlige filer)
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${fileKey}`
  }

  throw new Error(
    'Fil-download er ikke fuldt implementeret endnu. Installer @aws-sdk/client-s3 og @aws-sdk/s3-request-presigner og uncomment koden ovenfor.'
  )
}

/**
 * Sletter en fil fra R2
 */
export async function deleteFile(fileKey: string): Promise<void> {
  if (!isStorageConfigured()) {
    throw new Error(
      `Fil-sletning er ikke tilgængeligt. ${getStorageConfigurationGuide()}`
    )
  }

  // PLACEHOLDER IMPLEMENTATION
  // import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
  //
  // const s3 = new S3Client({
  //   region: 'auto',
  //   endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  //   credentials: {
  //     accessKeyId: R2_ACCESS_KEY_ID!,
  //     secretAccessKey: R2_SECRET_ACCESS_KEY!,
  //   },
  // })
  //
  // await s3.send(new DeleteObjectCommand({
  //   Bucket: R2_BUCKET_NAME,
  //   Key: fileKey,
  // }))

  console.warn(`deleteFile: ${fileKey} — storage ikke fuldt konfigureret`)
}

/**
 * Udtrækker fileKey fra en fuld file URL
 */
export function extractFileKey(fileUrl: string): string {
  if (!R2_PUBLIC_URL) return fileUrl
  return fileUrl.replace(`${R2_PUBLIC_URL}/`, '')
}