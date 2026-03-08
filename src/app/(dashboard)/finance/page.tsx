import { Wallet, TrendingUp } from 'lucide-react'

export default function FinancePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Økonomi</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overblik over økonomi på tværs af dine selskaber
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4">
            <Wallet className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Ingen økonomiske data endnu</h3>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Økonomisk overblik vises her når du har tilføjet selskaber med nøgletal
          </p>
        </div>
      </div>
    </div>
  )
}