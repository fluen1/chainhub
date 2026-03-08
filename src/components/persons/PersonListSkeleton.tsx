export function PersonListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Search skeleton */}
      <div className="flex gap-4">
        <div className="h-10 w-64 animate-pulse rounded-md bg-gray-200" />
        <div className="h-10 w-40 animate-pulse rounded-md bg-gray-200" />
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}