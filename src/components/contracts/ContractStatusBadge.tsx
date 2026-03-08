import { cn } from '@/lib/utils'
import type { ContractStatus } from '@prisma/client'

const STATUS_CONFIG: Record<
  ContractStatus,
  { label: string; className: string }
> = {
  UDKAST: {
    label: 'Udkast',
    className: 'bg-gray-100 text-gray-700',
  },
  TIL_REVIEW: {
    label: 'Til gennemgang',
    className: 'bg-yellow-100 text-yellow-700',
  },
  TIL_UNDERSKRIFT: {
    label: 'Til underskrift',
    className: 'bg-blue-100 text-blue-700',
  },
  AKTIV: {
    label: 'Aktiv',
    className: 'bg-green-100 text-green-700',
  },
  UDLOEBET: {
    label: 'Udløbet',
    className: 'bg-orange-100 text-orange-700',
  },
  OPSAGT: {
    label: 'Opsagt',
    className: 'bg-red-100 text-red-700',
  },
  FORNYET: {
    label: 'Fornyet',
    className: 'bg-teal-100 text-teal-700',
  },
  ARKIVERET: {
    label: 'Arkiveret',
    className: 'bg-gray-100 text-gray-500',
  },
}

interface Props {
  status: ContractStatus
  className?: string
}

export function ContractStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status]
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