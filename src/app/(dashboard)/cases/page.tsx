import { Suspense } from 'react'
import { listCases } from '@/actions/cases'
import { CaseListClient } from '@/components/cases/CaseListClient'
import { CaseListSkeleton } from '@/components/cases/CaseListSkeleton'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Sager — ChainHub',
}

export default async function CasesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sager</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrér sager på tværs af selskaber og kontrakter
          </p>
        </div>
        <Link href="/cases/new">
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Opret sag
          </Button>
        </Link>
      </div>

      {/* Liste */}
      <Suspense fallback={<CaseListSkeleton />}>
        <CaseListServer />
      </Suspense>
    </div>
  )
}

async function CaseListServer() {
  const result = await listCases({
    page: 1,
    pageSize: 25,
    sortBy: 'updatedAt',
    sortDir: 'desc',
  })

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{result.error}</p>
      </div>
    )
  }

  return <CaseListClient initialCases={result.data!.cases} totalCount={result.data!.total} />
}