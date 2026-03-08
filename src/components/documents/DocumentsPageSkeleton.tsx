export function DocumentsPageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Toolbar skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-64 rounded-lg bg-gray-200" />
        <div className="h-10 w-40 rounded-lg bg-gray-200" />
        <div className="h-10 w-40 rounded-lg bg-gray-200" />
        <div className="ml-auto h-10 w-32 rounded-lg bg-gray-200" />
      </div>

      {/* Document list skeleton */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-gray-100 bg-white p-4"
        >
          <div className="h-10 w-10 rounded bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-gray-200" />
            <div className="h-3 w-32 rounded bg-gray-200" />
          </div>
          <div className="h-6 w-20 rounded-full bg-gray-200" />
          <div className="h-8 w-8 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}