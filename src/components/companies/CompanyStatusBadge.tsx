import { cn } from '@/lib/utils'

interface CompanyStatusBadgeProps {
  status: string
}

const STATUS_STYLES: Record<string, string> = {
  aktiv: 'bg-green-50 text-green-700',
  under_stiftelse: 'bg-yellow-50 text-yellow-700',
  under_afvikling: 'bg-orange-50 text-orange-700',
  solgt: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<string, string> = {
  aktiv: 'Aktiv',
  under_stiftelse: 'Under stiftelse',
  under_afvikling: 'Under afvikling',
  solgt: 'Solgt',
}

export function CompanyStatusBadge({ status }: CompanyStatusBadgeProps) {
  const styles = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
  const label = STATUS_LABELS[status] ?? status

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles
      )}
    >
      {label}
    </span>
  )
}
