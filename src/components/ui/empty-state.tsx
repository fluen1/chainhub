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
  /** 'default' = tom liste/side (stor padding). 'filtered' = ingen match på filter (mindre padding, normalt uden CTA). */
  variant?: 'default' | 'filtered'
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const padding = variant === 'filtered' ? 'p-8' : 'p-12'
  return (
    <div
      className={cn(
        'rounded-lg border-2 border-dashed border-gray-300 text-center',
        padding,
        className
      )}
    >
      <Icon className="mx-auto h-12 w-12 text-gray-400" aria-hidden />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
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
