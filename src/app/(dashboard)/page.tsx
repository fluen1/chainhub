import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/actions/dashboard'
import { PortfolioOverview } from '@/components/dashboard/PortfolioOverview'
import { PortfolioOverviewSkeleton } from '@/components/dashboard/PortfolioOverviewSkeleton'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Portfolio-overblik</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overblik over alle selskaber, ejerandele, aktive sager og kontrakter
        </p>
      </div>

      <Suspense fallback={<PortfolioOverviewSkeleton />}>
        <PortfolioOverviewLoader />
      </Suspense>
    </div>
  )
}

async function PortfolioOverviewLoader() {
  const result = await getDashboardData()

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {result.error}
      </div>
    )
  }

  return <PortfolioOverview data={result.data!} />
}