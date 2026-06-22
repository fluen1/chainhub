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
import {
  pickHighestPriorityRole,
  gateTimelineSectionsForRole,
  gateHeatmapForRole,
} from '@/lib/dashboard-helpers'
import { formatMio } from '@/lib/labels'
import { getAccessibleCompanies, roleCanAccessModule } from '@/lib/permissions'
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

  // Rolle-filtrerede Strip-cells via single source of truth (role-modules.ts).
  // Hver celle der peger på et modul-link gates på samme matrix som sidebar +
  // selskabsliste, så fx GROUP_FINANCE aldrig ser "Åbne sager"/"Udløber 30d"
  // (kontrakter) der ville føre til redirect. cellOmsaetning (finance) skjules
  // for roller uden finance-adgang (fx GROUP_LEGAL).
  const allStripCells: Array<{
    cell: StripCellData
    module?: import('@/lib/permissions').AppModule
  }> = [
    { cell: cellSelskaber, module: 'companies' },
    { cell: cellUdloeber, module: 'contracts' },
    { cell: cellSager, module: 'cases' },
    { cell: cellOpgaver, module: 'tasks' },
    { cell: cellDokumenter, module: 'documents' },
    { cell: cellOmsaetning, module: 'finance' },
  ]
  const stripCells: StripCellData[] = allStripCells
    .filter(({ module }) => !module || roleCanAccessModule(userRole, module))
    .map(({ cell }) => cell)

  return (
    <>
      <PageTopbar
        title={`Min portefølje · ${formatDate(now)}`}
        meta={`Sidst opdateret ${formatTime(now)} · automatisk opdatering`}
      />

      <Strip cells={stripCells} />

      <OnboardingPanel />

      <div className="grid gap-3.5 md:grid-cols-[2fr_1fr]">
        <UrgencyPanel sections={gateTimelineSectionsForRole(data.timelineSections, userRole)} />
        <HeatmapPanel heatmap={gateHeatmapForRole(data.heatmap, userRole)} />
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
