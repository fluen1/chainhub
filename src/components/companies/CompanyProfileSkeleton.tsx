export function CompanyProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-24 rounded bg-gray-200" />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded bg-gray-100" />
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="h-5 w-36 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Section */}
      <div className="space-y-3">
        <div className="h-5 w-32 rounded bg-gray-200" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100" />
        ))}
      </div>
    </div>
  )
}