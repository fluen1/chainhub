import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default async function PersonDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const person = await prisma.person.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      company_persons: {
        include: {
          company: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: { start_date: 'desc' },
      },
    },
  })

  if (!person) notFound()

  const activeRoles = person.company_persons.filter((cp) => !cp.end_date)
  const historicRoles = person.company_persons.filter((cp) => cp.end_date)

  const ROLE_LABELS: Record<string, string> = {
    direktoer: 'Direktør',
    bestyrelsesformand: 'Bestyrelsesformand',
    bestyrelsesmedlem: 'Bestyrelsesmedlem',
    tegningsberettiget: 'Tegningsberettiget',
    revisor: 'Revisor',
    ansat: 'Ansat',
    funktionaer: 'Funktionær',
    'ikke-funktionaer': 'Ikke-funktionær',
    vikar: 'Vikar',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/persons" className="mt-1 rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {person.first_name} {person.last_name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {person.email && (
              <a href={`mailto:${person.email}`} className="flex items-center gap-1 hover:text-gray-700">
                <Mail className="h-4 w-4" />
                {person.email}
              </a>
            )}
            {person.phone && (
              <a href={`tel:${person.phone}`} className="flex items-center gap-1 hover:text-gray-700">
                <Phone className="h-4 w-4" />
                {person.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Aktive tilknytninger */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Aktive tilknytninger ({activeRoles.length})
        </h2>
        {activeRoles.length === 0 ? (
          <p className="text-sm text-gray-500">Ingen aktive tilknytninger.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {activeRoles.map((cp) => (
              <li key={cp.id} className="py-3 flex items-center justify-between">
                <div>
                  <Link
                    href={`/companies/${cp.company.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {cp.company.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ROLE_LABELS[cp.role] ?? cp.role}
                    {cp.start_date && ` · fra ${new Date(cp.start_date).toLocaleDateString('da-DK')}`}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  Aktiv
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Historiske tilknytninger */}
      {historicRoles.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Tidligere tilknytninger ({historicRoles.length})
          </h2>
          <ul className="divide-y divide-gray-200">
            {historicRoles.map((cp) => (
              <li key={cp.id} className="py-3 flex items-center justify-between">
                <div>
                  <Link
                    href={`/companies/${cp.company.id}`}
                    className="text-sm font-medium text-gray-700 hover:text-blue-600"
                  >
                    {cp.company.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ROLE_LABELS[cp.role] ?? cp.role}
                    {cp.start_date && ` · ${new Date(cp.start_date).toLocaleDateString('da-DK')}`}
                    {cp.end_date && ` → ${new Date(cp.end_date).toLocaleDateString('da-DK')}`}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  Ophørt
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Noter */}
      {person.notes && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Interne noter</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{person.notes}</p>
        </div>
      )}
    </div>
  )
}
