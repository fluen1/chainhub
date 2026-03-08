'use client'

import { ContractStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

interface ContractStatusBadgeProps {
  status: ContractStatus
  className?: string
}

const STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  UDKAST: {
    label: 'Udkast',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  TIL_REVIEW: {
    label: 'Til review',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  TIL_UNDERSKRIFT: {
    label: 'Til underskrift',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  AKTIV: {
    label: 'Aktiv',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  UDLOEBET: {
    label: 'Udløbet',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  OPSAGT: {
    label: 'Opsagt',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  FORNYET: {
    label: 'Fornyet',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  ARKIVERET: {
    label: 'Arkiveret',
    className: 'bg-slate-100 text-slate-800 border-slate-200',
  },
}

export function ContractStatusBadge({ status, className }: ContractStatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}