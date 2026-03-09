export function PortfolioDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="h-12 w-12 rounded-lg bg-gray-200" />
            <div className="flex flex-col gap-2">
              <div className="h-7 w-12 rounded bg-gray-200" />
              <div className="h-4 w-28 rounded bg-gray-200" />
              <div className="h-3 w-20 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-32 rounded-lg bg-gray-200" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-3">
          <div className="flex gap-6">
            {[200, 80, 80, 80, 120, 80].map((w, i) => (
              <div key={i} className={`h-4 w-${w < 100 ? `${w / 4}` : '48'} rounded bg-gray-200`} />
            ))}
          </div>
        </div>
        {/* Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div
            key={i}
            className="flex items-center gap-6 border-t border-gray-200 px-6 py-4"
          >
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="h-4 w-48 rounded bg-gray-200" />
              <div className="h-3 w-32 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-16 rounded-full bg-gray-200" />
            <div className="h-4 w-12 rounded bg-gray-200" />
            <div className="h-5 w-8 rounded-full bg-gray-200 mx-auto" />
            <div className="h-5 w-8 rounded-full bg-gray-200 mx-auto" />
            <div className="h-4 w-6 rounded bg-gray-200 mx-auto" />
            <div className="h-4 w-10 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  )
}