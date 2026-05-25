import { isRedisRateLimited, recordRedisFailedAttempt } from './redis-rate-limit'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

interface LoginAttempt {
  count: number
  firstAttemptAt: number
}

const attempts = new Map<string, LoginAttempt>()

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Returnerer true hvis brugeren er blokeret — tæller IKKE forsøget.
 *  Forsøger Redis først; falder tilbage til in-memory hvis Redis ikke er konfigureret. */
export async function isLoginRateLimited(
  email: string
): Promise<{ limited: boolean; retryAfterMs?: number }> {
  const redisResult = await isRedisRateLimited(email).catch(() => null)
  if (redisResult !== null) return redisResult

  // In-memory fallback
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

  // In-memory fallback
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
