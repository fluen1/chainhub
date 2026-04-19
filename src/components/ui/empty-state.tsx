import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateAction {
  label: string
  href: string
}

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  /** 'default' = stor padding (p-12). 'filtered' = p-8. 'compact' = p-4 til sidebars/kompakte kort. */
  variant?: 'default' | 'filtered' | 'compact'
  /** 'default' = gray-dashed. 'slate' = mørkere slate-ring for documents-mørkt tema. */
  theme?: 'default' | 'slate'
  className?: string
}

const paddingByVariant = {
  default: 'p-12',
  filtered: 'p-8',
  compact: 'p-4',
} as const

const themeClasses = {
  default: 'border-2 border-dashed border-gray-300 text-center',
  slate: 'border border-slate-200 bg-slate-50/50 text-center',
} as const

const iconSizeByVariant = {
  default: 'h-12 w-12',
  filtered: 'h-12 w-12',
  compact: 'h-8 w-8',
} as const

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  theme = 'default',
  className,
}: EmptyStateProps) {
  const isCompact = variant === 'compact'
  return (
    <div className={cn('rounded-lg', themeClasses[theme], paddingByVariant[variant], className)}>
      <Icon className={cn('mx-auto text-gray-400', iconSizeByVariant[variant])} aria-hidden />
      <h3 className={cn('mt-2 font-semibold text-gray-900', isCompact ? 'text-xs' : 'text-sm')}>
        {title}
      </h3>
      {description && (
        <p className={cn('mt-1 text-gray-500', isCompact ? 'text-xs' : 'text-sm')}>{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {action.label}
        </Link>
      )}
    </div>
  )
}
