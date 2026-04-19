import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actionLabel?: string
  actionHref?: string
  /** Ekstra handlinger (fx ExportButton) der placeres til venstre for primær-actionen */
  extraActions?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  actionLabel,
  actionHref,
  extraActions,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {extraActions}
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  )
}
