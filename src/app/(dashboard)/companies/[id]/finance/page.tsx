import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import { AddMetricForm } from '@/components/finance/AddMetricForm'
import { FinanceList } from '@/components/finance/FinanceList'

interface Props {
  params: { id: string }
}

export default async function CompanyFinancePage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasFinance = await canAccessModule(session.user.id, 'finance')
  if (!hasFinance) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
        <p className="text-sm text-gray-500">
          Du har ikke adgang til økonomi-modulet.
        </p>
      </div>
    )
  }

  // Layout already checks canAccessCompany
  const metrics = await prisma.financialMetric.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
    },
    orderBy: [{ period_year: 'desc' }, { metric_type: 'asc' }],
  })

  const years = Array.from(new Set(metrics.map((m) => m.period_year))).sort((a, b) => b - a)

  return (
    <FinanceList
      metrics={metrics}
      years={years}
      addButton={<AddMetricForm companyId={params.id} />}
    />
  )
}
