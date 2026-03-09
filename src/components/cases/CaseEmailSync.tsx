'use client'

interface CaseEmailSyncProps {
  caseId: string
}

export function CaseEmailSync({ caseId }: CaseEmailSyncProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-700">Email-synkronisering</h3>
      <p className="mt-2 text-sm text-gray-500">Email-synkronisering er ikke konfigureret endnu.</p>
    </div>
  )
}
