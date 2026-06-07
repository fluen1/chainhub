// unstable_cache JSON-serialiserer return-værdien — Prisma DateTime-felter bliver
// derfor ISO-strings ved cache-hit, mens første (ucachede) kald returnerer levende
// Date-objekter. Helpers der kalder .getTime() på "Date"-typede felter crasher så
// kun ved cache-hit (fx dashboard-timeline). reviveDates kaldes ved cache-grænsen
// i alle unstable_cache-konsumenter og genskaber Date-objekter, så resten af koden
// kan stole på typerne.

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

export function reviveDates<T>(value: T): T {
  if (typeof value === 'string') {
    return (ISO_DATETIME.test(value) ? new Date(value) : value) as T
  }
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date || value instanceof Map || value instanceof Set) return value
  if (Array.isArray(value)) return value.map(reviveDates) as T

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = reviveDates(v)
  return out as T
}
