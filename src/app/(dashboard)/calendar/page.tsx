import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCalendarEvents } from '@/actions/calendar'
import { CalendarPageB } from './calendar-b'

export const metadata: Metadata = { title: 'Kalender' }

// Next.js 15 kræver Promise<...> for searchParams. Next.js 14 accepterer
// begge former. Vi bruger Promise-varianten proaktivt for fremtidssikring.
interface CalendarPageProps {
  searchParams: Promise<{ month?: string; view?: string }>
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const resolvedParams = await searchParams
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1

  if (resolvedParams.month) {
    const [y, m] = resolvedParams.month.split('-').map(Number)
    if (y && m && m >= 1 && m <= 12) {
      year = y
      month = m
    }
  }

  // Hent events for både den aktuelle måned (til grid) og næste måned (så
  // "Kommende"-panelet stadig viser noget når brugeren navigerer ind i en
  // tom måned).
  const nextMonthDate = new Date(year, month, 1)
  const [thisMonthEvents, nextMonthEvents] = await Promise.all([
    getCalendarEvents(year, month),
    getCalendarEvents(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1),
  ])

  const viewMode = resolvedParams.view === 'agenda' ? 'agenda' : 'maaned'
  const todayISO = now.toISOString().slice(0, 10)

  return (
    <CalendarPageB
      year={year}
      month={month}
      monthEvents={thisMonthEvents}
      nextMonthEvents={nextMonthEvents}
      todayISO={todayISO}
      viewMode={viewMode}
    />
  )
}
