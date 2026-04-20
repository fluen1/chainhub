import { createHash } from 'node:crypto'

/** SHA-256 hex-digest af en buffer. Bruges til content-dedup på uploads. */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
