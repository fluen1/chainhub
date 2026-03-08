import { Suspense } from 'react'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { DashboardContent } from '@/components/dashboard/DashboardContent'

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Overblik</h1>
        <p className="mt-1 text-sm text-gray-500">
          Velkommen til ChainHub — dit samlede overblik over porteføljen
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}