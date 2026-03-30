'use client'

interface HealthBarProps {
  healthy: number
  warning: number
  critical: number
}

export function HealthBar({ healthy, warning, critical }: HealthBarProps) {
  return (
    <div>
      <div className="flex gap-6 mt-3">
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums text-green-600">{healthy}</div>
          <div className="text-[11px] text-gray-400">Sund</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums text-amber-600">{warning}</div>
          <div className="text-[11px] text-gray-400">Advarsel</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums text-red-600">{critical}</div>
          <div className="text-[11px] text-gray-400">Kritisk</div>
        </div>
      </div>
      <div className="mt-3 flex gap-[3px] h-2">
        <div className="rounded bg-green-500" style={{ flex: healthy }} />
        <div className="rounded bg-amber-500" style={{ flex: warning }} />
        <div className="rounded bg-red-500" style={{ flex: critical }} />
      </div>
    </div>
  )
}
