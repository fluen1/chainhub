'use client'

interface CaseContractListProps {
  caseId: string
  initialContracts: unknown[]
}

export function CaseContractList({ caseId, initialContracts }: CaseContractListProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-700">Tilknyttede kontrakter</h3>
      {initialContracts.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Ingen kontrakter tilknyttet.</p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{initialContracts.length} kontrakt(er)</p>
      )}
    </div>
  )
}
