import { notFound } from 'next/navigation'
import { getContract } from '@/actions/contracts'
import { ContractDetail } from '@/components/contracts/ContractDetail'

interface Props {
  params: { contractId: string }
}

export default async function ContractPage({ params }: Props) {
  const result = await getContract({ contractId: params.contractId })

  if (result.error) {
    if (
      result.error.includes('ikke fundet') ||
      result.error.includes('ikke adgang')
    ) {
      notFound()
    }
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {result.error}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <ContractDetail contract={result.data} />
    </div>
  )
}