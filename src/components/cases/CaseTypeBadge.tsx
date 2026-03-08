import { cn } from '@/lib/utils'
import type { SagsType } from '@prisma/client'
import { CASE_TYPE_LABELS } from '@/types/case'

interface CaseTypeBadgeProps {
  caseType: SagsType
  className?: string
}

const TYPE_STYLES: Record<SagsType, string> = {
  TRANSAKTION: 'bg-purple-50 text-purple-700',
  TVIST: 'bg-red-50 text-red-700',
  COMPLIANCE: 'bg-blue-50 text-blue-700',
  KONTRAKT: 'bg-indigo-50 text-indigo-700',
  GOVERNANCE: 'bg-teal-50 text-teal-700',
  ANDET: 'bg-gray-50 text-gray-600',
}

export function CaseTypeBadge({ caseType, className }: CaseTypeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        TYPE_STYLES[caseType],
        className
      )}
    >
      {CASE_TYPE_LABELS[caseType]}
    </span>
  )
}