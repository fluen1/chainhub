import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getRecentActivity } from '@/actions/activity-feed'
import { getActiveAlerts } from '@/actions/alerts'
import { getDashboardData } from '@/actions/dashboard'
import { AlertsWidget } from '@/components/dashboard/AlertsWidget'
import { ActivityPanel } from '@/components/dashboard/b/ActivityPanel'
import { HeatmapPanel } from '@/components/dashboard/b/HeatmapPanel'
import { OnboardingPanel } from '@/components/dashboard/b/OnboardingPanel'
import { UrgencyPanel } from '@/components/dashboard/b/UrgencyPanel'
import { PageTopbar, Strip, BottomBar, SyncDot, type StripCellData } from '@/components/ui/b'
import { auth } from '@/lib/auth'
import { WEEKDAYS_DA_FULL_SUN, MONTH_NAMES_DA_LOWER } from '@/lib/calendar-constants'
import { pickHighestPriorityRole } from '@/lib/dashboard-helpers'
import { formatMio } from '@/lib/labels'
import { getAccessibleCompanies } from '@/lib/permissions'
import { getSidebarData } from '@/lib/sidebar-data'

// ─── Async server-wrappers til Suspense-streaming ────────────────────────────

async function AlertsSection() {
  const alertsResult = await getActiveAlerts(5)
  const alerts = alertsResult.data ?? []
  return <AlertsWidget alerts={alerts} />
}

async function ActivitySection({ companyIds }: { companyIds: string[] }) {
  const activity = await getRecentActivity(companyIds)
  return <ActivityPanel events={activity} />
}

function WidgetSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 h-4 w-32 rounded bg-gray-200" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-2 h-10 rounded bg-gray-100" />
      ))}
    </div>
  )
}

export const metadata: Metadata = { title: 'Forside' }

function formatDate(d: Date): string {
  return `${WEEKDAYS_DA_FULL_SUN[d.getDay()]} ${d.getDate()}. ${MONTH_NAMES_DA_LOWER[d.getMonth()]} ${d.getFullYear()}`
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
}

export default async function DashboardPage() {
  // Auth-guard håndteres af (dashboard)/layout.tsx — ingen dobbelt-check her.
  const session = (await auth())!

  const now = new Date()

  // Hent companyIds én gang — eliminerer 2 ud af 3 redundante DB-roundtrips
  const companyIds = await getAccessibleCompanies(session.user.id, session.user.organizationId)

  const [data, sidebar] = await Promise.all([
    getDashboardData(companyIds),
    getSidebarData(session.user.id, session.user.organizationId, companyIds),
  ])

  const omsaetning = data.portfolioTotals.totalOmsaetning

  // Bestem brugerens højest-prioriterede rolle til Strip-filtrering
  const userRole = pickHighestPriorityRole(data.role ? [{ role: data.role }] : [])

  // Alle mulige Strip-celler — filtreres per rolle nedenfor
  const cellSelskaber: StripCellData = {
    num: sidebar.companiesCount,
    label: 'Selskaber',
    href: '/companies',
  }
  const cellUdloeber: StripCellData = {
    num: sidebar.expiringContractsCount,
    label: 'Udløber 30d',
    color: sidebar.expiringContractsCount > 0 ? 'red' : 'default',
    href: '/contracts?status=AKTIV&expiresWithin=30d',
  }
  const cellSager: StripCellData = {
    num: sidebar.casesCount,
    label: 'Åbne sager',
    color: sidebar.casesCount > 0 ? 'red' : 'default',
    href: '/cases?status=AKTIV',
  }
  const cellOpgaver: StripCellData = {
    num: sidebar.overdueTasksCount,
    label: 'Forfaldne opg.',
    color: sidebar.overdueTasksCount > 0 ? 'amber' : 'default',
    href: '/tasks?overdue=true',
  }
  const cellDokumenter: StripCellData = {
    num: sidebar.documentsCount,
    label: 'Dokumenter',
    href: '/documents',
  }
  const cellOmsaetning: StripCellData = {
    num: `${formatMio(omsaetning)}m`,
    label: 'Omsætning i år',
    color: 'green',
  }

  // Rolle-filtrerede Strip-cells — forhindrer at f.eks. GROUP_FINANCE
  // ser "Åbne sager" der leder til redirect pga. manglende modul-adgang.
  let stripCells: StripCellData[]
  if (userRole === 'GROUP_OWNER' || userRole === 'GROUP_ADMIN') {
    // Alle 6 cells
    stripCells = [
      cellSelskaber,
      cellUdloeber,
      cellSager,
      cellOpgaver,
      cellDokumenter,
      cellOmsaetning,
    ]
  } else if (userRole === 'GROUP_FINANCE') {
    // Finance ser økonomi-relevante cells — ikke sager (ingen adgang)
    stripCells = [cellSelskaber, cellUdloeber, cellOpgaver, cellOmsaetning]
  } else if (userRole === 'GROUP_LEGAL') {
    // Legal ser kontrakter + sager, men ikke omsætning
    stripCells = [cellSelskaber, cellUdloeber, cellSager, cellOpgaver]
  } else if (userRole === 'GROUP_READONLY') {
    // Readonly: read-only overblik uden finansdata
    stripCells = [cellSelskaber, cellUdloeber, cellSager]
  } else if (
    userRole === 'COMPANY_MANAGER' ||
    userRole === 'COMPANY_LEGAL' ||
    userRole === 'COMPANY_READONLY'
  ) {
    // COMPANY_* ser selskaber + sager + opgaver
    stripCells = [cellSelskaber, cellSager, cellOpgaver]
  } else {
    // Fallback: basiscells
    stripCells = [cellSelskaber, cellUdloeber]
  }

  return (
    <>
      <PageTopbar
        title={`Min portefølje · ${formatDate(now)}`}
        meta={`Sidst opdateret ${formatTime(now)} · automatisk opdatering`}
      />

      <Strip cells={stripCells} />

      <OnboardingPanel />

      <div className="grid gap-3.5 md:grid-cols-[2fr_1fr]">
        <UrgencyPanel sections={data.timelineSections} />
        <HeatmapPanel heatmap={data.heatmap} />
      </div>

      <Suspense fallback={<WidgetSkeleton />}>
        <AlertsSection />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton />}>
        <ActivitySection companyIds={companyIds} />
      </Suspense>

      <BottomBar
        left={
          <>
            <SyncDot />
            Sidst synkroniseret {formatTime(now)} · {sidebar.companiesCount} selskaber ·{' '}
            {sidebar.documentsCount} dokumenter
          </>
        }
      />
    </>
  )
}
