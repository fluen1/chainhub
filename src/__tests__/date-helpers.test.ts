import { describe, it, expect } from 'vitest'
import {
  formatDanishDate,
  formatDanishDateTime,
  formatShortDate,
  formatRelativeDate,
} from '@/lib/date-helpers'

describe('formatDanishDate', () => {
  it('formaterer dato på dansk', () => {
    const d = new Date(2026, 3, 15) // lokal 15. april
    expect(formatDanishDate(d)).toBe('15. April 2026')
  })
  it('returnerer tom streng for null', () => {
    expect(formatDanishDate(null)).toBe('')
  })
  it('returnerer tom streng for undefined', () => {
    expect(formatDanishDate(undefined)).toBe('')
  })
  it('parser ISO-string', () => {
    expect(formatDanishDate('2026-12-01T12:00:00Z')).toMatch(/December 2026/)
  })
  it('returnerer tom streng for invalid', () => {
    expect(formatDanishDate('ikke en dato')).toBe('')
  })
})

describe('formatDanishDateTime', () => {
  it('inkluderer klokkeslæt', () => {
    const d = new Date(2026, 3, 15, 14, 30)
    expect(formatDanishDateTime(d)).toBe('15. April 2026 kl. 14:30')
  })
  it('zero-padder timer/minutter', () => {
    const d = new Date(2026, 0, 5, 9, 5)
    expect(formatDanishDateTime(d)).toBe('5. Januar 2026 kl. 09:05')
  })
  it('returnerer tom streng for null', () => {
    expect(formatDanishDateTime(null)).toBe('')
  })
})

describe('formatShortDate', () => {
  it('bruger kort måned', () => {
    const d = new Date(2026, 0, 5)
    expect(formatShortDate(d)).toBe('5. jan 2026')
  })
  it('returnerer tom streng for null', () => {
    expect(formatShortDate(null)).toBe('')
  })
})

describe('formatRelativeDate', () => {
  it('genkender i dag', () => {
    expect(formatRelativeDate(new Date())).toBe('i dag')
  })
  it('genkender i går', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(formatRelativeDate(d)).toBe('i går')
  })
  it('genkender i morgen', () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    expect(formatRelativeDate(d)).toBe('i morgen')
  })
  it('bruger "for N dage siden" for 2-7 dage tilbage', () => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    expect(formatRelativeDate(d)).toBe('for 3 dage siden')
  })
  it('bruger "om N dage" for 2-7 dage frem', () => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    expect(formatRelativeDate(d)).toBe('om 5 dage')
  })
  it('falder tilbage til absolut for > 7 dage tilbage', () => {
    const d = new Date(2026, 0, 1)
    expect(formatRelativeDate(d)).toMatch(/januar|Januar/i)
  })
  it('returnerer tom streng for null', () => {
    expect(formatRelativeDate(null)).toBe('')
  })
})
