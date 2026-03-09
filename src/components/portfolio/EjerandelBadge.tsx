interface EjerandelBadgeProps {
  value: number | null
}

export function EjerandelBadge({ value }: EjerandelBadgeProps) {
  if (value === null) {
    return <span className="text-sm text-gray-400">—</span>
  }

  const pct = Number(value)
  const label = `${pct.toFixed(pct % 1 === 0 ? 0 : 2)}%`

  // Farve baseret på ejerandel
  const colorClass =
    pct >= 50
      ? 'text-blue-700 font-semibold'
      : pct > 0
      ? 'text-gray-700'
      : 'text-gray-400'

  return <span className={`text-sm ${colorClass}`}>{label}</span>
}