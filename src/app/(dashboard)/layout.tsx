import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { Providers } from '@/components/providers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSidebarData, buildSidebarBadges } from '@/lib/sidebar-data'
import type { InlineKpi } from '@/types/ui'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const sidebarData = await getSidebarData(
    session.user.id,
    session.user.organizationId
  )
  const badges = buildSidebarBadges(sidebarData)

  // Header inline KPIs — 5 KPIs matchende proto (GROUP_OWNER)
  const formatMio = (val: number) => `${(val / 1_000_000).toFixed(1)}m`
  const headerKpis: InlineKpi[] = [
    { label: 'Selskaber', value: String(sidebarData.companiesCount) },
    {
      label: 'Udløbende',
      value: String(sidebarData.expiringContractsCount),
      color: sidebarData.expiringContractsCount > 0 ? 'amber' : undefined,
    },
    { label: 'Sager', value: String(sidebarData.casesCount) },
    {
      label: 'Forfaldne',
      value: String(sidebarData.overdueTasksCount),
      color: sidebarData.overdueTasksCount > 0 ? 'red' : undefined,
    },
    { label: 'Omsætning', value: formatMio(sidebarData.omsaetningTotal) },
  ]

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden">
        <div className="hidden lg:flex h-full">
          <AppSidebar
            userName={session.user.name ?? 'Bruger'}
            userRoleLabel={sidebarData.userRoleLabel}
            badges={badges}
          />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader
            userName={session.user.name ?? 'Bruger'}
            kpis={headerKpis}
            currentDate={new Date()}
          />
          <main className="flex-1 overflow-y-auto bg-[#f0f2f5] px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  )
}
