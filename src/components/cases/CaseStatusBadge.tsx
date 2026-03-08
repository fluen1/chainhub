import { cn } from '@/lib/utils'
import type { CaseStatus } from '@prisma/client'
import { CASE_STATUS_LABELS } from '@/types/case'

interface CaseStatusBadgeProps {
  status: CaseStatus
  className?: string
}

const STATUS_STYLES: Record<CaseStatus, string> = {
  NY: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  AKTIV: 'bg-green-50 text-green-700 ring-green-600/20',
  AFVENTER_EKSTERN: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  AFVENTER_KLIENT: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  LUKKET: 'bg-gray-50 text-gray-600 ring-gray-500/20',
  ARKIVERET: 'bg-gray-100 text-gray-500 ring-gray-400/20',
}

export function CaseStatusBadge({ status, className }: CaseStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLES[status],
        className
      )}
    >
      {CASE_STATUS_LABELS[status]}
    </span>
  )
}