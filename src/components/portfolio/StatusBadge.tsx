import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  aktiv: 'Aktiv',
  inaktiv: 'Inaktiv',
  under_stiftelse: 'Under stiftelse',
  opløst: 'Opløst',
}

const STATUS_STYLES: Record<string, string> = {
  aktiv: 'bg-green-100 text-green-800',
  inaktiv: 'bg-gray-100 text-gray-600',
  under_stiftelse: 'bg-blue-100 text-blue-800',
  opløst: 'bg-red-100 text-red-800',
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        style
      )}
    >
      {label}
    </span>
  )
}