import { SkipToMain } from '@/components/layout/SkipToMain'
import { Providers } from '@/components/providers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSidebarData, buildSidebarBadges } from '@/lib/sidebar-data'
import { BShell } from '@/components/layout/b-shell'
import { GlobalKeyboardShortcuts } from '@/components/layout/global-keyboard-shortcuts'
import { PosthogIdentify } from '@/components/providers/PosthogIdentify'
import { TrialBanner } from '@/components/layout/TrialBanner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

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
