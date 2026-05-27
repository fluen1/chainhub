export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-b-surface" />
      <div className="flex flex-col gap-4">
        <div className="h-40 animate-pulse rounded-lg bg-b-surface" />
        <div className="h-40 animate-pulse rounded-lg bg-b-surface" />
      </div>
    </div>
  )
}
