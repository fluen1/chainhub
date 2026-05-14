'use client'

import { cn } from '@/lib/utils'

// SlutLink — diskret "Slut"-button til at afslutte ejerskab/rolle/ansættelse.
// Bruges som per-række-action i ejer- og person-paneler.
//
// Diskret styling: 10px grå tekst der bliver rød ved hover for at signalere
// destruktiv-light handling (afslutning, ikke sletning).

export function SlutLink({
  onClick,
  title = 'Slut',
  label = 'Slut',
  className,
}: {
  onClick: () => void
  title?: string
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={cn('text-[10px] text-b-2 hover:text-b-red-fg', className)}
      title={title}
    >
      {label}
    </button>
  )
}
