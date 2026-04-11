'use client'

import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InlineKpi } from '@/types/ui'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Godmorgen'
  if (hour < 18) return 'God eftermiddag'
  return 'God aften'
}

function getDateString(): string {
  const days = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
  const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']
  const now = new Date()
  return `${days[now.getDay()]} ${now.getDate()}. ${months[now.getMonth()]} ${now.getFullYear()}`
}

export interface AppHeaderProps {
  userName: string
  kpis: InlineKpi[]
}

export function AppHeader({ userName, kpis }: AppHeaderProps) {
  const firstName = userName.split(' ')[0]
  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 h-14 py-0">
      {/* Venstre: hilsen + dato + divider + inline KPIs */}
      <div className="flex items-center gap-0">
        <div className="pr-5">
          <div className="text-sm font-bold text-slate-900 leading-tight">
            {getGreeting()}, {firstName}
          </div>
          <div className="text-[11px] text-gray-400 leading-tight">{getDateString()}</div>
        </div>

        <div className="w-px h-8 bg-gray-200 mr-5" />

        <div className="flex items-center gap-5">
          {kpis.map((kpi, i) => (
            <div key={i} className="text-center">
              <div
                className={cn(
                  'text-[18px] font-bold tabular-nums leading-tight',
                  kpi.color === 'red' && 'text-red-600',
                  kpi.color === 'amber' && 'text-amber-600',
                  !kpi.color && 'text-slate-900',
                )}
              >
                {kpi.value}
              </div>
              <div className="text-[9px] text-gray-400 leading-tight">{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Højre: søgning + notifikationer + avatar */}
      <div className="flex items-center gap-3">
        <input
          className="w-[260px] rounded-lg border border-gray-200 bg-slate-50 px-3.5 py-2 text-[13px] text-gray-400 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
          placeholder="Søg efter selskaber, kontrakter, personer..."
          readOnly
        />
        <button type="button" aria-label="Notifikationer" className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-slate-50 text-gray-400 hover:bg-slate-100 transition-colors">
          <Bell className="h-4 w-4" />
          <div className="absolute top-1.5 right-1.5 h-[7px] w-[7px] rounded-full bg-red-500 border-2 border-white" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-200 text-xs font-bold text-slate-600">
          {initials}
        </div>
      </div>
    </header>
  )
}
