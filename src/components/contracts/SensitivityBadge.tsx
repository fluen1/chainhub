import { cn } from '@/lib/utils'
import type { SensitivityLevel } from '@prisma/client'

const SENSITIVITY_CONFIG: Record<
  SensitivityLevel,
  { label: string; className: string }
> = {
  PUBLIC: {
    label: 'Offentlig',
    className: 'bg-gray-50 text-gray-600 border border-gray-200',
  },
  STANDARD: {
    label: 'Standard',
    className: 'bg-blue-50 text-blue-700 border border-blue-100',
  },
  INTERN: {
    label: 'Intern',
    className: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  },
  FORTROLIG: {
    label: 'Fortrolig',
    className: 'bg-amber-50 text-amber-700 border border-amber-100',
  },
  STRENGT_FORTROLIG: {
    label: 'Strengt fortrolig',
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
}

interface Props {
  level: SensitivityLevel
  className?: string
}

export function SensitivityBadge({ level, className }: Props) {
  const config = SENSITIVITY_CONFIG[level]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}