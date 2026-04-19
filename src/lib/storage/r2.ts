import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createLogger } from '@/lib/logger'
import type { StorageProvider, UploadInput } from './types'

const log = createLogger('storage-r2')

export interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

/**
 * Cloudflare R2 storage — S3-kompatibel API via @aws-sdk/client-s3.
 *
 * Bruger region 'auto' og R2-endpoint. Presigned URLs udstedes med 1 time
 * levetid via @aws-sdk/s3-request-presigner.
 */
export class R2StorageProvider implements StorageProvider {
  readonly providerName = 'r2' as const
  private readonly client: S3Client
  private readonly bucket: string

  constructor(config: R2Config) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    this.bucket = config.bucket
  }

  async upload(input: UploadInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.buffer,
        ContentType: input.contentType,
      })
    )
    log.debug({ key: input.key, size: input.buffer.length }, 'Uploaded to R2')
  }

  async download(key: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      )
      if (!response.Body) return null
      const bytes = await response.Body.transformToByteArray()
      return Buffer.from(bytes)
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        (err as { name: string }).name === 'NoSuchKey'
      ) {
        return null
      }
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async getDownloadUrl(key: string): Promise<string> {
    // Presigned URL, 1 time
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: 3600,
    })
  }
}
