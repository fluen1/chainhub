'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies, canAccessModule } from '@/lib/permissions'
import { createLogger } from '@/lib/logger'
import { getVisitTypeLabel } from '@/lib/labels'
import type { CalendarEvent } from '@/types/ui'
import { auth } from '@/lib/auth'
import { unstable_cache } from 'next/cache'

const calendarSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})

// Cap på antal events pr. type for at undgå OOM / timeouts ved store kæder.
// 500 events/type/måned er rigeligt for 50 lokationer × 10 events/måned.
// Hvis en type rammer capped, logges en warning.
const CALENDAR_MAX_EVENTS_PER_TYPE = 500

const log = createLogger('action:calendar')

// Cache-nøgle inkluderer orgId + companyIds-hash + år/måned.
// TTL 120s: kalenderdata ændres sjældent intra-session.
const fetchCalendarData = unstable_cache(
  async (orgId: string, companyIds: string[], startDate: Date, endDate: Date) => {
    return Promise.all([
      // Kontrakt-udløb (AKTIV status, expiry_date i måneden)
      prisma.contract.findMany({
        where: {
          organization_id: orgId,
          company_id: { in: companyIds },
          deleted_at: null,
          status: 'AKTIV',
          expiry_date: { gte: startDate, lte: endDate },
        },
        include: { company: { select: { name: true } } },
        take: CALENDAR_MAX_EVENTS_PER_TYPE,
      }),

      // Opgave-frister (ikke lukkede, due_date i måneden)
      prisma.task.findMany({
        where: {
          organization_id: orgId,
          company_id: { in: companyIds },
          deleted_at: null,
          status: { not: 'LUKKET' },
          due_date: { gte: startDate, lte: endDate },
        },
        select: { id: true, title: true, due_date: true, company_id: true },
        take: CALENDAR_MAX_EVENTS_PER_TYPE,
      }),

      // Besøg (PLANLAGT, visit_date i måneden)
      prisma.visit.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: 'PLANLAGT',
          visit_date: { gte: startDate, lte: endDate },
        },
        include: { company: { select: { name: true } } },
        take: CALENDAR_MAX_EVENTS_PER_TYPE,
      }),

      // Sags-frister (åbne sager med due_date i måneden)
      prisma.case.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
          due_date: { gte: startDate, lte: endDate },
        },
        select: { id: true, title: true, due_date: true },
        take: CALENDAR_MAX_EVENTS_PER_TYPE,
      }),
    ])
  },
  ['calendar-events'],
  { revalidate: 120, tags: ['calendar'] }
)

export async function getCalendarEvents(year: number, month: number): Promise<CalendarEvent[]> {
  const session = await auth()
  if (!session) return []

  const parsed = calendarSchema.safeParse({ year, month })
  if (!parsed.success) return []

  const userId = session.user.id
  const organizationId = session.user.organizationId

  const hasModuleAccess = await canAccessModule(userId, 'companies', organizationId)
  if (!hasModuleAccess) return []

  const companyIds = await getAccessibleCompanies(userId, organizationId)
  if (companyIds.length === 0) return []

  const startDate = new Date(parsed.data.year, parsed.data.month - 1, 1)
  const endDate = new Date(parsed.data.year, parsed.data.month, 0, 23, 59, 59, 999)

  const [contracts, tasks, visits, cases] = await fetchCalendarData(
    organizationId,
    companyIds,
    startDate,
    endDate
  )

  // Warn hvis nogen type ramte cap — skjulte events betyder at kæden er vokset
  // ud over designede rammer
  const capped: string[] = []
  if (contracts.length === CALENDAR_MAX_EVENTS_PER_TYPE) capped.push('contracts')
  if (tasks.length === CALENDAR_MAX_EVENTS_PER_TYPE) capped.push('tasks')
  if (visits.length === CALENDAR_MAX_EVENTS_PER_TYPE) capped.push('visits')
  if (cases.length === CALENDAR_MAX_EVENTS_PER_TYPE) capped.push('cases')
  if (capped.length > 0) {
    log.warn(
      {
        userId,
        organizationId,
        year,
        month,
        cappedTypes: capped,
        cap: CALENDAR_MAX_EVENTS_PER_TYPE,
      },
      'calendar query hit event cap — some events may be hidden'
    )
  }

  const events: CalendarEvent[] = []

  // Kontrakt-udløb → expiry events
  // Bemærk: Contract-modellen har ikke auto_renew, alle udløb vises som 'expiry'
  for (const c of contracts) {
    if (!c.expiry_date) continue
    events.push({
      id: `contract-${c.id}`,
      date: c.expiry_date.toISOString().slice(0, 10),
      title: c.display_name,
      subtitle: c.company.name,
      type: 'expiry',
      href: `/contracts/${c.id}`,
      sourceType: 'contract',
      sourceId: c.id,
    })
  }

  // Opgaver → deadline events
  for (const t of tasks) {
    if (!t.due_date) continue
    events.push({
      id: `task-${t.id}`,
      date: t.due_date.toISOString().slice(0, 10),
      title: t.title,
      subtitle: 'Opgave',
      type: 'deadline',
      href: `/tasks/${t.id}`,
      sourceType: 'task',
      sourceId: t.id,
    })
  }

  // Besøg → meeting events
  for (const v of visits) {
    events.push({
      id: `visit-${v.id}`,
      date: v.visit_date.toISOString().slice(0, 10),
      title: `Besøg — ${v.company.name}`,
      subtitle: getVisitTypeLabel(v.visit_type),
      type: 'meeting',
      href: `/visits/${v.id}`,
      sourceType: 'visit',
      sourceId: v.id,
    })
  }

  // Sager → case events
  for (const ca of cases) {
    if (!ca.due_date) continue
    events.push({
      id: `case-${ca.id}`,
      date: ca.due_date.toISOString().slice(0, 10),
      title: ca.title,
      subtitle: 'Sagsfrist',
      type: 'case',
      href: `/cases/${ca.id}`,
      sourceType: 'case',
      sourceId: ca.id,
    })
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}
