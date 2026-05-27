import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let ratelimit: Ratelimit | null = null
let oauthSignupRatelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: 'chainhub:login',
  })
  return ratelimit
}

/** Rate limiter specifikt til nye Google OAuth signup-flows.
 *  Mere restriktiv end login: 3 nye organisationer pr. IP pr. time. */
function getOAuthSignupRatelimit(): Ratelimit | null {
  if (oauthSignupRatelimit) return oauthSignupRatelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  oauthSignupRatelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    prefix: 'chainhub:oauth-signup',
  })
  return oauthSignupRatelimit
}

export async function isRedisRateLimited(
  email: string
): Promise<{ limited: boolean; retryAfterMs?: number } | null> {
  const rl = getRatelimit()
  if (!rl) return null

  const result = await rl.limit(email.trim().toLowerCase())
  if (result.success) return { limited: false }
  return {
    limited: true,
    retryAfterMs: Math.max(0, result.reset - Date.now()),
  }
}

export async function recordRedisFailedAttempt(email: string): Promise<boolean> {
  const rl = getRatelimit()
  if (!rl) return false
  await rl.limit(email.trim().toLowerCase())
  return true
}

/** Tjekker om en given IP-adresse er rate-limiteret for Google OAuth signup.
 *  Returnerer null hvis Redis ikke er konfigureret (ingen begrænsning).
 *  Returnerer { limited: true } hvis IP har oprettet for mange nye organisationer. */
export async function isOAuthSignupRateLimited(
  ip: string
): Promise<{ limited: boolean; retryAfterMs?: number } | null> {
  const rl = getOAuthSignupRatelimit()
  if (!rl) return null

  const result = await rl.limit(ip)
  if (result.success) return { limited: false }
  return {
    limited: true,
    retryAfterMs: Math.max(0, result.reset - Date.now()),
  }
}
