# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the prototype dashboard with light mode + dark sidebar design system, role-based auto-adaptation, and calendar widget with AI-extracted events.

**Architecture:** Update existing prototype (`src/app/proto/`) — new layout styling, refactored dashboard page with role-auto-adaptation (no tabs), new calendar widget component, new mock calendar data. Sidebar gets "Kalender" link and visual refresh. All existing navigation and interactivity preserved.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Plus Jakarta Sans (Google Fonts), Lucide icons

**Design Spec:** `docs/superpowers/specs/2026-03-31-dashboard-redesign.md`

---

## File Structure

### New files

| Path                                          | Responsibility                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/components/prototype/CalendarWidget.tsx` | Kompakt månedskalender med dots og event-liste                                                    |
| `src/components/prototype/KpiCard.tsx`        | Genbrugelig KPI-kort komponent                                                                    |
| `src/components/prototype/UrgencyList.tsx`    | Genbrugelig urgency/handlingsliste                                                                |
| `src/components/prototype/HealthBar.tsx`      | Porteføljesundhed counts + bar                                                                    |
| `src/components/prototype/CompanyRow.tsx`     | Selskabs-row med avatar, info, status                                                             |
| `src/components/prototype/CoverageBar.tsx`    | Kontraktdækning progress-bar (erstatter eksisterende `src/components/ui/CoverageBar.tsx` pattern) |
| `src/components/prototype/FinRow.tsx`         | Finansiel nøgletal-row                                                                            |
| `src/components/prototype/SectionHeader.tsx`  | Sektions-overskrift med linje                                                                     |
| `src/mock/calendar.ts`                        | Mock kalender-events med AI-flag                                                                  |
| `src/app/proto/calendar/page.tsx`             | Fuld kalenderside (placeholder)                                                                   |

### Modified files

| Path                                          | Changes                                                               |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `src/app/proto/layout.tsx`                    | Ny baggrund `#f0f2f5`, font import                                    |
| `src/app/layout.tsx`                          | Tilføj Plus Jakarta Sans font                                         |
| `src/components/layout/prototype-sidebar.tsx` | Nyt design: `#0f172a` bg, sektions-headers, kalender-link, blå accent |
| `src/components/layout/prototype-header.tsx`  | Nyt topbar-design med søgefelt og avatar                              |
| `src/app/proto/dashboard/page.tsx`            | Komplet rewrite: rollebaseret auto-tilpasning, nye komponenter        |
| `src/mock/types.ts`                           | Tilføj `MockCalendarEvent` type                                       |
| `src/mock/helpers.ts`                         | Tilføj `getDashboardSectionsForRole()` helper                         |

---

## Task 1: Font og layout foundation

**Files:**

- Modify: `src/app/layout.tsx`
- Modify: `src/app/proto/layout.tsx`

- [ ] **Step 1: Tilføj Plus Jakarta Sans til root layout**

I `src/app/layout.tsx`, tilføj Google Font import:

```tsx
import { Plus_Jakarta_Sans } from 'next/font/google'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})
```

Opdater `<body>` til at inkludere `plusJakarta.variable` i className.

- [ ] **Step 2: Opdater prototype layout baggrund**

I `src/app/proto/layout.tsx`, ændr `main` fra `bg-slate-50/80` til `bg-[#f0f2f5]`:

```tsx
<main className="flex-1 overflow-y-auto bg-[#f0f2f5] p-6 lg:p-8">
```

- [ ] **Step 3: Verificér i browser**

Run: `npm run dev`
Åbn `http://localhost:3000/proto/dashboard` — baggrunden skal være lys grå `#f0f2f5` og fonten Plus Jakarta Sans.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/proto/layout.tsx
git commit -m "feat(prototype): tilføj Plus Jakarta Sans font og lys baggrund"
```

---

## Task 2: Redesign prototype sidebar

**Files:**

- Modify: `src/components/layout/prototype-sidebar.tsx`

- [ ] **Step 1: Opdater sidebar med nyt design**

Erstat indholdet af `prototype-sidebar.tsx` med nyt design der følger spec'en:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  FileText,
  CheckSquare,
  FolderOpen,
  Search,
  Settings,
  Calendar,
  Users,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { getSidebarBadge } from '@/mock/helpers'
import { getExpiringContracts } from '@/mock/contracts'
import { getOverdueTasks } from '@/mock/tasks'
import { getDocumentsProcessing } from '@/mock/documents'
import { getCompanies } from '@/mock/companies'
import { getOpenCases } from '@/mock/cases'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badgeKey: string
}

interface NavSection {
  label: string
  items: NavItem[]
}

export function PrototypeSidebar() {
  const pathname = usePathname()
  const { activeUser, dataScenario } = usePrototype()
  const role = activeUser.role

  const companies = getCompanies(dataScenario)
  const criticalCount = companies.filter((c) => c.healthStatus === 'critical').length
  const warningCount = companies.filter((c) => c.healthStatus === 'warning').length
  const overdueTaskCount = getOverdueTasks().length
  const expiringContractCount = getExpiringContracts(90).length
  const processingDocsCount = getDocumentsProcessing().length
  const openCaseCount = getOpenCases().length

  const badgeData = {
    criticalCount,
    warningCount,
    overdueTaskCount,
    awaitingDocCount: processingDocsCount,
    expiringContractCount,
    openCaseCount,
  }

  const sections: NavSection[] = [
    {
      label: 'Overblik',
      items: [
        {
          name: 'Dashboard',
          href: '/proto/dashboard',
          icon: LayoutDashboard,
          badgeKey: 'dashboard',
        },
        { name: 'Kalender', href: '/proto/calendar', icon: Calendar, badgeKey: 'calendar' },
      ],
    },
    {
      label: 'Portefølje',
      items: [
        { name: 'Selskaber', href: '/proto/portfolio', icon: Building2, badgeKey: 'portfolio' },
        { name: 'Kontrakter', href: '/proto/contracts', icon: FileText, badgeKey: 'contracts' },
        { name: 'Sager', href: '/proto/documents', icon: Briefcase, badgeKey: 'cases' },
        { name: 'Opgaver', href: '/proto/tasks', icon: CheckSquare, badgeKey: 'tasks' },
      ],
    },
    {
      label: 'Ressourcer',
      items: [
        { name: 'Dokumenter', href: '/proto/documents', icon: FolderOpen, badgeKey: 'documents' },
        { name: 'Personer', href: '/proto/search', icon: Users, badgeKey: 'persons' },
      ],
    },
  ]

  const initials = activeUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-full w-60 flex-col bg-[#0f172a]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.07] px-5">
        <div className="h-2 w-2 rounded-full bg-blue-500" />
        <Link href="/proto/dashboard" className="text-lg font-bold text-white">
          ChainHub
        </Link>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = getSidebarBadge(item.badgeKey, role, badgeData)

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-blue-500/[0.12] text-white'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <item.icon
                        className={cn('h-[18px] w-[18px]', isActive ? 'text-blue-400' : '')}
                      />
                      {item.name}
                    </span>
                    {badge !== null && badge.count > 0 && (
                      <span
                        className={cn(
                          'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                          badge.urgency === 'critical'
                            ? 'bg-red-500/[0.15] text-red-400'
                            : 'bg-white/[0.08] text-slate-400'
                        )}
                      >
                        {badge.count}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: settings + user */}
      <div className="border-t border-white/[0.07] px-4 py-3 space-y-1">
        <Link
          href="/proto/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
            pathname.startsWith('/proto/settings')
              ? 'bg-blue-500/[0.12] text-white'
              : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
          )}
        >
          <Settings className="h-[18px] w-[18px]" />
          Indstillinger
        </Link>

        <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-200">{activeUser.name}</p>
            <span className="mt-0.5 inline-flex items-center rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-400">
              {activeUser.roleLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificér sidebar i browser**

Åbn `http://localhost:3000/proto/dashboard` — sidebar skal have:

- Mørk `#0f172a` baggrund
- Sektions-headers (Overblik, Portefølje, Ressourcer)
- Kalender-link under Dashboard
- Blå accent på aktivt item
- Afrundede badges

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/prototype-sidebar.tsx
git commit -m "feat(prototype): redesign sidebar med sektioner, kalender-link og blå accent"
```

---

## Task 3: Genbrugelige dashboard-komponenter

**Files:**

- Create: `src/components/prototype/KpiCard.tsx`
- Create: `src/components/prototype/UrgencyList.tsx`
- Create: `src/components/prototype/HealthBar.tsx`
- Create: `src/components/prototype/CompanyRow.tsx`
- Create: `src/components/prototype/CoverageBar.tsx` (prototype-version)
- Create: `src/components/prototype/FinRow.tsx`
- Create: `src/components/prototype/SectionHeader.tsx`

- [ ] **Step 1: Opret KpiCard**

```tsx
// src/components/prototype/KpiCard.tsx
'use client'

import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string | number
  trend?: { text: string; direction: 'up' | 'down' | 'neutral' }
  valueColor?: 'default' | 'warning' | 'danger'
  onClick?: () => void
}

export function KpiCard({ label, value, trend, valueColor = 'default', onClick }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-5 transition-shadow duration-200 hover:shadow-md',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div
        className={cn(
          'mt-2 text-[30px] font-bold leading-none tabular-nums',
          valueColor === 'warning' && 'text-amber-600',
          valueColor === 'danger' && 'text-red-600',
          valueColor === 'default' && 'text-slate-900'
        )}
      >
        {value}
      </div>
      {trend && (
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
            trend.direction === 'up' && 'bg-green-50 text-green-600',
            trend.direction === 'down' && 'bg-red-50 text-red-600',
            trend.direction === 'neutral' && 'bg-slate-50 text-slate-500'
          )}
        >
          {trend.text}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Opret UrgencyList**

```tsx
// src/components/prototype/UrgencyList.tsx
'use client'

import { cn } from '@/lib/utils'

export interface UrgencyItem {
  id: string
  name: string
  subtitle: string
  days: string
  indicator: 'red' | 'amber' | 'blue'
  overdue?: boolean
  href?: string
}

interface UrgencyListProps {
  title: string
  items: UrgencyItem[]
  viewAllHref?: string
}

export function UrgencyList({ title, items, viewAllHref }: UrgencyListProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between text-sm font-semibold text-slate-900">
        {title}
        {viewAllHref && (
          <span className="text-xs font-medium text-blue-500 cursor-pointer">Se alle →</span>
        )}
      </div>
      <div className="space-y-0">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b border-slate-50 py-2.5 last:border-none"
          >
            <div
              className={cn(
                'w-1 self-stretch rounded-full',
                item.indicator === 'red' && 'bg-red-500',
                item.indicator === 'amber' && 'bg-amber-500',
                item.indicator === 'blue' && 'bg-blue-500'
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-slate-800">{item.name}</div>
              <div className="text-xs text-gray-400">{item.subtitle}</div>
            </div>
            <div
              className={cn(
                'shrink-0 text-xs tabular-nums',
                item.overdue ? 'font-medium text-red-600' : 'text-gray-400'
              )}
            >
              {item.days}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Opret HealthBar**

```tsx
// src/components/prototype/HealthBar.tsx
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
```

- [ ] **Step 4: Opret CompanyRow**

```tsx
// src/components/prototype/CompanyRow.tsx
'use client'

import { cn } from '@/lib/utils'

interface CompanyRowProps {
  initials: string
  name: string
  meta: string
  status: { label: string; type: 'ok' | 'warning' | 'critical' }
  avatarColor: string
  href?: string
}

export function CompanyRow({ initials, name, meta, status, avatarColor, href }: CompanyRowProps) {
  const Wrapper = href ? 'a' : 'div'
  return (
    <Wrapper
      href={href}
      className="flex items-center gap-3 border-b border-slate-50 py-2.5 last:border-none cursor-pointer"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-slate-800">{name}</div>
        <div className="text-xs text-gray-400">{meta}</div>
      </div>
      <span
        className={cn(
          'rounded-md px-2.5 py-0.5 text-[11px] font-medium',
          status.type === 'ok' && 'bg-green-50 text-green-600',
          status.type === 'warning' && 'bg-amber-50 text-amber-600',
          status.type === 'critical' && 'bg-red-50 text-red-600'
        )}
      >
        {status.label}
      </span>
    </Wrapper>
  )
}
```

- [ ] **Step 5: Opret CoverageBar (prototype-version)**

```tsx
// src/components/prototype/CoverageBar.tsx
'use client'

import { cn } from '@/lib/utils'

interface CoverageBarProps {
  label: string
  percentage: number
}

export function CoverageBar({ label, percentage }: CoverageBarProps) {
  const fillColor =
    percentage >= 100 ? 'bg-green-500' : percentage >= 75 ? 'bg-blue-500' : 'bg-amber-500'

  return (
    <div className="flex items-center gap-3 mb-3.5">
      <div className="w-28 shrink-0 text-[13px] text-slate-500">{label}</div>
      <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded transition-all duration-400', fillColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="w-10 text-right text-[13px] font-semibold tabular-nums text-slate-500">
        {percentage}%
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Opret FinRow**

```tsx
// src/components/prototype/FinRow.tsx
'use client'

interface FinRowProps {
  label: string
  value: string
  valueColor?: string
  trend?: { text: string; direction: 'up' | 'down' }
}

export function FinRow({ label, value, valueColor, trend }: FinRowProps) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-50 py-2.5 last:border-none">
      <div className="text-[13px] text-slate-500">{label}</div>
      <div className="flex items-center gap-2">
        <span
          className="text-base font-semibold tabular-nums"
          style={{ color: valueColor || '#0f172a' }}
        >
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
              trend.direction === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            )}
          >
            {trend.text}
          </span>
        )}
      </div>
    </div>
  )
}
```

Tilføj import øverst i filen: `import { cn } from '@/lib/utils'`

- [ ] **Step 7: Opret SectionHeader**

```tsx
// src/components/prototype/SectionHeader.tsx
interface SectionHeaderProps {
  title: string
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mt-7 mb-3.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
        {title}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}
```

- [ ] **Step 8: Verificér at alle komponenter kompilerer**

Run: `npx tsc --noEmit`
Forventet: Ingen fejl.

- [ ] **Step 9: Commit**

```bash
git add src/components/prototype/KpiCard.tsx src/components/prototype/UrgencyList.tsx src/components/prototype/HealthBar.tsx src/components/prototype/CompanyRow.tsx src/components/prototype/CoverageBar.tsx src/components/prototype/FinRow.tsx src/components/prototype/SectionHeader.tsx
git commit -m "feat(prototype): tilføj genbrugelige dashboard-komponenter"
```

---

## Task 4: Mock kalender-data

**Files:**

- Modify: `src/mock/types.ts`
- Create: `src/mock/calendar.ts`

- [ ] **Step 1: Tilføj MockCalendarEvent type**

I `src/mock/types.ts`, tilføj i bunden:

```typescript
export interface MockCalendarEvent {
  id: string
  date: string // YYYY-MM-DD
  title: string
  subtitle: string
  type: 'expiry' | 'deadline' | 'meeting' | 'case' | 'renewal'
  companyId?: string
  companyName?: string
  aiExtracted: boolean
  href?: string
}
```

- [ ] **Step 2: Opret mock/calendar.ts**

```typescript
// src/mock/calendar.ts
import type { MockCalendarEvent } from './types'

export const mockCalendarEvents: MockCalendarEvent[] = [
  // Marts 2026
  {
    id: 'cal-1',
    date: '2026-03-10',
    title: 'Frist: Indsendelse årsrapport',
    subtitle: 'Nordklinik ApS',
    type: 'deadline',
    companyId: 'c1',
    companyName: 'Nordklinik ApS',
    aiExtracted: true,
    href: '/proto/portfolio/c1',
  },
  {
    id: 'cal-2',
    date: '2026-03-18',
    title: 'Fornyelse underskrevet',
    subtitle: 'Aarhus Smile ApS · automatisk fornyelse',
    type: 'renewal',
    companyId: 'c5',
    companyName: 'Aarhus Smile ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-5',
  },
  {
    id: 'cal-3',
    date: '2026-03-28',
    title: 'Udløb: Ejeraftale',
    subtitle: 'Nordklinik ApS',
    type: 'expiry',
    companyId: 'c1',
    companyName: 'Nordklinik ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-1',
  },
  {
    id: 'cal-4',
    date: '2026-03-30',
    title: 'Opsigelse mulig — Leverandøraftale',
    subtitle: 'Sundby Dental · opsigelsesfrist',
    type: 'deadline',
    companyId: 'c2',
    companyName: 'Sundby Dental ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-3',
  },
  {
    id: 'cal-5',
    date: '2026-03-31',
    title: 'Besøg — Østklinikken',
    subtitle: 'Driftsbesøg · kl. 10:00',
    type: 'meeting',
    companyId: 'c3',
    companyName: 'Østklinikken ApS',
    aiExtracted: false,
    href: '/proto/portfolio/c3',
  },
  // April 2026
  {
    id: 'cal-6',
    date: '2026-04-01',
    title: 'Møde — Dr. Petersen',
    subtitle: 'Nordklinik ApS · genforhandling',
    type: 'meeting',
    companyId: 'c1',
    companyName: 'Nordklinik ApS',
    aiExtracted: false,
    href: '/proto/portfolio/c1',
  },
  {
    id: 'cal-7',
    date: '2026-04-02',
    title: 'Frist: Indsigelse lejemål',
    subtitle: 'Aalborg Dental · sagsfrist',
    type: 'case',
    companyId: 'c4',
    companyName: 'Aalborg Dental Group',
    aiExtracted: true,
    href: '/proto/portfolio/c4',
  },
  {
    id: 'cal-8',
    date: '2026-04-05',
    title: 'Udløb: Huslejekontrakt',
    subtitle: 'Vesterbro Tandlæge',
    type: 'expiry',
    companyId: 'c6',
    companyName: 'Vesterbro Tandlæge ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-6',
  },
  {
    id: 'cal-9',
    date: '2026-04-06',
    title: 'Fornyelse underskrevet',
    subtitle: 'Aarhus Smile · automatisk fornyelse',
    type: 'renewal',
    companyId: 'c5',
    companyName: 'Aarhus Smile ApS',
    aiExtracted: true,
    href: '/proto/contracts/con-5',
  },
  {
    id: 'cal-10',
    date: '2026-04-14',
    title: 'Besøg — Sundby Dental',
    subtitle: 'Opfølgning · kl. 14:00',
    type: 'meeting',
    companyId: 'c2',
    companyName: 'Sundby Dental ApS',
    aiExtracted: false,
    href: '/proto/portfolio/c2',
  },
]

export function getCalendarEvents(year: number, month: number): MockCalendarEvent[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return mockCalendarEvents.filter((e) => e.date.startsWith(prefix))
}

export function getUpcomingCalendarEvents(fromDate: string, days: number): MockCalendarEvent[] {
  const from = new Date(fromDate)
  const to = new Date(fromDate)
  to.setDate(to.getDate() + days)

  return mockCalendarEvents
    .filter((e) => {
      const d = new Date(e.date)
      return d >= from && d <= to
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function getEventTypeColor(type: MockCalendarEvent['type']): string {
  switch (type) {
    case 'expiry':
      return '#ef4444'
    case 'deadline':
      return '#f59e0b'
    case 'meeting':
      return '#3b82f6'
    case 'case':
      return '#8b5cf6'
    case 'renewal':
      return '#22c55e'
  }
}

export function getEventTypeLabel(type: MockCalendarEvent['type']): string {
  switch (type) {
    case 'expiry':
      return 'Udløb'
    case 'deadline':
      return 'Frist'
    case 'meeting':
      return 'Besøg/møde'
    case 'case':
      return 'Sag'
    case 'renewal':
      return 'Fornyelse'
  }
}
```

- [ ] **Step 3: Verificér TypeScript**

Run: `npx tsc --noEmit`
Forventet: Ingen fejl.

- [ ] **Step 4: Commit**

```bash
git add src/mock/types.ts src/mock/calendar.ts
git commit -m "feat(prototype): tilføj mock kalender-events med AI-flag"
```

---

## Task 5: CalendarWidget komponent

**Files:**

- Create: `src/components/prototype/CalendarWidget.tsx`

- [ ] **Step 1: Opret CalendarWidget**

```tsx
// src/components/prototype/CalendarWidget.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getCalendarEvents, getUpcomingCalendarEvents, getEventTypeColor } from '@/mock/calendar'
import type { MockCalendarEvent } from '@/mock/types'

const WEEKDAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']

const LEGEND: { type: MockCalendarEvent['type']; label: string; color: string }[] = [
  { type: 'expiry', label: 'Udløb', color: '#ef4444' },
  { type: 'deadline', label: 'Frist', color: '#f59e0b' },
  { type: 'meeting', label: 'Besøg/møde', color: '#3b82f6' },
  { type: 'case', label: 'Sag', color: '#8b5cf6' },
  { type: 'renewal', label: 'Fornyelse', color: '#22c55e' },
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

function formatEventDate(dateStr: string, today: string): string {
  if (dateStr === today) return 'I dag'
  const d = new Date(dateStr)
  return `${d.getDate()}. ${['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][d.getMonth()]}`
}

export function CalendarWidget() {
  const today = '2026-03-31' // Mock "today"
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(3)

  const events = getCalendarEvents(year, month)
  const upcoming = getUpcomingCalendarEvents(today, 7)
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  // Previous month padding
  const prevMonthDays = getDaysInMonth(year, month === 1 ? 12 : month - 1)
  const prevDays = Array.from({ length: firstDay }, (_, i) => prevMonthDays - firstDay + 1 + i)

  // Current month days
  const currentDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Next month padding
  const totalCells = prevDays.length + currentDays.length
  const nextDays = Array.from({ length: (7 - (totalCells % 7)) % 7 }, (_, i) => i + 1)

  function getDotsForDay(day: number): MockCalendarEvent[] {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => e.date === dateStr).slice(0, 3)
  }

  function isToday(day: number): boolean {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` === today
  }

  const monthNames = [
    'Januar',
    'Februar',
    'Marts',
    'April',
    'Maj',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'December',
  ]

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else setMonth(month - 1)
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else setMonth(month + 1)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-slate-900">
          {monthNames[month - 1]} {year}
        </div>
        <div className="flex gap-1">
          <button
            onClick={prevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            ‹
          </button>
          <button
            onClick={nextMonth}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 mb-4">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-gray-400">
            {d}
          </div>
        ))}

        {/* Previous month */}
        {prevDays.map((d) => (
          <div
            key={`prev-${d}`}
            className="py-1.5 text-center text-[13px] text-gray-300 rounded-lg"
          >
            {d}
            <div className="flex justify-center gap-0.5 mt-0.5 min-h-[6px]" />
          </div>
        ))}

        {/* Current month */}
        {currentDays.map((d) => {
          const dots = getDotsForDay(d)
          return (
            <div
              key={d}
              className={cn(
                'py-1.5 text-center text-[13px] font-medium rounded-lg cursor-pointer transition-colors',
                isToday(d)
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              {d}
              <div className="flex justify-center gap-0.5 mt-0.5 min-h-[6px]">
                {dots.map((ev) => (
                  <div
                    key={ev.id}
                    className="h-[5px] w-[5px] rounded-full"
                    style={{ backgroundColor: isToday(d) ? '#fff' : getEventTypeColor(ev.type) }}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Next month */}
        {nextDays.map((d) => (
          <div
            key={`next-${d}`}
            className="py-1.5 text-center text-[13px] text-gray-300 rounded-lg"
          >
            {d}
            <div className="flex justify-center gap-0.5 mt-0.5 min-h-[6px]" />
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 mb-3.5" />

      {/* Upcoming events */}
      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-400 mb-2.5">
        Kommende 7 dage
      </div>

      <div className="space-y-0">
        {upcoming.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start gap-2.5 border-b border-slate-50/80 py-2 last:border-none"
          >
            <div
              className="mt-0.5 w-1 min-h-[28px] self-stretch rounded-full"
              style={{ backgroundColor: getEventTypeColor(ev.type) }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-slate-800">{ev.title}</div>
              <div className="text-[11px] text-gray-400">
                {ev.subtitle}
                {ev.aiExtracted && (
                  <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">
                    AI
                  </span>
                )}
              </div>
            </div>
            <div
              className={cn(
                'shrink-0 text-[11px] tabular-nums',
                ev.type === 'expiry' ? 'font-medium text-red-600' : 'text-gray-400'
              )}
            >
              {formatEventDate(ev.date, today)}
            </div>
          </div>
        ))}
        {upcoming.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-400">Ingen events de næste 7 dage</div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
        {LEGEND.map((l) => (
          <div key={l.type} className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Full calendar link */}
      <div className="mt-3 text-center">
        <Link
          href="/proto/calendar"
          className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
        >
          Åbn fuld kalender →
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificér TypeScript**

Run: `npx tsc --noEmit`
Forventet: Ingen fejl.

- [ ] **Step 3: Commit**

```bash
git add src/components/prototype/CalendarWidget.tsx
git commit -m "feat(prototype): tilføj CalendarWidget med AI-badge og event-dots"
```

---

## Task 6: Nyt dashboard med rollebaseret auto-tilpasning

**Files:**

- Modify: `src/app/proto/dashboard/page.tsx` (komplet rewrite)
- Modify: `src/mock/helpers.ts` (tilføj rolle-sektions-helper)

- [ ] **Step 1: Tilføj getDashboardSectionsForRole i helpers.ts**

Tilføj i bunden af `src/mock/helpers.ts`:

```typescript
export type DashboardSection =
  | 'kpi'
  | 'urgency'
  | 'health'
  | 'calendar'
  | 'coverage'
  | 'cases'
  | 'finance'
  | 'finance_alerts'
  | 'top_locations'
  | 'loss_locations'
  | 'finance_contracts'
  | 'legal_docs'

export function getDashboardSectionsForRole(role: MockRole): DashboardSection[] {
  switch (role) {
    case 'GROUP_OWNER':
      return [
        'kpi',
        'urgency',
        'health',
        'calendar',
        'coverage',
        'cases',
        'finance',
        'finance_alerts',
      ]
    case 'GROUP_LEGAL':
      return ['kpi', 'urgency', 'cases', 'calendar', 'coverage', 'legal_docs']
    case 'GROUP_FINANCE':
      return [
        'kpi',
        'top_locations',
        'finance_alerts',
        'calendar',
        'loss_locations',
        'finance_contracts',
      ]
    case 'GROUP_ADMIN':
      return ['kpi', 'urgency', 'health', 'calendar']
    case 'COMPANY_MANAGER':
      return ['kpi', 'urgency', 'calendar']
    default:
      return ['kpi', 'urgency', 'calendar']
  }
}
```

Tilføj `MockRole` import øverst i filen hvis den ikke allerede er der:

```typescript
import type { MockRole } from './types'
```

- [ ] **Step 2: Rewrite dashboard/page.tsx**

Erstat hele indholdet af `src/app/proto/dashboard/page.tsx` med det nye rollebaserede dashboard. Filen skal:

1. Importere alle nye komponenter (KpiCard, UrgencyList, HealthBar, CompanyRow, CoverageBar, FinRow, SectionHeader, CalendarWidget)
2. Bruge `usePrototype()` til at hente `activeUser` og `dataScenario`
3. Kalde `getDashboardSectionsForRole(activeUser.role)` for at bestemme synlige sektioner
4. Rendere KPI-grid (4 kort) øverst — med rollespecifikke KPI'er
5. Under KPI: content-grid med urgency-liste (venstre) og kalender-widget (højre)
6. For GROUP_OWNER: sektions-headers "Juridisk" og "Økonomi" med relevante blokke
7. For GROUP_LEGAL: juridiske KPI'er, handlingspunkter, sager, kontraktdækning, dokumenter
8. For GROUP_FINANCE: finansielle KPI'er, top-lokationer, opmærksomhedspunkter

Fuld implementering — dette er den største fil og den centrale side. Se mockup'en (`dashboard-with-calendar.html`) for det eksakte layout og data.

Den eksisterende fil er ~446 linjer. Den nye version bør være ~350-400 linjer takket være komponent-ekstraktion.

**Layout-struktur:**

```tsx
<div>
  {/* KPI grid - altid synlig */}
  <div className="grid grid-cols-4 gap-4 mb-6">
    {roleKpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
  </div>

  {/* Main content: urgency + calendar side by side */}
  <div className="grid grid-cols-[1fr_340px] gap-4 mb-6">
    <div className="space-y-4">
      {sections.includes('urgency') && <UrgencyList ... />}
      {sections.includes('health') && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-900 mb-4">Porteføljesundhed</div>
          <HealthBar ... />
          {/* Company rows under health */}
        </div>
      )}
    </div>
    {sections.includes('calendar') && <CalendarWidget />}
  </div>

  {/* Role-specific sections */}
  {role === 'GROUP_OWNER' && (
    <>
      <SectionHeader title="Juridisk" />
      <div className="grid grid-cols-2 gap-4 mb-6">...</div>
      <SectionHeader title="Økonomi" />
      <div className="grid grid-cols-2 gap-4 mb-6">...</div>
    </>
  )}

  {role === 'GROUP_LEGAL' && (
    <>
      {/* Legal-specific cards */}
    </>
  )}

  {role === 'GROUP_FINANCE' && (
    <>
      {/* Finance-specific cards */}
    </>
  )}
</div>
```

Data hentes fra eksisterende mock-funktioner: `getCompanies()`, `getExpiringContracts()`, `getOverdueTasks()`, `getOpenCases()`, `getContractCoverage()`, `getPortfolioTotals()`.

- [ ] **Step 3: Verificér i browser**

Run: `npm run dev`
Test alle tre roller via RoleSwitcher:

- Philip (GROUP_OWNER) → fuldt dashboard med sektioner
- Maria (GROUP_LEGAL) → juridisk fokus
- Thomas (GROUP_FINANCE) → økonomi fokus

- [ ] **Step 4: Verificér TypeScript**

Run: `npx tsc --noEmit`
Forventet: Ingen fejl.

- [ ] **Step 5: Commit**

```bash
git add src/app/proto/dashboard/page.tsx src/mock/helpers.ts
git commit -m "feat(prototype): rollebaseret auto-tilpasset dashboard med kalender"
```

---

## Task 7: Kalender placeholder-side

**Files:**

- Create: `src/app/proto/calendar/page.tsx`

- [ ] **Step 1: Opret kalenderside placeholder**

```tsx
// src/app/proto/calendar/page.tsx
'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/proto/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbage til dashboard
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <div className="text-4xl mb-4">📅</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Fuld kalender</h1>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
          Her kommer den fulde kalendervisning med dag/uge/måned, filtrering på event-typer, og
          mulighed for at oprette nye events.
        </p>
        <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600">
          Kommer i næste sprint
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificér at siden loader**

Åbn `http://localhost:3000/proto/calendar` — skal vise placeholder.

- [ ] **Step 3: Commit**

```bash
git add src/app/proto/calendar/page.tsx
git commit -m "feat(prototype): tilføj kalender placeholder-side"
```

---

## Task 8: Opdater prototype header

**Files:**

- Modify: `src/components/layout/prototype-header.tsx`

- [ ] **Step 1: Opdater header til nyt design**

Læs den eksisterende `prototype-header.tsx` og opdater til det nye design:

- Hvid baggrund med `border-bottom: 1px solid #e5e7eb`
- Venstre: Greeting (tidsbaseret: Godmorgen/God eftermiddag/God aften) + dato
- Højre: Søgefelt (`bg-slate-50`, `border: 1px solid #e2e8f0`, 260px bred), notifikations-ikon med rød dot, avatar

Brug `usePrototype()` til at hente brugerens navn til greeting.

- [ ] **Step 2: Verificér header i browser**

Åbn `http://localhost:3000/proto/dashboard` — header skal matche mockup'en.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/prototype-header.tsx
git commit -m "feat(prototype): redesign topbar med søgefelt og greeting"
```

---

## Task 9: Final build-verifikation

**Files:** Ingen nye filer.

- [ ] **Step 1: Kør TypeScript check**

Run: `npx tsc --noEmit`
Forventet: Ingen fejl.

- [ ] **Step 2: Kør build**

Run: `npm run build`
Forventet: Build succeeds.

- [ ] **Step 3: Kør tests**

Run: `npm test`
Forventet: Alle eksisterende tests passerer (ingen breaking changes).

- [ ] **Step 4: Manuel browser-test**

Test i browser (`http://localhost:3000/proto/dashboard`):

1. Dashboard loader med nyt design (light mode, hvide kort, blå accent)
2. Sidebar har sektioner (Overblik, Portefølje, Ressourcer) med Kalender-link
3. Skift rolle via RoleSwitcher → dashboard ændrer sig automatisk
4. Kalender-widget viser dots på datoer og kommende events med AI-badge
5. Klik "Åbn fuld kalender →" → navigerer til `/proto/calendar`
6. Alle andre prototype-sider fungerer stadig (portfolio, contracts, tasks, documents, search)

- [ ] **Step 5: Commit alt ustaged**

Sikr at alt er committed:

```bash
git status
```

Hvis der er ustaged ændringer:

```bash
git add -A
git commit -m "chore(prototype): final cleanup efter dashboard redesign"
```
