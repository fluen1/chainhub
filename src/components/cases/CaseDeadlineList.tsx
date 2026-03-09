'use client'

interface CaseDeadlineListProps {
  caseId: string
  initialDeadlines: unknown[]
}

export function CaseDeadlineList({ caseId, initialDeadlines }: CaseDeadlineListProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-700">Frister</h3>
      {initialDeadlines.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Ingen frister endnu.</p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{initialDeadlines.length} frist(er)</p>
      )}
    </div>
  )
}
