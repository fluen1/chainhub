// BrandMark — SVG-replace for unicode ▣. Renderes konsistent på alle systemer
// (Unicode-glyfen mangler i mange Windows-fonte). Concentric squares-form.
//
// Brug: <BrandMark /> for kun ikonet, <BrandMark withText /> for "▣ ChainHub".

export function BrandMark({ withText = false }: { withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-b-1">
      <svg viewBox="0 0 14 14" width={14} height={14} aria-hidden className="shrink-0">
        <rect
          x="1"
          y="1"
          width="12"
          height="12"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <rect x="4.5" y="4.5" width="5" height="5" rx="0.5" fill="currentColor" />
      </svg>
      {withText && <span className="font-semibold">ChainHub</span>}
    </span>
  )
}
