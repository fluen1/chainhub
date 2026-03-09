'use client'

interface CasePersonListProps {
  caseId: string
  initialPersons: unknown[]
}

export function CasePersonList({ caseId, initialPersons }: CasePersonListProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-700">Tilknyttede personer</h3>
      {initialPersons.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Ingen personer tilknyttet.</p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{initialPersons.length} person(er)</p>
      )}
    </div>
  )
}
