import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface DashboardShellProps {
  children: React.ReactNode
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <Header user={user} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}