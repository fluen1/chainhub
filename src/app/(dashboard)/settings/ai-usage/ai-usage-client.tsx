'use client'

import type { AIUsageDashboardData } from '@/actions/ai-usage'
import { formatDate, labelForAIFeature } from '@/lib/labels'

interface Props {
  data: AIUsageDashboardData
}

export function AIUsageClient({ data }: Props) {
  const progressColor =
    data.threshold === 'exceeded'
      ? 'bg-red-600'
      : data.threshold === '90-alert'
        ? 'bg-red-500'
        : data.threshold === '75-warn'
          ? 'bg-amber-500'
          : data.threshold === '50-info'
            ? 'bg-blue-500'
            : 'bg-emerald-500'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">AI-forbrug denne måned</h1>
        <p className="text-sm text-gray-500 mt-1">
          Samlet forbrug på tværs af alle AI-features i indeværende kalendermåned.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-3xl font-semibold text-gray-900">
              ${data.totalCostUsd.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">denne måned</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-700">Cap: ${data.capUsd.toFixed(2)}</div>
            <div className="text-xs text-gray-500">{data.percentage}% brugt</div>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all`}
            style={{ width: `${Math.min(100, data.percentage)}%` }}
          />
        </div>
        {data.threshold === 'exceeded' && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Månedlig cap er nået. AI-kald afvises indtil ny måned eller cap øges.
          </div>
        )}
        {data.threshold === '90-alert' && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Over 90% af månedlig cap brugt. Overvej at hæve cap.
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Pr. feature</h2>
        {data.byFeature.length === 0 ? (
          <div className="text-sm text-gray-500">Intet AI-forbrug endnu denne måned.</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {data.byFeature.map((row) => (
              <div key={row.feature} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700">{labelForAIFeature(row.feature)}</span>
                <span className="text-sm font-medium text-gray-900 tabular-nums">
                  ${row.costUsd.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Pr. model</h2>
        {data.byModel.length === 0 ? (
          <div className="text-sm text-gray-500">Ingen model-aktivitet endnu.</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {data.byModel.map((row) => (
              <div key={row.model} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700 font-mono">{row.model}</span>
                <span className="text-sm font-medium text-gray-900 tabular-nums">
                  ${row.costUsd.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Seneste 25 kald</h2>
        {data.recent.length === 0 ? (
          <div className="text-sm text-gray-500">Ingen kald registreret endnu.</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Tidspunkt</th>
                  <th className="px-4 py-2 text-left">Feature</th>
                  <th className="px-4 py-2 text-left">Model</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recent.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 text-gray-600">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-2 text-gray-700">{labelForAIFeature(row.feature)}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{row.model}</td>
                    <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                      ${row.costUsd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
