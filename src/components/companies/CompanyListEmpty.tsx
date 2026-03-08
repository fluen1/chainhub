import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'

export function CompanyListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Building2 className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-gray-900">
        Ingen selskaber endnu
      </h3>
      <p className="mb-6 max-w-sm text-sm text-gray-500">
        Opret dit første selskab for at komme i gang med at administrere
        kontrakter, ejerskab og governance.
      </p>
      <Link
        href="/companies/new"
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Opret selskab
      </Link>
    </div>
  )
}