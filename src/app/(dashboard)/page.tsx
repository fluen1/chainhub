import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard'
import { PortfolioDashboardSkeleton } from '@/components/portfolio/PortfolioDashboardSkeleton'
import { getPortfolioData } from '@/actions/portfolio'

interface DashboardPageProps {
  searchParams: {
    status?: string
    minEjerandel?: string
    maxEjerandel?: string
    harAktiveSager?: string
    harUdloebende?: string
    page?: string
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const filters = {
    status: searchParams.status,
    minEjerandel: searchParams.minEjerandel ? Number(searchParams.minEjerandel) : undefined,
    maxEjerandel: searchParams.maxEjerandel ? Number(searchParams.maxEjerandel) : undefined,
    harAktiveSager: searchParams.harAktiveSager === 'true',
    harUdloebende: searchParams.harUdloebende === 'true',
    page: searchParams.page ? Math.max(1, Number(searchParams.page)) : 1,
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Portfolio-overblik</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overblik over alle selskaber, ejerandele, aktive sager og kontrakter
        </p>
      </div>

      <Suspense fallback={<PortfolioDashboardSkeleton />}>
        <PortfolioDashboardLoader filters={filters} />
      </Suspense>
    </div>
  )
}

async function PortfolioDashboardLoader({
  filters,
}: {
  filters: {
    status?: string
    minEjerandel?: number
    maxEjerandel?: number
    harAktiveSager?: boolean
    harUdloebende?: boolean
    page: number
  }
}) {
  const result = await getPortfolioData(filters)

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {result.error}
      </div>
    )
  }

  return <PortfolioDashboard data={result.data!} filters={filters} />
}