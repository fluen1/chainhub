export function TasksListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between gap-3 animate-pulse">
        <div className="flex gap-2">
          <div className="h-9 bg-gray-200 rounded w-36" />
          <div className="h-9 bg-gray-200 rounded w-36" />
          <div className="h-9 bg-gray-200 rounded w-44" />
          <div className="h-9 bg-gray-200 rounded w-48" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-gray-200 rounded w-28" />
          <div className="h-9 bg-gray-200 rounded w-28" />
        </div>
      </div>
      {/* Tabel skeleton */}
      <div className="rounded-lg border bg-white overflow-hidden animate-pulse">
        <div className="h-10 bg-gray-50 border-b" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-b bg-white flex items-center px-4 gap-4">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-5 bg-gray-200 rounded w-16" />
            <div className="h-5 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}