export function PortfolioOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Summary-kort skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg border border-gray-200 bg-gray-100" />
        ))}
      </div>
      {/* Tabel skeleton */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
        <div className="divide-y divide-gray-200">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-4 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}