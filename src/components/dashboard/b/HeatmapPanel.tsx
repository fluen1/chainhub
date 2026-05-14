'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Panel, PanelHeader, PanelGroupLabel } from '@/components/ui/b'
import type { HeatmapCompany } from '@/lib/dashboard-helpers'

// ────────────────────────────────────────────────────────────────────────────
// Health-heatmap — én celle pr. selskab.
//
// Farve mapper fra healthStatus: healthy = grøn (l3/l4), warning = amber (r1),
// critical = rød (r3). Tooltip følger musen og viser selskab + status.
// "Top urgency"-rækken viser top-3 selskaber med åbne sager.
// ────────────────────────────────────────────────────────────────────────────

const LEVEL_CLASS: Record<'l3' | 'l4' | 'r1' | 'r3', string> = {
  l3: 'bg-[#239a3b]', // healthy
  l4: 'bg-[#196127]', // healthy + aktiv
  r1: 'bg-[#fdb8b1]', // warning
  r3: 'bg-[#b91c1c]', // critical
}

function levelFor(c: HeatmapCompany): keyof typeof LEVEL_CLASS {
  if (c.healthStatus === 'critical') return 'r3'
  if (c.healthStatus === 'warning') return 'r1'
  return c.openCaseCount === 0 ? 'l4' : 'l3'
}

function statusFor(c: HeatmapCompany): string {
  if (c.healthStatus === 'critical') return `Kritisk · ${c.openCaseCount} åbne sager`
  if (c.healthStatus === 'warning') return `Advarsel · ${c.openCaseCount} åbne sager`
  return c.openCaseCount === 0 ? 'OK · aktiv' : `OK · ${c.openCaseCount} åbne sager`
}

interface Tooltip {
  x: number
  y: number
  name: string
  status: string
}

export function HeatmapPanel({ heatmap }: { heatmap: HeatmapCompany[] }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const handleMove = useCallback((e: React.MouseEvent, c: HeatmapCompany) => {
    setTooltip({
      x: e.clientX + 14,
      y: e.clientY - 50,
      name: c.name,
      status: statusFor(c),
    })
  }, [])

  const critical = heatmap.filter((c) => c.healthStatus === 'critical').length
  const warning = heatmap.filter((c) => c.healthStatus === 'warning').length
  const ok = heatmap.length - critical - warning

  const topUrgency = [...heatmap]
    .filter((c) => c.healthStatus !== 'healthy' || c.openCaseCount > 0)
    .sort((a, b) => {
      const sevA = a.healthStatus === 'critical' ? 2 : a.healthStatus === 'warning' ? 1 : 0
      const sevB = b.healthStatus === 'critical' ? 2 : b.healthStatus === 'warning' ? 1 : 0
      if (sevA !== sevB) return sevB - sevA
      return b.openCaseCount - a.openCaseCount
    })
    .slice(0, 3)

  return (
    <>
      <Panel>
        <PanelHeader title="Health-heatmap" meta={`${heatmap.length} selskaber · grøn = OK`} />

        <div className="grid grid-cols-8 gap-0.5 p-3">
          {heatmap.length === 0 ? (
            <div className="col-span-8 py-3 text-center text-[12px] text-b-3">
              Ingen selskaber i porteføljen endnu
            </div>
          ) : (
            heatmap.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className={`aspect-square rounded-[2px] transition-transform duration-75 hover:z-10 hover:scale-125 hover:shadow-md ${LEVEL_CLASS[levelFor(c)]}`}
                onMouseEnter={(e) => handleMove(e, c)}
                onMouseMove={(e) => handleMove(e, c)}
                onMouseLeave={() => setTooltip(null)}
                aria-label={`${c.name} — ${statusFor(c)}`}
              />
            ))
          )}
        </div>

        <div className="flex justify-between px-3 pb-3 text-[10px] text-b-2">
          <span>
            {critical} kritisk{critical === 1 ? '' : 'e'}
          </span>
          <span>
            {ok} OK · {warning} afventer
          </span>
        </div>

        {topUrgency.length > 0 && (
          <>
            <PanelGroupLabel>Top urgency</PanelGroupLabel>
            {topUrgency.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="grid cursor-pointer grid-cols-[1fr_14px] items-center gap-2 border-b border-b-divider px-3 py-1.5 text-[13px] text-b-1 no-underline last:border-b-0 hover:bg-b-row-hover"
              >
                <span>
                  <strong className="font-medium">{c.name}</strong>
                  <span className="text-b-2"> · {statusFor(c)}</span>
                </span>
                <span className="text-b-3">›</span>
              </Link>
            ))}
          </>
        )}
      </Panel>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-[4px] bg-[#1f2328] px-2 py-1.5 text-[11px] leading-snug text-white shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-semibold">{tooltip.name}</div>
          <div className="mt-0.5 text-[#8c959f]">{tooltip.status}</div>
        </div>
      )}
    </>
  )
}
