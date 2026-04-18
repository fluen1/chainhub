import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { TimelineSectionData, TimelineColor } from '@/actions/dashboard'

export interface TimelineSectionProps {
  section: TimelineSectionData
}

function colorClass(c: TimelineColor): string {
  switch (c) {
    case 'red':
      return 'bg-red-50 text-red-600'
    case 'amber':
      return 'bg-amber-50 text-amber-600'
    case 'blue':
      return 'bg-blue-50 text-blue-600'
    case 'purple':
      return 'bg-purple-50 text-purple-600'
    case 'green':
      return 'bg-green-50 text-green-600'
    case 'gray':
      return 'bg-slate-50 text-slate-500'
  }
}

export function TimelineSection({ section }: TimelineSectionProps) {
  if (section.items.length === 0) return null

  const dotClass = cn(
    'absolute left-[-19px] top-[3px] w-2.5 h-2.5 rounded-full border-2',
    section.dotType === 'overdue' && 'border-red-500 bg-red-50',
    section.dotType === 'today' && 'border-blue-500 bg-blue-500',
    section.dotType === 'future' && 'border-gray-300 bg-gray-50'
  )

  const labelClass = cn(
    'text-[11px] font-semibold mb-2',
    section.dotType === 'overdue' && 'text-red-600',
    section.dotType === 'today' && 'text-blue-600',
    section.dotType === 'future' && 'text-gray-500'
  )

  return (
    <div className="relative pl-5 mb-5">
      <div className="absolute left-[5px] top-[4px] bottom-0 w-0.5 bg-gray-200" />

      <div className="relative mb-2">
        <div className={dotClass} />
        <div className={labelClass}>{section.label}</div>
      </div>

      {section.items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-2.5 mb-1.5 cursor-pointer hover:shadow-sm hover:border-gray-300 transition-all no-underline"
        >
          <div
            className={cn(
              'w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0',
              colorClass(item.color)
            )}
          >
            {item.letter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-800">{item.title}</div>
            <div className="text-[10px] text-gray-400">{item.subtitle}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.aiExtracted && (
              <span className="text-[8px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                AI
              </span>
            )}
            <span className="text-[10px] tabular-nums text-gray-400">{item.time}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
