import { MONTH_NAMES_DA, MONTH_NAMES_DA_SHORT } from '@/lib/calendar-constants'

/**
 * Central dansk dato-formattering. Brug disse i stedet for
 * `toLocaleDateString('da-DK', ...)`-kald spredt rundt i koden.
 *
 * Alle funktioner håndterer `null`/`undefined` + invalid dates ved at
 * returnere tom streng, så call-sites kan fallback med `|| '—'` hvis de vil.
 */

/** "15. Januar 2026" — fuld dansk dato med capitalized månednavn. */
export function formatDanishDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()}. ${MONTH_NAMES_DA[d.getMonth()]} ${d.getFullYear()}`
}

/** "15. Januar 2026 kl. 14:30" — fuld dato + klokkeslæt. */
export function formatDanishDateTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${formatDanishDate(d)} kl. ${hours}:${minutes}`
}

/** "15. jan 2026" — kompakt dato med kort månednavn. */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()}. ${MONTH_NAMES_DA_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Relativ dato fra en konkret Date:
 * "i dag", "i går", "i morgen", "for 3 dage siden", "om 5 dage",
 * ellers fallback til `formatDanishDate`.
 *
 * Bemærk: forskellig fra `relativeDate(number)` i labels.ts der tager
 * et forud-beregnet `daysUntilExpiry` og bruges i kontrakt-list-UI.
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'i dag'
  if (diffDays === -1) return 'i går'
  if (diffDays === 1) return 'i morgen'
  if (diffDays < 0 && diffDays >= -7) return `for ${-diffDays} dage siden`
  if (diffDays > 0 && diffDays <= 7) return `om ${diffDays} dage`
  return formatDanishDate(d)
}
