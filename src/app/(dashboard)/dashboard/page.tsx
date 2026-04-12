import type { Metadata } from 'next'
import { auth } from '@/lib/auth'

export const metadata: Metadata = { title: 'Dashboard' }
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, Briefcase, CheckSquare, Building2 } from 'lucide-react'
import { getDashboardData } from '@/actions/dashboard'
import { getCalendarEvents } from '@/actions/calendar'
import { TimelineSection } from '@/components/dashboard/timeline-section'
import { RightPanels } from './right-panels'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  const [data, calendarEvents] = await Promise.all([
    getDashboardData(session.user.id, session.user.organizationId),
    getCalendarEvents(session.user.id, session.user.organizationId, now.getFullYear(), now.getMonth() + 1),
  ])

  // Kommende 7 dage til widget
  const upcomingEvents = calendarEvents.filter((e) => {
    const diff = (new Date(e.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 7
  })

  const timelineHasItems = data.timelineSections.some((s) => s.items.length > 0)

  // Quick stats for shortcuts
  const shortcuts = [
    { label: 'Selskaber', value: String(data.heatmap.length), href: '/companies', icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { label: 'Kontrakter', value: String(data.coverage.length > 0 ? data.coverage.reduce((sum, c) => sum + Math.round(c.pct * data.heatmap.length / 100), 0) : 0), href: '/contracts', icon: FileText, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Åbne sager', value: String(data.heatmap.reduce((sum, c) => sum + c.openCaseCount, 0)), href: '/cases', icon: Briefcase, color: 'text-purple-600 bg-purple-50' },
    { label: 'Opgaver', value: String(data.inlineKpis.find(k => k.label === 'Forfaldne')?.value ?? '0'), href: '/tasks', icon: CheckSquare, color: 'text-amber-600 bg-amber-50' },
  ]

  return (
    <div>
      <div className="grid grid-cols-[1fr_320px] gap-5 max-w-[1400px] mx-auto">
        {/* Venstre: Timeline River */}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 mb-4">Tidslinje</div>
          {data.timelineSections.map((section) => (
            <TimelineSection key={section.id} section={section} />
          ))}
          {!timelineHasItems && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-gray-500">Ingen begivenheder</p>
              <p className="text-xs text-gray-400 mt-1">Din tidslinje er tom lige nu.</p>
            </div>
          )}

          {/* Genveje — fylder naturligt under tidslinjen */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Hurtig adgang</div>
            <div className="grid grid-cols-4 gap-3">
              {shortcuts.map((s) => {
                const Icon = s.icon
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 p-3.5 hover:border-gray-300 hover:shadow-sm transition-all no-underline"
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{s.value}</div>
                      <div className="text-[10px] text-gray-400">{s.label}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
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
