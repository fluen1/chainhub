import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import { getUserRoleLabel, getUserRoleStyle, formatDate } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { Settings, Users, ShieldCheck } from 'lucide-react'
import { CreateUserForm } from '@/components/settings/CreateUserForm'
import { UserActions } from '@/components/settings/UserActions'

export const metadata: Metadata = { title: 'Indstillinger' }

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'user_management')

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Indstillinger</h1>
          <p className="mt-1 text-sm text-gray-500">Administrer din organisation</p>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Ingen adgang</h2>
          </div>
          <p className="text-sm text-gray-500">
            Du har ikke adgang til indstillinger. Kontakt din kædeejer eller administrator.
          </p>
        </div>
      </div>
    )
  }

  const [users, companies] = await Promise.all([
    prisma.user.findMany({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      include: { roles: true },
      orderBy: { created_at: 'desc' },
    }),
    prisma.company.findMany({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Indstillinger</h1>
        <p className="mt-1 text-sm text-gray-500">Administrer din organisation</p>
      </div>

      {/* User management section */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Brugere</h2>
              <p className="text-sm text-gray-500">
                {users.length} bruger{users.length !== 1 ? 'e' : ''} i din organisation
              </p>
            </div>
          </div>
          <CreateUserForm companies={companies} />
        </div>

        {/* User table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3">Bruger</th>
                <th className="px-6 py-3">Rolle</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Oprettet</th>
                <th className="px-6 py-3">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const primaryRole = user.roles[0]
                const roleName = primaryRole?.role ?? 'GROUP_READONLY'
                const isSelf = user.id === session.user.id

                return (
                  <tr key={user.id} className={cn('hover:bg-gray-50', !user.active && 'opacity-60')}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.name}
                          {isSelf && (
                            <span className="ml-2 text-xs text-gray-400">(dig)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          getUserRoleStyle(roleName)
                        )}
                      >
                        {getUserRoleLabel(roleName)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          user.active
                            ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20'
                            : 'bg-gray-100 text-gray-500 ring-1 ring-gray-400/20'
                        )}
                      >
                        {user.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <UserActions
                        userId={user.id}
                        currentRole={roleName}
                        currentCompanyIds={primaryRole?.company_ids ?? []}
                        active={user.active}
                        isSelf={isSelf}
                        companies={companies}
                      />
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    Ingen brugere fundet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Organization section placeholder */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Organisation</h2>
        </div>
        <p className="text-sm text-gray-500">
          Organisationsindstillinger kommer i en kommende opdatering.
        </p>
      </div>
    </div>
  )
}
