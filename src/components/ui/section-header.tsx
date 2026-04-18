export interface SectionHeaderProps {
  title: string
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mt-7 mb-3.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
        {title}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}
