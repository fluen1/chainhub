// KbdHint — én enkelt keyboard-shortcut hint. Vises typisk i bottombar.
//
// Brug:
//   <KbdHint k="⌘K" label="handling" />

export function KbdHint({ k, label }: { k: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="b-kbd">{k}</span>
      {label && <span className="text-b-2">{label}</span>}
    </span>
  )
}
