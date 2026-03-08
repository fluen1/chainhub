import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getCase } from '@/actions/cases'
import { CaseDetailClient } from '@/components/cases/CaseDetailClient'
import { CaseDetailSkeleton } from '@/components/cases/CaseDetailSkeleton'

export const metadata = {
  title: 'Sagsdetalje — ChainHub',
}

interface CasePageProps {
  params: { caseId: string }
}

export default async function CasePage({ params }: CasePageProps) {
  return (
    <Suspense fallback={<CaseDetailSkeleton />}>
      <CasePageServer caseId={params.caseId} />
    </Suspense>
  )
}

async function CasePageServer({ caseId }: { caseId: string }) {
  const result = await getCase({ caseId })

  if (result.error === 'Sagen blev ikke fundet') {
    notFound()
  }

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{result.error}</p>
      </div>
    )
  }

  return <CaseDetailClient caseData={result.data} />
}