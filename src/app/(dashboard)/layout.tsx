import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAlertStats } from '@/actions/alerts'
import { BShell } from '@/components/layout/b-shell'
import { GlobalKeyboardShortcuts } from '@/components/layout/global-keyboard-shortcuts'
import { SkipToMain } from '@/components/layout/SkipToMain'
import { TrialBanner } from '@/components/layout/TrialBanner'
import { Providers } from '@/components/providers'
import { PosthogIdentify } from '@/components/providers/PosthogIdentify'
import { auth } from '@/lib/auth'
import { shouldGateBilling } from '@/lib/billing/access-gate'
import { prisma } from '@/lib/db'
import { getSidebarData, buildSidebarBadges } from '@/lib/sidebar-data'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  // Subscription gate: udløbne trials, annullerede og past_due abonnementer sendes til /billing.
  // Pathname hentes fra x-pathname headeren, som middleware sætter pålideligt.
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      plan: true,
      plan_expires_at: true,
      subscriptions: {
        where: { status: { not: 'canceled' } },
        select: { status: true },
        take: 1,
      },
    },
  })

  if (org) {
    const subStatus = org.subscriptions[0]?.status ?? null
    const gate = shouldGateBilling({
      plan: org.plan,
      planExpiresAt: org.plan_expires_at,
      subStatus,
    })

    if (gate) {
      const headersList = await headers()
      const pathname = headersList.get('x-pathname') ?? ''
      const isAllowed = pathname.startsWith('/billing') || pathname.startsWith('/settings')

      if (!isAllowed) {
        redirect('/billing')
      }
    }
  }

  const [sidebarData, alertStatsResult] = await Promise.all([
    getSidebarData(session.user.id, session.user.organizationId),
    getAlertStats(),
  ])
  const badges = buildSidebarBadges(sidebarData)
  const alertCount = alertStatsResult.data?.total ?? 0

  // AI-chat er kun relevant når org er på Plus-planen — skjul knappen ellers
  // så brugeren ikke møder en fejl-toast ved klik.
  const isAiEnabled = org?.plan === 'plus'

  return (
    <Providers>
      <PosthogIdentify />
      <SkipToMain />
      <GlobalKeyboardShortcuts />
      <TrialBanner />
      <BShell
        badges={badges}
        alertCount={alertCount}
        userRole={sidebarData.userRole}
        isAiEnabled={isAiEnabled}
      >
        {children}
      </BShell>
    </Providers>
  )
}
