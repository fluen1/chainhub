export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-40 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-64 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-32 rounded-md bg-gray-200" />
      </div>

      {/* Filter skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-10 flex-1 rounded-lg bg-gray-100" />
        <div className="h-10 w-24 rounded-lg bg-gray-100" />
        <div className="h-10 w-24 rounded-lg bg-gray-100" />
      </div>

      {/* Rows skeleton */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-0">
            <div className="h-9 w-9 rounded-md bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/5 rounded bg-gray-100" />
              <div className="h-3 w-2/5 rounded bg-gray-50" />
            </div>
            <div className="h-6 w-16 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="p-5 h-full animate-pulse">
      <div className="grid grid-cols-[1fr_320px] gap-5 max-w-[1400px] mx-auto">
        {/* Timeline skeleton */}
        <div className="space-y-4">
          <div className="h-4 w-20 rounded bg-gray-200" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="h-7 w-7 rounded-md bg-gray-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-3/4 rounded bg-gray-100" />
                <div className="h-3 w-1/2 rounded bg-gray-50" />
              </div>
            </div>
          ))}
        </div>

        {/* Right panels skeleton */}
        <div className="space-y-3">
          <div className="h-32 rounded-lg bg-white border border-gray-200" />
          <div className="h-64 rounded-lg bg-white border border-gray-200" />
          <div className="h-24 rounded-lg bg-white border border-gray-200" />
        </div>
      </div>
    </div>
  )
}
