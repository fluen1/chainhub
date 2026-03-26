import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { Briefcase, Plus } from 'lucide-react'
import Link from 'next/link'
import { getCaseStatusLabel, getCaseStatusStyle } from '@/lib/labels'

interface Props {
  params: { id: string }
}

export default async function CompanyCasesPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  const caseLinks = await prisma.caseCompany.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
    },
    include: {
      case: {
        select: {
          id: true,
          title: true,
          case_type: true,
          status: true,
          created_at: true,
          deleted_at: true,
        },
      },
    },
  })

  const cases = caseLinks
    .filter((cl) => !cl.case.deleted_at)
    .map((cl) => cl.case)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sager</h2>
          <p className="text-sm text-gray-500 mt-0.5">{cases.length} sag{cases.length !== 1 ? 'er' : ''}</p>
        </div>
        <Link
          href={`/cases/new`}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Ny sag
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-10 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen sager endnu</h3>
          <p className="mt-1 text-sm text-gray-500">Opret den første sag for dette selskab.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <ul className="divide-y divide-gray-200">
            {cases.map((caseItem) => (
              <li key={caseItem.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <Link
                    href={`/cases/${caseItem.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {caseItem.title}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {caseItem.case_type} · {new Date(caseItem.created_at).toLocaleDateString('da-DK')}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCaseStatusStyle(caseItem.status)}`}>
                  {getCaseStatusLabel(caseItem.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
