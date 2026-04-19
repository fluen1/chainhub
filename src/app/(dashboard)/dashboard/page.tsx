import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/actions/dashboard'
import { getCalendarEvents } from '@/actions/calendar'
import { getOnboardingStatus } from '@/actions/onboarding'
import { TimelineSection } from '@/components/dashboard/timeline-section'
import { OnboardingPanel } from '@/components/dashboard/onboarding-panel'
import { RightPanels } from './right-panels'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  const [data, calendarEvents, onboardingStatus] = await Promise.all([
    getDashboardData(session.user.id, session.user.organizationId),
    getCalendarEvents(
      session.user.id,
      session.user.organizationId,
      now.getFullYear(),
      now.getMonth() + 1
    ),
    getOnboardingStatus(),
  ])

  // Alle events denne måned til widget (sorteret, max 6)
  const upcomingEvents = calendarEvents.slice(0, 6)

  return (
    <div>
      {/* Print-header — kun synlig ved udskrift */}
      <div className="hidden print:block mb-6 border-b-2 border-black pb-4">
        <h1 className="text-xl font-bold text-black">ChainHub — Porteføljerapport</h1>
        <p className="text-sm text-black mt-1">
          Udskrevet:{' '}
          {new Date().toLocaleDateString('da-DK', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>
      <div className="max-w-[1400px] mx-auto">
        <OnboardingPanel status={onboardingStatus} />
      </div>
      <div className="grid grid-cols-1 gap-5 max-w-[1400px] mx-auto lg:grid-cols-[1fr_320px]">
        {/* Venstre: Timeline River */}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 mb-4">Tidslinje</div>
          {data.timelineSections.map((section) => (
            <TimelineSection key={section.id} section={section} />
          ))}
          {data.timelineSections.every((s) => s.items.length === 0) && (
            <div className="py-10 text-center text-sm text-gray-500">
              Intet planlagt i denne periode.
              <span className="mt-1 block text-xs text-gray-400">
                Upload kontrakter eller opret besøg for at se tidsoverblikket.
              </span>
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
