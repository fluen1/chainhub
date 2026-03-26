import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import {
  getVisitTypeLabel,
  getVisitStatusLabel,
  getVisitStatusStyle,
} from '@/lib/labels'
import { VisitStatusForm } from '@/components/visits/VisitStatusForm'
import { VisitNotesForm } from '@/components/visits/VisitNotesForm'

interface Props {
  params: { id: string }
}

export default async function VisitDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const visit = await prisma.visit.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      company: { select: { id: true, name: true } },
      visitor: { select: { id: true, name: true } },
    },
  })

  if (!visit) notFound()

  const hasAccess = await canAccessCompany(session.user.id, visit.company_id)
  if (!hasAccess) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/visits" className="mt-1 rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              Besøg hos {visit.company.name}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getVisitStatusStyle(visit.status)}`}
            >
              {getVisitStatusLabel(visit.status)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {new Date(visit.visit_date).toLocaleDateString('da-DK', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Hoved-panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Besøgsdetaljer */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Besøgsdetaljer
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Selskab</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <Link
                    href={`/companies/${visit.company.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {visit.company.name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Besøgsdato
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(visit.visit_date).toLocaleDateString('da-DK')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Type</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {getVisitTypeLabel(visit.visit_type)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Besøgt af
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {visit.visitor.name}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Oprettet</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(visit.created_at).toLocaleDateString('da-DK')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Noter + opsummering */}
          <VisitNotesForm
            visitId={visit.id}
            initialNotes={visit.notes ?? ''}
            initialSummary={visit.summary ?? ''}
            showSummary={visit.status === 'GENNEMFOERT'}
          />
        </div>

        {/* Side-panel */}
        <div className="space-y-6">
          <VisitStatusForm
            visitId={visit.id}
            currentStatus={visit.status}
          />

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Hurtige handlinger
            </h3>
            <div className="space-y-2">
              <Link
                href={`/companies/${visit.company.id}`}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Gå til selskab
              </Link>
              <Link
                href={`/companies/${visit.company.id}/visits`}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Se alle besøg for selskabet
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
