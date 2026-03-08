import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-2 h-4 w-20" />
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-gray-200 py-4">
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-8" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Charts/tables skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <Skeleton className="h-5 w-40" />
          <div className="mt-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRowSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <Skeleton className="h-5 w-40" />
          <div className="mt-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}