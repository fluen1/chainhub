import { isRedisRateLimited, recordRedisFailedAttempt } from './redis-rate-limit'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

interface LoginAttempt {
  count: number
  firstAttemptAt: number
}

// ADVARSEL: In-memory fallback giver nul beskyttelse i multi-instans deploys.
// Den nulstilles ved server-genstart og deles IKKE på tværs af instanser.
// KUN til lokal udvikling — production KRÆVER UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
const attempts = new Map<string, LoginAttempt>()

// Advar én gang ved opstart i produktion hvis Redis-konfiguration mangler
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)
) {
  console.warn(
    '[security] Rate limiting kører i in-memory fallback — ingen beskyttelse i multi-instans. ' +
      'Sæt UPSTASH_REDIS_REST_URL og UPSTASH_REDIS_REST_TOKEN i produktionsmiljøet.'
  )
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Returnerer true hvis brugeren er blokeret — tæller IKKE forsøget.
 *  Forsøger Redis først; falder tilbage til in-memory hvis Redis ikke er konfigureret.
 *  NB: In-memory fallback er kun sikker i single-instans (lokal dev). */
export async function isLoginRateLimited(
  email: string
): Promise<{ limited: boolean; retryAfterMs?: number }> {
  const redisResult = await isRedisRateLimited(email).catch(() => null)
  if (redisResult !== null) return redisResult

  // In-memory fallback — KUN til lokal dev, se advarsel øverst
  const key = normalizeEmail(email)
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    return { limited: false }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (now - entry.firstAttemptAt)
    return { limited: true, retryAfterMs }
  }

  return { limited: false }
}

/** Registrerer ét fejlet loginforsøg. Kaldes KUN når password-check fejler.
 *  Forsøger Redis først; falder tilbage til in-memory hvis Redis ikke er konfigureret. */
export async function recordFailedLoginAttempt(email: string): Promise<void> {
  const used = await recordRedisFailedAttempt(email).catch(() => false)
  if (used) return

  // In-memory fallback — KUN til lokal dev, se advarsel øverst
  const key = normalizeEmail(email)
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now })
  } else {
    entry.count++
  }
}

/** Kun til brug i tests — nulstiller intern in-memory state. */
export function resetLoginRateLimiter(): void {
  attempts.clear()
}
