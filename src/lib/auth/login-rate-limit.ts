const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

interface LoginAttempt {
  count: number
  firstAttemptAt: number
}

const attempts = new Map<string, LoginAttempt>()

export function checkLoginRateLimit(email: string): { allowed: boolean; retryAfterMs?: number } {
  const key = email.trim().toLowerCase()
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now })
    return { allowed: true }
  }

  if (entry.count < MAX_ATTEMPTS) {
    entry.count++
    return { allowed: true }
  }

  const retryAfterMs = WINDOW_MS - (now - entry.firstAttemptAt)
  return { allowed: false, retryAfterMs }
}

export function resetLoginRateLimiter(): void {
  attempts.clear()
}
