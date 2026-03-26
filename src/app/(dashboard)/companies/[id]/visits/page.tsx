import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { MapPin, Plus } from 'lucide-react'
import Link from 'next/link'
import {
  getVisitTypeLabel,
  getVisitStatusLabel,
  getVisitStatusStyle,
} from '@/lib/labels'

interface Props {
  params: { id: string }
}

export default async function CompanyVisitsPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  const company = await prisma.company.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true, name: true },
  })

  if (!company) notFound()

  const visits = await prisma.visit.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
      deleted_at: null,
    },
    include: {
      visitor: { select: { id: true, name: true } },
    },
    orderBy: { visit_date: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Besøg ({visits.length})
        </h2>
        <Link
          href={`/visits/new?company=${params.id}`}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Planlæg besøg
        </Link>
      </div>

      {visits.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">
            Ingen besøg endnu
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Planlæg dit første besøg for {company.name}.
          </p>
          <Link
            href={`/visits/new?company=${params.id}`}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Planlæg besøg
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Besøgsdato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Besøgt af
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Noter
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {visits.map((visit) => (
                <tr key={visit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/visits/${visit.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {new Date(visit.visit_date).toLocaleDateString('da-DK')}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getVisitTypeLabel(visit.visit_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getVisitStatusStyle(visit.status)}`}
                    >
                      {getVisitStatusLabel(visit.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {visit.visitor.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {visit.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
