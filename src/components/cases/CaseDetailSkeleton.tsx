export function CaseDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
        </div>
        <div className="h-9 w-32 rounded bg-muted" />
      </div>
      <div className="h-10 w-96 rounded bg-muted" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="mt-2 h-8 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
