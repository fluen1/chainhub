import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Briefcase } from 'lucide-react'

export default async function CasesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const cases = await prisma.case.findMany({
    where: {
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sager</h1>
        <p className="mt-1 text-sm text-gray-500">Administrer sager på tværs af selskaber</p>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen sager endnu</h3>
          <p className="mt-1 text-sm text-gray-500">Opret den første sag for at komme i gang.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Titel</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Oprettet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{c.title}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{c.case_type}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {c.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(c.created_at).toLocaleDateString('da-DK')}
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
