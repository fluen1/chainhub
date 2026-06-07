import { describe, it, expect } from 'vitest'
import { reviveDates } from '@/lib/cache-dates'

describe('reviveDates', () => {
  // Hvorfor: unstable_cache JSON-serialiserer — Prisma DateTime bliver ISO-strings
  // ved cache-hit, og helpers der kalder .getTime() crasher. reviveDates genskaber
  // Date-objekter ved cache-grænsen så resten af koden kan stole på typerne.

  it('konverterer ISO-datetime-strings til Date', () => {
    const result = reviveDates({ due_date: '2026-06-08T10:30:00.000Z' })
    expect(result.due_date).toBeInstanceOf(Date)
    expect((result.due_date as unknown as Date).toISOString()).toBe('2026-06-08T10:30:00.000Z')
  })

  it('lader almindelige strings være uberørt', () => {
    const result = reviveDates({ title: 'Møde 2026-06-08', name: 'Optik Østerbro ApS' })
    expect(result.title).toBe('Møde 2026-06-08')
    expect(result.name).toBe('Optik Østerbro ApS')
  })

  it('passerer levende Date-objekter igennem uændret (første ucachede kald)', () => {
    const d = new Date('2026-01-15T08:00:00.000Z')
    const result = reviveDates({ created_at: d })
    expect(result.created_at).toBe(d)
  })

  it('går rekursivt gennem arrays og nestede objekter', () => {
    const result = reviveDates({
      tasks: [{ due_date: '2026-06-10T00:00:00.000Z', meta: { end: '2026-07-01T12:00:00+02:00' } }],
    })
    expect(result.tasks[0]!.due_date).toBeInstanceOf(Date)
    expect(result.tasks[0]!.meta.end).toBeInstanceOf(Date)
  })

  it('håndterer null, undefined, tal og booleans', () => {
    const result = reviveDates({ a: null, b: undefined, c: 42, d: true })
    expect(result).toEqual({ a: null, b: undefined, c: 42, d: true })
  })
})
