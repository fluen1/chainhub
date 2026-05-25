import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getDashboardData } from '@/actions/dashboard'
import { getRecentActivity } from '@/actions/activity-feed'
import { getSidebarData } from '@/lib/sidebar-data'
import { getAccessibleCompanies } from '@/lib/permissions'
import { formatMio } from '@/lib/labels'
import { WEEKDAYS_DA_FULL_SUN, MONTH_NAMES_DA_LOWER } from '@/lib/calendar-constants'
import { PageTopbar, Strip, BottomBar, SyncDot, type StripCellData } from '@/components/ui/b'
import { UrgencyPanel } from '@/components/dashboard/b/UrgencyPanel'
import { HeatmapPanel } from '@/components/dashboard/b/HeatmapPanel'
import { ActivityPanel } from '@/components/dashboard/b/ActivityPanel'
import { pickHighestPriorityRole } from '@/lib/dashboard-helpers'
import { OnboardingPanel } from '@/components/dashboard/b/OnboardingPanel'

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

  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [data, sidebar, activity] = await Promise.all([
    getDashboardData(companyIds),
    getSidebarData(session.user.id, session.user.organizationId, companyIds),
    getRecentActivity(companyIds, since24h),
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
    label: 'Omsætning YTD',
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

      <div className="grid gap-3.5 lg:grid-cols-[2fr_1fr]">
        <UrgencyPanel sections={data.timelineSections} />
        <HeatmapPanel heatmap={data.heatmap} />
      </div>

      <ActivityPanel events={activity} />

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
