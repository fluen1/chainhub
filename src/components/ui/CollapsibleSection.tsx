'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-400 transition-transform duration-200',
              isOpen ? 'rotate-0' : '-rotate-90'
            )}
          />
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
            {title}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
            {count}
          </span>
        </div>
      </button>
      <div
        className={cn(
          'grid transition-all duration-200 ease-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
