import type { MockCalendarEvent } from './types'

export const mockCalendarEvents: MockCalendarEvent[] = [
  {
    id: 'cal-1',
    date: '2026-03-10',
    title: 'Frist: Indsendelse årsrapport',
    subtitle: 'Nordklinik ApS',
    type: 'deadline',
    companyId: 'c1',
    companyName: 'Nordklinik ApS',
    aiExtracted: true,
    href: '/proto/portfolio/c1',
  },
  {
    id: 'cal-2',
    date: '2026-03-18',
    title: 'Fornyelse underskrevet',
    subtitle: 'Aarhus Smile ApS · automatisk fornyelse',
    type: 'renewal',
    companyId: 'c5',
    companyName: 'Aarhus Smile ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-5',
  },
  {
    id: 'cal-3',
    date: '2026-03-28',
    title: 'Udløb: Ejeraftale',
    subtitle: 'Nordklinik ApS',
    type: 'expiry',
    companyId: 'c1',
    companyName: 'Nordklinik ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-1',
  },
  {
    id: 'cal-4',
    date: '2026-03-30',
    title: 'Opsigelse mulig — Leverandøraftale',
    subtitle: 'Sundby Dental · opsigelsesfrist',
    type: 'deadline',
    companyId: 'c2',
    companyName: 'Sundby Dental ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-3',
  },
  {
    id: 'cal-5',
    date: '2026-03-31',
    title: 'Besøg — Østklinikken',
    subtitle: 'Driftsbesøg · kl. 10:00',
    type: 'meeting',
    companyId: 'c3',
    companyName: 'Østklinikken ApS',
    aiExtracted: false,
    href: '/proto/portfolio/c3',
  },
  {
    id: 'cal-6',
    date: '2026-04-01',
    title: 'Møde — Dr. Petersen',
    subtitle: 'Nordklinik ApS · genforhandling',
    type: 'meeting',
    companyId: 'c1',
    companyName: 'Nordklinik ApS',
    aiExtracted: false,
    href: '/proto/portfolio/c1',
  },
  {
    id: 'cal-7',
    date: '2026-04-02',
    title: 'Frist: Indsigelse lejemål',
    subtitle: 'Aalborg Dental · sagsfrist',
    type: 'case',
    companyId: 'c4',
    companyName: 'Aalborg Dental Group',
    aiExtracted: true,
    href: '/proto/portfolio/c4',
  },
  {
    id: 'cal-8',
    date: '2026-04-05',
    title: 'Udløb: Huslejekontrakt',
    subtitle: 'Vesterbro Tandlæge',
    type: 'expiry',
    companyId: 'c6',
    companyName: 'Vesterbro Tandlæge ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-6',
  },
  {
    id: 'cal-9',
    date: '2026-04-06',
    title: 'Fornyelse underskrevet',
    subtitle: 'Aarhus Smile · automatisk fornyelse',
    type: 'renewal',
    companyId: 'c5',
    companyName: 'Aarhus Smile ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-5',
  },
  {
    id: 'cal-10',
    date: '2026-04-14',
    title: 'Besøg — Sundby Dental',
    subtitle: 'Opfølgning · kl. 14:00',
    type: 'meeting',
    companyId: 'c2',
    companyName: 'Sundby Dental ApS',
    aiExtracted: false,
    href: '/proto/portfolio/c2',
  },
]

export function getCalendarEvents(year: number, month: number): MockCalendarEvent[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return mockCalendarEvents.filter((e) => e.date.startsWith(prefix))
}

export function getUpcomingCalendarEvents(fromDate: string, days: number): MockCalendarEvent[] {
  const from = new Date(fromDate)
  const to = new Date(fromDate)
  to.setDate(to.getDate() + days)

  return mockCalendarEvents
    .filter((e) => {
      const d = new Date(e.date)
      return d >= from && d <= to
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function getEventTypeColor(type: MockCalendarEvent['type']): string {
  switch (type) {
    case 'expiry':
      return '#ef4444'
    case 'deadline':
      return '#f59e0b'
    case 'meeting':
      return '#3b82f6'
    case 'case':
      return '#8b5cf6'
    case 'renewal':
      return '#22c55e'
  }
}
