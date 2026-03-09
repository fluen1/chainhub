'use client'

interface CaseCompanyListProps {
  caseId: string
  initialCompanies: unknown[]
}

export function CaseCompanyList({ caseId, initialCompanies }: CaseCompanyListProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-700">Tilknyttede selskaber</h3>
      {initialCompanies.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Ingen selskaber tilknyttet.</p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{initialCompanies.length} selskab(er)</p>
      )}
    </div>
  )
}
