'use client'

import { MessageSquare } from 'lucide-react'

interface Props {
  onClick: () => void
}

export function ChatToggle({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center rounded-md p-1.5 text-b-2 hover:bg-b-surface-hover"
      title="Åbn AI-assistent"
      aria-label="Åbn AI-assistent"
    >
      <MessageSquare className="h-4 w-4" aria-hidden />
    </button>
  )
}
