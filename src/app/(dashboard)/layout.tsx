import { SkipToMain } from '@/components/layout/SkipToMain'
import { Providers } from '@/components/providers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSidebarData, buildSidebarBadges } from '@/lib/sidebar-data'
import { BShell } from '@/components/layout/b-shell'
import { GlobalKeyboardShortcuts } from '@/components/layout/global-keyboard-shortcuts'
import { PosthogIdentify } from '@/components/providers/PosthogIdentify'
import { TrialBanner } from '@/components/layout/TrialBanner'
import { prisma } from '@/lib/db'
import { headers } from 'next/headers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  // Subscription gate: udløbne trials og annullerede abonnementer sendes til /billing.
  // Pathname hentes fra x-pathname headeren, som middleware sætter pålideligt.
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { plan: true, plan_expires_at: true },
  })

  if (org) {
    const isExpired =
      org.plan === 'trial' && org.plan_expires_at != null && org.plan_expires_at < new Date()
    const isCanceled = org.plan === 'canceled'

    if (isExpired || isCanceled) {
      const headersList = await headers()
      const pathname = headersList.get('x-pathname') ?? ''
      const isAllowed = pathname.startsWith('/billing') || pathname.startsWith('/settings')

      if (!isAllowed) {
        redirect('/billing')
      }
    }
  }

  const sidebarData = await getSidebarData(session.user.id, session.user.organizationId)
  const badges = buildSidebarBadges(sidebarData)

  return (
    <Providers>
      <PosthogIdentify />
      <SkipToMain />
      <GlobalKeyboardShortcuts />
      <TrialBanner />
      <BShell badges={badges}>{children}</BShell>
    </Providers>
  )
}
