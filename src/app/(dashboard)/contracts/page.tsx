import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { FileText } from 'lucide-react'

export default async function ContractsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const contracts = await prisma.contract.findMany({
    where: {
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      company: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kontrakter</h1>
        <p className="mt-1 text-sm text-gray-500">Alle kontrakter på tværs af selskaber</p>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen kontrakter endnu</h3>
          <p className="mt-1 text-sm text-gray-500">Opret den første kontrakt for et selskab.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Navn</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Selskab</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Udløbsdato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {contracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{contract.display_name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{contract.company.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{contract.system_type}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {contract.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {contract.expiry_date ? new Date(contract.expiry_date).toLocaleDateString('da-DK') : 'Løbende'}
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
