import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Providers } from '@/components/providers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSidebarData } from '@/lib/sidebar-data'

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

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          data={sidebarData}
          userName={session.user.name ?? 'Bruger'}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  )
}
