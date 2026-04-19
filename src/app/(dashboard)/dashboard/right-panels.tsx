import { FinRow } from '@/components/ui/fin-row'
import { CoverageBar } from '@/components/ui/coverage-bar'
import { CalendarWidget } from '@/components/ui/calendar-widget'
import { HeatmapGrid } from '@/components/dashboard/heatmap-grid'
import { formatMio } from '@/lib/labels'
import type { DashboardData } from '@/actions/dashboard'
import type { CalendarEvent } from '@/types/ui'

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3.5">
      <div className="text-[11px] font-semibold text-slate-900 mb-2.5">{title}</div>
      {children}
    </div>
  )
}

export interface RightPanelsProps {
  data: DashboardData
  calendarEvents: CalendarEvent[]
  upcomingEvents: CalendarEvent[]
  todayISO: string
}

export function RightPanels({ data, calendarEvents, upcomingEvents, todayISO }: RightPanelsProps) {
  const hasFinanceData =
    data.portfolioTotals.totalOmsaetning !== 0 || data.portfolioTotals.totalEbitda !== 0

  if (data.role === 'GROUP_LEGAL') {
    return (
      <div className="space-y-3">
        <Panel title="Kontraktdækning">
          {data.coverage.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              Ingen kontrakter endnu.
              <span className="mt-1 block text-xs text-gray-400">
                Upload kontrakter for at se dækningen pr. type.
              </span>
            </div>
          ) : (
            data.coverage.map((item) => (
              <CoverageBar key={item.label} label={item.label} percentage={item.pct} />
            ))
          )}
        </Panel>
        <CalendarWidget events={calendarEvents} upcoming={upcomingEvents} today={todayISO} />
      </div>
    )
  }

  if (data.role === 'GROUP_FINANCE') {
    return (
      <div className="space-y-3">
        <Panel title="Nøgletal 2025">
          {hasFinanceData ? (
            <>
              <FinRow
                label="Omsætning"
                value={`${formatMio(data.portfolioTotals.totalOmsaetning)}M`}
              />
              <FinRow label="EBITDA" value={`${formatMio(data.portfolioTotals.totalEbitda)}M`} />
              <FinRow
                label="Margin"
                value={`${(data.portfolioTotals.avgEbitdaMargin * 100).toFixed(1)}%`}
              />
              <FinRow
                label="Underskud lok."
                value={String(data.underperformingCount)}
                valueColor={data.underperformingCount > 0 ? '#ef4444' : undefined}
              />
            </>
          ) : (
            <div className="py-6 text-center text-sm text-gray-500">
              Ingen økonomi-data.
              <span className="mt-1 block text-xs text-gray-400">
                Tilføj finansielle metrics på dine selskaber for at se nøgletal.
              </span>
            </div>
          )}
        </Panel>
        <CalendarWidget events={calendarEvents} upcoming={upcomingEvents} today={todayISO} />
      </div>
    )
  }

  // GROUP_OWNER (og fall-through for GROUP_ADMIN, GROUP_READONLY, COMPANY_MANAGER,
  // COMPANY_LEGAL, COMPANY_READONLY) — fuld portefølje-visning. Tenant-scope håndteres
  // i getDashboardData(), så aggregaterne respekterer accessible companies for
  // COMPANY_*-brugere.
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg p-3.5">
        <HeatmapGrid companies={data.heatmap} />
      </div>
      <CalendarWidget events={calendarEvents} upcoming={upcomingEvents} today={todayISO} />
      <Panel title="Kontraktdækning">
        {data.coverage.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">
            Ingen kontrakter endnu.
            <span className="mt-1 block text-xs text-gray-400">
              Upload kontrakter for at se dækningen pr. type.
            </span>
          </div>
        ) : (
          data.coverage.map((item) => (
            <CoverageBar key={item.label} label={item.label} percentage={item.pct} />
          ))
        )}
      </Panel>
      <Panel title="Økonomi snapshot">
        {!hasFinanceData ? (
          <div className="py-6 text-center text-sm text-gray-500">
            Ingen økonomi-data.
            <span className="mt-1 block text-xs text-gray-400">
              Tilføj finansielle metrics på dine selskaber for at se nøgletal.
            </span>
          </div>
        ) : (
          <>
            <FinRow
              label="Omsætning"
              value={`${formatMio(data.portfolioTotals.totalOmsaetning)}M`}
            />
            <FinRow label="EBITDA" value={`${formatMio(data.portfolioTotals.totalEbitda)}M`} />
            <FinRow
              label="Underskud lok."
              value={String(data.underperformingCount)}
              valueColor={data.underperformingCount > 0 ? '#ef4444' : undefined}
            />
          </>
        )}
      </Panel>
    </div>
  )
}
