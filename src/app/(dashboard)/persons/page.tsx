import { Suspense } from 'react'
import { listPersons } from '@/actions/persons'
import PersonList from '@/components/persons/PersonList'
import PersonListSkeleton from '@/components/persons/PersonListSkeleton'
import CreatePersonButton from '@/components/persons/CreatePersonButton'
import OutlookImport from '@/components/persons/OutlookImport'

export const metadata = {
  title: 'Persondatabase — ChainHub',
}

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; company?: string }>
}

export default async function PersonsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search ?? ''
  const page = parseInt(params.page ?? '1', 10)
  const companyId = params.company

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Persondatabase</h1>
          <p className="mt-1 text-sm text-gray-500">
            Global kontaktbog — én person kan have roller i flere selskaber
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OutlookImport />
          <CreatePersonButton />
        </div>
      </div>

      <Suspense fallback={<PersonListSkeleton />}>
        <PersonListWrapper
          search={search}
          page={page}
          companyId={companyId}
        />
      </Suspense>
    </div>
  )
}

async function PersonListWrapper({
  search,
  page,
  companyId,
}: {
  search: string
  page: number
  companyId?: string
}) {
  const result = await listPersons({ search, page, pageSize: 25, companyId })

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{result.error}</p>
      </div>
    )
  }

  return (
    <PersonList
      persons={result.data.persons}
      total={result.data.total}
      currentPage={page}
      pageSize={25}
      search={search}
    />
  )
}