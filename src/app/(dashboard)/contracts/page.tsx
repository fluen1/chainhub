import { Suspense } from 'react'
import { listContracts } from '@/actions/contracts'
import { ContractList } from '@/components/contracts/ContractList'
import { ContractListSkeleton } from '@/components/contracts/ContractListSkeleton'

export const metadata = {
  title: 'Kontrakter — ChainHub',
}

export default async function ContractsPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kontrakter</h1>
        <p className="text-sm text-gray-500 mt-1">
          Oversigt over alle kontrakter på tværs af dine selskaber
        </p>
      </div>
      <Suspense fallback={<ContractListSkeleton />}>
        <ContractListWrapper />
      </Suspense>
    </div>
  )
}

async function ContractListWrapper() {
  const result = await listContracts({ page: 1, pageSize: 20 })

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {result.error}
      </div>
    )
  }

  return (
    <ContractList
      contracts={result.data!.contracts}
      total={result.data!.total}
    />
  )
}