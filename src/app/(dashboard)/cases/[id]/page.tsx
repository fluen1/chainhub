import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CaseStatusForm } from '@/components/cases/CaseStatusForm'
import {
  getCaseStatusLabel,
  getCaseStatusStyle,
  getCaseTypeLabel,
  getPriorityLabel,
  getTaskStatusLabel,
} from '@/lib/labels'

interface Props {
  params: { id: string }
}

const NEXT_STATUSES: Record<string, string[]> = {
  NY: ['AKTIV'],
  AKTIV: ['AFVENTER_EKSTERN', 'AFVENTER_KLIENT', 'LUKKET'],
  AFVENTER_EKSTERN: ['AKTIV', 'LUKKET'],
  AFVENTER_KLIENT: ['AKTIV', 'LUKKET'],
  LUKKET: ['AKTIV', 'ARKIVERET'],
}

export default async function CaseDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const caseItem = await prisma.case.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      case_companies: {
        include: { company: { select: { id: true, name: true } } },
      },
      case_contracts: {
        include: {
          contract: { select: { id: true, display_name: true, system_type: true } },
        },
      },
      case_persons: {
        include: {
          person: { select: { id: true, first_name: true, last_name: true } },
        },
      },
      tasks: {
        where: { deleted_at: null },
        orderBy: { due_date: 'asc' },
      },
    },
  })

  if (!caseItem) notFound()

  // Tjek adgang til mindst ét tilknyttet selskab
  let hasAccess = false
  for (const cc of caseItem.case_companies) {
    const ok = await canAccessCompany(session.user.id, cc.company.id)
    if (ok) { hasAccess = true; break }
  }
  if (!hasAccess) notFound()

  const nextStatuses = NEXT_STATUSES[caseItem.status] ?? []
  // Sagsnummer er første linje i description-feltet
  const descriptionLines = caseItem.description?.split('\n') ?? []
  const caseNumber = descriptionLines[0]?.startsWith('CAS-') ? descriptionLines[0] : ''
  const descriptionText = caseNumber
    ? descriptionLines.slice(1).join('\n').trim()
    : caseItem.description ?? ''

  const openTasks = caseItem.tasks.filter((t) => t.status !== 'LUKKET')
  const today = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/cases" className="mt-1 rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{caseItem.title}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCaseStatusStyle(caseItem.status)}`}>
              {getCaseStatusLabel(caseItem.status)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {caseNumber && <span className="font-medium text-gray-700">{caseNumber}</span>}
            {caseNumber && ' · '}
            {getCaseTypeLabel(caseItem.case_type)}
            {caseItem.case_subtype && ` → ${caseItem.case_subtype}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Hoved-panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sagsoverblik */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Sagsdetaljer</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Sensitivitet</dt>
                <dd className="mt-1 text-sm text-gray-900">{caseItem.sensitivity}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Oprettet</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(caseItem.created_at).toLocaleDateString('da-DK')}
                </dd>
              </div>
            </dl>
            {descriptionText && (
              <div className="mt-4 pt-4 border-t">
                <dt className="text-sm font-medium text-gray-500">Beskrivelse</dt>
                <dd className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{descriptionText}</dd>
              </div>
            )}
          </div>

          {/* Tilknyttede selskaber */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Selskaber ({caseItem.case_companies.length})
            </h2>
            <ul className="space-y-2">
              {caseItem.case_companies.map((cc) => (
                <li key={cc.company.id}>
                  <Link
                    href={`/companies/${cc.company.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {cc.company.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Opgaver */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                Opgaver ({openTasks.length} åbne)
              </h2>
              <Link
                href={`/tasks/new?caseId=${caseItem.id}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Ny opgave
              </Link>
            </div>
            {caseItem.tasks.length === 0 ? (
              <p className="text-sm text-gray-500">Ingen opgaver tilknyttet endnu.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {caseItem.tasks.map((task) => {
                  const isOverdue = task.due_date && new Date(task.due_date) < today && task.status !== 'LUKKET'
                  return (
                    <li key={task.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${isOverdue ? 'text-red-700' : 'text-gray-900'}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {task.due_date ? new Date(task.due_date).toLocaleDateString('da-DK') : 'Ingen deadline'}
                          {task.priority && ` · ${getPriorityLabel(task.priority)}`}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {getTaskStatusLabel(task.status)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Tilknyttede kontrakter */}
          {caseItem.case_contracts.length > 0 && (
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Kontrakter ({caseItem.case_contracts.length})
              </h2>
              <ul className="space-y-2">
                {caseItem.case_contracts.map((cc) => (
                  <li key={cc.contract.id}>
                    <Link
                      href={`/contracts/${cc.contract.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {cc.contract.display_name}
                    </Link>
                    <span className="ml-2 text-xs text-gray-400">{cc.contract.system_type}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Side-panel */}
        <div className="space-y-6">
          {nextStatuses.length > 0 && (
            <CaseStatusForm
              caseId={caseItem.id}
              currentStatus={caseItem.status}
              nextStatuses={nextStatuses}
            />
          )}

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Parter</h3>
            {caseItem.case_persons.length === 0 ? (
              <p className="text-xs text-gray-400">Ingen parter tilknyttet</p>
            ) : (
              <ul className="space-y-1">
                {caseItem.case_persons.map((cp) => (
                  <li key={cp.person.id}>
                    <Link
                      href={`/persons/${cp.person.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {cp.person.first_name} {cp.person.last_name}
                    </Link>
                    {cp.role && <span className="ml-1 text-xs text-gray-400">({cp.role})</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
