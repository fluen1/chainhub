import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
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

export const metadata: Metadata = { title: 'Forside' }

function formatDate(d: Date): string {
  return `${WEEKDAYS_DA_FULL_SUN[d.getDay()]} ${d.getDate()}. ${MONTH_NAMES_DA_LOWER[d.getMonth()]} ${d.getFullYear()}`
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const now = new Date()

  // Hent companyIds én gang — eliminerer 2 ud af 3 redundante DB-roundtrips
  const companyIds = await getAccessibleCompanies(session.user.id, session.user.organizationId)

  const [data, sidebar, activity] = await Promise.all([
    getDashboardData(session.user.id, session.user.organizationId, companyIds),
    getSidebarData(session.user.id, session.user.organizationId, companyIds),
    getRecentActivity(session.user.organizationId, session.user.id, companyIds),
  ])

  const omsaetning = data.portfolioTotals.totalOmsaetning

  // 6-cell strip: Selskaber · Udløber 30d · Åbne sager · Forfaldne opg.
  //               · Dokumenter · Omsætning YTD
  const stripCells: StripCellData[] = [
    { num: sidebar.companiesCount, label: 'Selskaber', href: '/companies' },
    {
      num: sidebar.expiringContractsCount,
      label: 'Udløber 30d',
      color: sidebar.expiringContractsCount > 0 ? 'red' : 'default',
      href: '/contracts?status=AKTIV&expiresWithin=30d',
    },
    {
      num: sidebar.casesCount,
      label: 'Åbne sager',
      color: sidebar.casesCount > 0 ? 'red' : 'default',
      href: '/cases?status=AKTIV',
    },
    {
      num: sidebar.overdueTasksCount,
      label: 'Forfaldne opg.',
      color: sidebar.overdueTasksCount > 0 ? 'amber' : 'default',
      href: '/tasks?overdue=true',
    },
    { num: sidebar.documentsCount, label: 'Dokumenter', href: '/documents' },
    { num: `${formatMio(omsaetning)}m`, label: 'Omsætning YTD', color: 'green' },
  ]

  return (
    <>
      <PageTopbar
        title={`Min portefølje · ${formatDate(now)}`}
        meta={`Sidst opdateret ${formatTime(now)} · automatisk opdatering`}
      />

      <Strip cells={stripCells} />

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
