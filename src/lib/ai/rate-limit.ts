/**
 * In-memory token-bucket rate-limiter for upload-endpointet.
 *
 * Formål: Forhindre bulk-upload-storm (fx 500 PDF'er i burst) i at sende
 * parallelle requests til Anthropic og ramme Tier-loftet. 10 uploads/min per
 * organisation er rigeligt til realistiske workflows, men blokerer misbrug.
 *
 * Begrænsninger:
 * - In-memory Map persists kun i én Next.js server-instans. Serverless
 *   cold-starts resetter bucket'en — acceptabelt i pilot.
 * - Ved scale-out til flere instanser skal dette migreres til Redis.
 */

interface Bucket {
  tokens: number
  lastRefill: number
}

const BUCKET_SIZE = 10
const REFILL_INTERVAL_MS = 60_000

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs?: number
}

export function checkUploadRateLimit(organizationId: string): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(organizationId) ?? { tokens: BUCKET_SIZE, lastRefill: now }

  const elapsed = now - bucket.lastRefill
  if (elapsed >= REFILL_INTERVAL_MS) {
    bucket.tokens = BUCKET_SIZE
    bucket.lastRefill = now
  }

  if (bucket.tokens <= 0) {
    buckets.set(organizationId, bucket)
    return { allowed: false, retryAfterMs: REFILL_INTERVAL_MS - elapsed }
  }

  bucket.tokens -= 1
  buckets.set(organizationId, bucket)
  return { allowed: true }
}

export function resetRateLimiter(): void {
  buckets.clear()
}
