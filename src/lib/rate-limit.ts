import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let redisRatelimit: Ratelimit | null = null

function getRedisRatelimit(): Ratelimit | null {
  if (redisRatelimit) return redisRatelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  redisRatelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    prefix: 'chainhub:action',
  })
  return redisRatelimit
}

interface RateLimitBucket {
  count: number
  windowStart: number
}

const MAX_REQUESTS = 60
const WINDOW_MS = 60_000
const buckets = new Map<string, RateLimitBucket>()

export async function checkActionRateLimit(
  key: string
): Promise<{ limited: boolean; retryAfter?: number }> {
  const rl = getRedisRatelimit()
  if (rl) {
    try {
      const result = await rl.limit(key)
      if (result.success) return { limited: false }
      return { limited: true, retryAfter: Math.max(0, result.reset - Date.now()) }
    } catch {
      // Fallthrough til in-memory
    }
  }

  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now })
    return { limited: false }
  }

  bucket.count++
  if (bucket.count > MAX_REQUESTS) {
    return { limited: true, retryAfter: WINDOW_MS - (now - bucket.windowStart) }
  }

  return { limited: false }
}

export function resetActionRateLimiter(): void {
  buckets.clear()
}
