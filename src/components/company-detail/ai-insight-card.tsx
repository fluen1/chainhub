export interface AiInsightCardProps {
  headlineMd: string
  bodyMd: string
}

// Parser minimal markdown (kun **bold**). Trygt mod XSS fordi vi ikke
// accepterer HTML, kun fed-markering. Returnerer React-children.
function renderMarkdownBold(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(<strong key={`b-${key++}`}>{match[1]}</strong>)
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

export function AiInsightCard({ headlineMd, bodyMd }: AiInsightCardProps) {
  return (
    <div
      className="rounded-2xl px-4 py-3.5 flex gap-3"
      style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)' }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-[12px] font-extrabold text-white">
        AI
      </div>
      <div className="text-xs leading-relaxed text-indigo-900">
        {renderMarkdownBold(headlineMd)} {renderMarkdownBold(bodyMd)}
      </div>
    </div>
  )
}
