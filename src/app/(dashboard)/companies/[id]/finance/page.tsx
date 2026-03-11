import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule } from '@/lib/permissions'
import { AddMetricForm } from '@/components/finance/AddMetricForm'

interface Props {
  params: { id: string }
}

const METRIC_LABELS: Record<string, string> = {
  OMSAETNING: 'Omsætning',
  EBITDA: 'EBITDA',
  RESULTAT: 'Resultat',
  LIKVIDITET: 'Likviditet',
  EGENKAPITAL: 'Egenkapital',
  ANDET: 'Andet',
}

const SOURCE_LABELS: Record<string, string> = {
  REVIDERET: 'Revideret',
  UREVIDERET: 'Urevideret',
  ESTIMAT: 'Estimat',
}

export default async function CompanyFinancePage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  const hasFinance = await canAccessModule(session.user.id, 'finance')
  if (!hasFinance) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center">
        <p className="text-sm text-gray-500">
          Du har ikke adgang til økonomi-modulet.
        </p>
      </div>
    )
  }

  const metrics = await prisma.financialMetric.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
    },
    orderBy: [{ period_year: 'desc' }, { metric_type: 'asc' }],
  })

  // Gruppér pr. år
  const byYear = metrics.reduce<Record<number, typeof metrics>>((acc, m) => {
    const year = m.period_year
    if (!acc[year]) acc[year] = []
    acc[year].push(m)
    return acc
  }, {})

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Økonomi-overblik</h2>
          <p className="text-sm text-gray-500 mt-0.5">Nøgletal og registreringer</p>
        </div>
        <AddMetricForm companyId={params.id} />
      </div>

      {years.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-10 text-center">
          <p className="text-sm text-gray-500">Ingen nøgletal registreret endnu.</p>
          <p className="mt-1 text-xs text-gray-400">Klik &quot;Tilføj nøgletal&quot; for at komme i gang.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <div key={year} className="rounded-lg border bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b">
                <h3 className="text-sm font-semibold text-gray-900">{year}</h3>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Nøgletal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Periode</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Beløb (DKK)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Kilde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {byYear[year].map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {METRIC_LABELS[m.metric_type] ?? m.metric_type}
                        {m.notes && (
                          <p className="text-xs text-gray-400 mt-0.5">{m.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{m.period_type}</td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                        {Number(m.value).toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.source === 'REVIDERET' ? 'bg-green-50 text-green-700'
                          : m.source === 'ESTIMAT' ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                          {SOURCE_LABELS[m.source] ?? m.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
