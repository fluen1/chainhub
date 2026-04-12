import type { Metadata } from 'next'
import { auth } from '@/lib/auth'

export const metadata: Metadata = { title: 'Dashboard' }
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/actions/dashboard'
import { TimelineSection } from '@/components/dashboard/timeline-section'
import { RightPanels } from './right-panels'
import type { CalendarEvent } from '@/types/ui'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const data = await getDashboardData(session.user.id, session.user.organizationId)
  const todayISO = new Date().toISOString().slice(0, 10)

  // For nu: tomme calendar events (populeres i Plan 4C når /calendar er færdig)
  const calendarEvents: CalendarEvent[] = []
  const upcomingEvents: CalendarEvent[] = []

  return (
    <div className="p-5 h-full">
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
