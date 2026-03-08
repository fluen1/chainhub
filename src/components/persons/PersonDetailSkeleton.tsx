export function PersonDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded-md bg-gray-200" />
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
              <div className="h-5 w-64 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded-md bg-gray-200" />
          <div className="h-10 w-20 animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact info skeleton */}
        <div className="rounded-lg border p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-6 space-y-4">
            <div className="flex gap-3">
              <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
              <div className="space-y-1">
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
              <div className="space-y-1">
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Roles skeleton */}
        <div className="rounded-lg border p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="h-9 w-32 animate-pulse rounded-md bg-gray-200" />
          </div>
          <div className="mt-6 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                  <div className="space-y-2">
                    <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
                    <div className="flex gap-2">
                      <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
                      <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}