import { Bell, Menu } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { InlineKpi } from '@/types/ui'

function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Godmorgen'
  if (hour < 18) return 'God eftermiddag'
  return 'God aften'
}

function getDateString(date: Date): string {
  const days = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
  const months = [
    'januar',
    'februar',
    'marts',
    'april',
    'maj',
    'juni',
    'juli',
    'august',
    'september',
    'oktober',
    'november',
    'december',
  ]
  return `${days[date.getDay()]} ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`
}

export interface AppHeaderProps {
  userName: string
  kpis: InlineKpi[]
  currentDate: Date
  /** Callback til at åbne mobile sidebar-drawer. Hvis udeladt vises ingen hamburger-knap. */
  onOpenMobileSidebar?: () => void
}

export function AppHeader({ userName, kpis, currentDate, onOpenMobileSidebar }: AppHeaderProps) {
  const firstName = userName.split(' ')[0]
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-8 h-16 py-0">
      <div className="flex items-center">
        {onOpenMobileSidebar && (
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            aria-label="Åbn hovedmenu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        )}
        <div className="pr-6 pl-3 lg:pl-0">
          <div className="text-sm font-bold text-slate-900 leading-tight">
            {getGreeting(currentDate)}, {firstName}
          </div>
          <div className="text-[11px] text-gray-500 leading-tight">
            {getDateString(currentDate)}
          </div>
        </div>

        <div className="hidden lg:block w-px h-9 bg-gray-200 mr-6" />

        <div className="hidden lg:flex items-center gap-6">
          {kpis.map((kpi, i) => (
            <div key={i} className="text-center min-w-[48px]">
              <div
                className={cn(
                  'text-lg font-bold tabular-nums leading-tight',
                  kpi.color === 'red' && 'text-red-600',
                  kpi.color === 'amber' && 'text-amber-600',
                  !kpi.color && 'text-slate-900'
                )}
              >
                {kpi.value}
              </div>
              <div className="text-[10px] text-gray-500 leading-tight">{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/search"
          className="hidden sm:flex items-center w-[260px] rounded-lg border border-gray-200 bg-slate-50 px-3.5 py-2 text-[13px] text-gray-500 hover:border-gray-300 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Søg efter selskaber, kontrakter, perso...
        </Link>
        <button
          type="button"
          aria-label="Notifikationer"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-slate-50 text-gray-400 hover:bg-slate-100 transition-colors"
        >
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
