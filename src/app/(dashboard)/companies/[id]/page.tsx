import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string }
}) {
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
    include: {
      ownerships: {
        include: { owner_person: true },
      },
      company_persons: {
        include: { person: true },
      },
      _count: {
        select: {
          contracts: { where: { deleted_at: null } },
          cases: true,
          documents: { where: { deleted_at: null } },
        },
      },
    },
  })

  if (!company) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/companies" className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
          <p className="text-sm text-gray-500">
            {company.cvr ? `CVR: ${company.cvr}` : 'Intet CVR registreret'} · {company.company_type || 'Ukendt selskabsform'}
          </p>
        </div>
        <span className="ml-auto inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
          {company.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Kontrakter</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{company._count.contracts}</p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Sager</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{company._count.cases}</p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Dokumenter</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{company._count.documents}</p>
        </div>
      </div>

      {/* Stamdata */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Stamdata</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Adresse</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.address || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">By</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.postal_code} {company.city || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Stiftelsesdato</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {company.founded_date ? new Date(company.founded_date).toLocaleDateString('da-DK') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Selskabsform</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.company_type || '—'}</dd>
          </div>
        </dl>
        {company.notes && (
          <div className="mt-4 pt-4 border-t">
            <dt className="text-sm font-medium text-gray-500">Noter</dt>
            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{company.notes}</dd>
          </div>
        )}
      </div>

      {/* Ejerskab */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ejerskab</h2>
        {company.ownerships.length === 0 ? (
          <p className="text-sm text-gray-500">Ingen ejere registreret endnu.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Ejer</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Ejerandel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {company.ownerships.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {o.owner_person ? `${o.owner_person.first_name} ${o.owner_person.last_name}` : 'Selskab'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">{Number(o.ownership_pct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Personale */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Personale & roller</h2>
        {company.company_persons.length === 0 ? (
          <p className="text-sm text-gray-500">Ingen personale registreret endnu.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Navn</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Rolle</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Startdato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {company.company_persons.map((cp) => (
                <tr key={cp.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {cp.person.first_name} {cp.person.last_name}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">{cp.role}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {cp.start_date ? new Date(cp.start_date).toLocaleDateString('da-DK') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
