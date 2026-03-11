import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { formatDistanceToNow } from 'date-fns'
import { da } from 'date-fns/locale'

interface Props {
  params: { id: string }
}

export default async function CompanyLogPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  // Hent audit log for dette selskab
  const logs = await prisma.auditLog.findMany({
    where: {
      organization_id: session.user.organizationId,
      resource_type: 'company',
      resource_id: params.id,
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Aktivitetslog</h2>
        <p className="text-sm text-gray-500 mt-0.5">Alle handlinger på dette selskab</p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-sm text-gray-500">Ingen aktivitet registreret endnu.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {logs.map((log) => (
              <li key={log.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{log.action}</span>
                      {' — '}
                      <span className="text-gray-600">{log.resource_type}</span>
                    </p>
                    {log.changes && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {JSON.stringify(log.changes)}
                      </p>
                    )}
                  </div>
                  <time className="whitespace-nowrap text-xs text-gray-400">
                    {formatDistanceToNow(new Date(log.created_at), {
                      addSuffix: true,
                      locale: da,
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
