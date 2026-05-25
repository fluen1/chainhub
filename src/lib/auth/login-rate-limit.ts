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

/** Returnerer true hvis brugeren er blokeret — tæller IKKE forsøget. */
export function isLoginRateLimited(email: string): { limited: boolean; retryAfterMs?: number } {
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

/** Registrerer ét fejlet loginforsøg. Kaldes KUN når password-check fejler. */
export function recordFailedLoginAttempt(email: string): void {
  const key = normalizeEmail(email)
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now })
  } else {
    entry.count++
  }
}

/** Kun til brug i tests — nulstiller intern state. */
export function resetLoginRateLimiter(): void {
  attempts.clear()
}
