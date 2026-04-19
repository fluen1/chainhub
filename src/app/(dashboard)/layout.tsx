import { MobileSidebarWrapper } from '@/components/layout/mobile-sidebar-wrapper'
import { SkipToMain } from '@/components/layout/SkipToMain'
import { Providers } from '@/components/providers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSidebarData, buildSidebarBadges } from '@/lib/sidebar-data'
import type { InlineKpi } from '@/types/ui'
import { formatMio } from '@/lib/labels'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const sidebarData = await getSidebarData(session.user.id, session.user.organizationId)
  const badges = buildSidebarBadges(sidebarData)

  // Header inline KPIs — 5 KPIs matchende proto (GROUP_OWNER)
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
    { label: 'Omsætning', value: `${formatMio(sidebarData.omsaetningTotal)}m` },
  ]

  return (
    <Providers>
      <SkipToMain />
      <div className="flex h-screen overflow-hidden">
        <MobileSidebarWrapper
          userName={session.user.name ?? 'Bruger'}
          userRoleLabel={sidebarData.userRoleLabel}
          badges={badges}
          kpis={headerKpis}
          currentDate={new Date()}
        >
          {children}
        </MobileSidebarWrapper>
      </div>
    </Providers>
  )
}
