import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
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
          {data.timelineSections.every((s) => s.items.length === 0) &&
            (() => {
              const companiesCount = data.heatmap.length
              const openCasesCount = data.heatmap.reduce((acc, c) => acc + c.openCaseCount, 0)
              const sagerKpi = data.inlineKpis.find((k) => k.label === 'Sager')
              const totalSager = sagerKpi
                ? Number(sagerKpi.value) || openCasesCount
                : openCasesCount
              return (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5"
                      aria-hidden
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Alt under kontrol</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Ingen forfaldne deadlines eller presserende items.
                      </p>
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                        <span>
                          <strong className="text-gray-900">{companiesCount}</strong> selskaber
                        </span>
                        <span>
                          <strong className="text-gray-900">{totalSager}</strong> åbne sager
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
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
