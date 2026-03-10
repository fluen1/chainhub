import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Users } from 'lucide-react'

export default async function PersonsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const persons = await prisma.person.findMany({
    where: {
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      _count: {
        select: {
          company_persons: true,
          contract_parties: true,
        },
      },
    },
    orderBy: { last_name: 'asc' },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Personer</h1>
        <p className="mt-1 text-sm text-gray-500">Central kontaktbog på tværs af selskaber</p>
      </div>

      {persons.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen personer endnu</h3>
          <p className="mt-1 text-sm text-gray-500">Tilføj din første person.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Navn</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Telefon</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tilknytninger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {persons.map((person) => (
                <tr key={person.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                    {person.first_name} {person.last_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{person.email || '—'}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{person.phone || '—'}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {person._count.company_persons} selskaber, {person._count.contract_parties} kontrakter
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
