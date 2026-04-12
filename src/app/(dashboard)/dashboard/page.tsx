import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/actions/dashboard'
import { getCalendarEvents } from '@/actions/calendar'
import { TimelineSection } from '@/components/dashboard/timeline-section'
import { RightPanels } from './right-panels'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  const [data, calendarEvents] = await Promise.all([
    getDashboardData(session.user.id, session.user.organizationId),
    getCalendarEvents(session.user.id, session.user.organizationId, now.getFullYear(), now.getMonth() + 1),
  ])

  // Alle events denne måned til widget (sorteret, max 6)
  const upcomingEvents = calendarEvents.slice(0, 6)

  return (
    <div>
      <div className="grid grid-cols-[1fr_320px] gap-5 max-w-[1400px] mx-auto">
        {/* Venstre: Timeline River */}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 mb-4">Tidslinje</div>
          {data.timelineSections.map((section) => (
            <TimelineSection key={section.id} section={section} />
          ))}
          {data.timelineSections.every((s) => s.items.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-gray-500">Ingen begivenheder</p>
              <p className="text-xs text-gray-400 mt-1">Din tidslinje er tom lige nu.</p>
            </div>
          )}
        </div>

        {/* Højre: Rolle-specifikke paneler */}
        <div className="min-w-0">
          <RightPanels
            data={data}
            calendarEvents={calendarEvents}
            upcomingEvents={upcomingEvents}
            todayISO={todayISO}
          />
        </div>
      </div>
    </div>
  )
}
