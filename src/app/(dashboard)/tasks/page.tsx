import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { CheckSquare } from 'lucide-react'

export default async function TasksPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const tasks = await prisma.task.findMany({
    where: {
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      assignee: { select: { name: true } },
    },
    orderBy: { due_date: 'asc' },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Opgaver</h1>
        <p className="mt-1 text-sm text-gray-500">Administrer og følg op på opgaver</p>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <CheckSquare className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen opgaver endnu</h3>
          <p className="mt-1 text-sm text-gray-500">Opret din første opgave.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Titel</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ansvarlig</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Deadline</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Prioritet</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {tasks.map((task) => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'LUKKET'
                return (
                  <tr key={task.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{task.title}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{task.assignee?.name || '—'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString('da-DK') : '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{task.priority}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {task.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
