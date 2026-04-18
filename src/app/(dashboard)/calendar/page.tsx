import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCalendarEvents } from '@/actions/calendar'
import { FullCalendar } from '@/components/calendar/full-calendar'

export const metadata: Metadata = { title: 'Kalender' }

interface CalendarPageProps {
  searchParams: { month?: string; day?: string }
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1

  if (searchParams.month) {
    const [y, m] = searchParams.month.split('-').map(Number)
    if (y && m && m >= 1 && m <= 12) {
      year = y
      month = m
    }
  }

  const events = await getCalendarEvents(session.user.id, session.user.organizationId, year, month)

  const selectedDay = searchParams.day ? parseInt(searchParams.day, 10) : null

  return (
    <FullCalendar
      events={events}
      year={year}
      month={month}
      selectedDay={selectedDay}
      todayISO={now.toISOString().slice(0, 10)}
    />
  )
}
