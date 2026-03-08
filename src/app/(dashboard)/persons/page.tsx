import { Users, Plus } from 'lucide-react'

export default function PersonsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Personer</h1>
          <p className="mt-1 text-sm text-gray-500">
            Central kontaktbog på tværs af alle selskaber
          </p>
        </div>
        <a
          href="/dashboard/persons/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Tilføj person
        </a>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Ingen personer endnu</h3>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Tilføj din første person for at opbygge kontaktbogen
          </p>
          <a
            href="/dashboard/persons/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Tilføj person
          </a>
        </div>
      </div>
    </div>
  )
}