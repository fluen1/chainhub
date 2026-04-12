'use client'

import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from 'react-leaflet'
import { cn } from '@/lib/utils'

export interface MapCompany {
  id: string
  name: string
  city: string | null
  latitude: number
  longitude: number
  healthStatus: 'critical' | 'warning' | 'healthy'
  openCaseCount: number
  partnerName: string | null
  partnerOwnershipPct: number | null
}

interface LeafletMapProps {
  companies: MapCompany[]
}

const HEALTH_COLORS: Record<string, string> = {
  critical: '#f43f5e',
  warning: '#fbbf24',
  healthy: '#34d399',
}

const BADGE_STYLES: Record<string, string> = {
  critical: 'bg-rose-50 text-rose-700',
  warning: 'bg-amber-50 text-amber-700',
  healthy: 'bg-emerald-50 text-emerald-700',
}

const BADGE_LABELS: Record<string, string> = {
  critical: 'Kritisk',
  warning: 'Advarsel',
  healthy: 'Sund',
}

function markerRadius(issueCount: number): number {
  return Math.max(6, Math.min(18, 6 + issueCount * 3))
}

export default function LeafletMap({ companies }: LeafletMapProps) {
  const cityGroups = new Map<string, MapCompany[]>()
  for (const c of companies) {
    const key = `${c.latitude.toFixed(2)},${c.longitude.toFixed(2)}`
    if (!cityGroups.has(key)) cityGroups.set(key, [])
    cityGroups.get(key)!.push(c)
  }

  return (
    <MapContainer
      center={[56.0, 10.5]}
      zoom={7}
      className="h-full w-full rounded-xl"
      style={{ minHeight: 560, background: '#0f172a' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {Array.from(cityGroups.entries()).map(([key, group]) => {
        const first = group[0]
        const totalIssues = group.reduce((sum, c) => sum + c.openCaseCount, 0)
        const worstStatus = group.reduce<'critical' | 'warning' | 'healthy'>(
          (worst, c) => {
            const rank = { critical: 0, warning: 1, healthy: 2 }
            return rank[c.healthStatus] < rank[worst] ? c.healthStatus : worst
          },
          'healthy'
        )
        const cityName = first.city?.replace(/\s+[NSØVKC]{1,2}$/, '').trim() ?? 'Ukendt'

        return (
          <CircleMarker
            key={key}
            center={[first.latitude, first.longitude]}
            radius={markerRadius(totalIssues)}
            pathOptions={{
              color: HEALTH_COLORS[worstStatus],
              fillColor: HEALTH_COLORS[worstStatus],
              fillOpacity: 0.7,
              weight: 2,
            }}
          >
            <Tooltip permanent direction="right" offset={[12, 0]} className="leaflet-label-dark">
              <span className="text-[11px] font-medium">{cityName}</span>
            </Tooltip>
            <Popup>
              <div className="min-w-[200px]">
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
                  {cityName} · {group.length} {group.length === 1 ? 'lokation' : 'lokationer'}
                </div>
                {group.map((c) => (
                  <a
                    key={c.id}
                    href={`/companies/${c.id}`}
                    className="flex items-center justify-between gap-2 py-1.5 no-underline hover:bg-slate-50 rounded px-1 -mx-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-slate-900 truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {c.partnerName ?? 'Ingen partner'}
                        {c.partnerOwnershipPct != null && ` · ${c.partnerOwnershipPct}%`}
                      </div>
                    </div>
                    <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0', BADGE_STYLES[c.healthStatus])}>
                      {BADGE_LABELS[c.healthStatus]}
                    </span>
                  </a>
                ))}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
