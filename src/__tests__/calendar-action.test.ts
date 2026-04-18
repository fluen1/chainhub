import { describe, it, expect } from 'vitest'
import { getCalendarEvents } from '@/actions/calendar'

// Smoke-tests mod seed-DB. Bruger korrekte seed-IDer.
describe.runIf(!!process.env.DATABASE_URL)('getCalendarEvents', () => {
  const seedUserId = '00000000-0000-0000-0000-000000000010'
  const seedOrgId = '00000000-0000-0000-0000-000000000001'

  it('returnerer events for accessible companies sorteret efter dato', async () => {
    const events = await getCalendarEvents(seedUserId, seedOrgId, 2026, 4)
    expect(Array.isArray(events)).toBe(true)
    // Verificér sortering
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.date >= events[i - 1]!.date).toBe(true)
    }
  })

  it('returnerer tom array for ukendt bruger', async () => {
    const events = await getCalendarEvents('nonexistent-user-id', seedOrgId, 2026, 4)
    expect(events).toEqual([])
  })

  it('hver event har påkrævede felter + valid type', async () => {
    const events = await getCalendarEvents(seedUserId, seedOrgId, 2026, 3)
    for (const event of events) {
      expect(event).toHaveProperty('id')
      expect(event).toHaveProperty('date')
      expect(event).toHaveProperty('title')
      expect(event).toHaveProperty('type')
      expect(['expiry', 'deadline', 'meeting', 'case', 'renewal']).toContain(event.type)
    }
  })

  it('respekterer måneds-grænse (events udenfor måneden filtreres)', async () => {
    const aprilEvents = await getCalendarEvents(seedUserId, seedOrgId, 2026, 4)
    for (const event of aprilEvents) {
      expect(event.date.startsWith('2026-04')).toBe(true)
    }
  })

  it('case-type events har "Sagsfrist" subtitle', async () => {
    const events = await getCalendarEvents(seedUserId, seedOrgId, 2026, 4)
    const caseEvents = events.filter((e) => e.type === 'case')
    for (const e of caseEvents) {
      expect(e.subtitle).toBe('Sagsfrist')
    }
  })
})
