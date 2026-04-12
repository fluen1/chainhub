'use server'

import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import type { CalendarEvent } from '@/types/ui'

export async function getCalendarEvents(
  userId: string,
  organizationId: string,
  year: number,
  month: number
): Promise<CalendarEvent[]> {
  const companyIds = await getAccessibleCompanies(userId, organizationId)
  if (companyIds.length === 0) return []

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  const [contracts, tasks, visits, cases] = await Promise.all([
    // Kontrakt-udløb (AKTIV status, expiry_date i måneden)
    prisma.contract.findMany({
      where: {
        organization_id: organizationId,
        company_id: { in: companyIds },
        deleted_at: null,
        status: 'AKTIV',
        expiry_date: { gte: startDate, lte: endDate },
      },
      include: { company: { select: { name: true } } },
    }),

    // Opgave-frister (ikke lukkede, due_date i måneden)
    prisma.task.findMany({
      where: {
        organization_id: organizationId,
        company_id: { in: companyIds },
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { gte: startDate, lte: endDate },
      },
      select: { id: true, title: true, due_date: true, company_id: true },
    }),

    // Besøg (PLANLAGT, visit_date i måneden)
    prisma.visit.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: 'PLANLAGT',
        visit_date: { gte: startDate, lte: endDate },
      },
      include: { company: { select: { name: true } } },
    }),

    // Sags-frister (åbne sager med due_date i måneden)
    prisma.case.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
        due_date: { gte: startDate, lte: endDate },
      },
      select: { id: true, title: true, due_date: true },
    }),
  ])

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
    })
  }

  // Besøg → meeting events
  for (const v of visits) {
    events.push({
      id: `visit-${v.id}`,
      date: v.visit_date.toISOString().slice(0, 10),
      title: `Besøg — ${v.company.name}`,
      subtitle: v.visit_type.toLowerCase().replace('_', ' '),
      type: 'meeting',
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
    })
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}
