import { SectionCard } from '@/components/company-detail/section-card'

interface TaskDescriptionProps {
  description: string | null
}

export function TaskDescription({ description }: TaskDescriptionProps) {
  return (
    <SectionCard title="Beskrivelse">
      {description ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{description}</p>
      ) : (
        <p className="py-2 text-center text-xs text-slate-400">Ingen beskrivelse tilføjet</p>
      )}
    </SectionCard>
  )
}
