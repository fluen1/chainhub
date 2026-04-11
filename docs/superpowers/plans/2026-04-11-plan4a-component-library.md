# Plan 4A: Component Library Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 11 UI components from the deleted proto prototype to production, fully decoupled from mock data, with unit tests — as the reusable building blocks for Plan 4B (dashboard + layout) and Plan 4C (tasks/calendar/search/settings).

**Architecture:** Each component becomes a pure, props-driven React component in `src/components/ui/` (atoms) or `src/components/layout/` (chrome). No data fetching inside components — data flows in via props. This lets Plan 4B wire them to real Prisma/Server Action queries without touching component internals. All components are client-safe (`'use client'` where state/interactivity is used).

**Tech Stack:** React 18, TypeScript 5 strict, Tailwind CSS, Vitest + @testing-library/react + jsdom, lucide-react, next/link, next/navigation.

**Source:** Original proto components are in git at commit `8df8ca5~1` under `src/components/prototype/*` and `src/components/layout/prototype-*.tsx`. You can reference the originals with `git show 8df8ca5~1:<path>` — but the plan inlines the final production code for every component so you don't need to.

---

## Scope

### In scope (this plan)
- Types: `src/types/ui.ts` with component interfaces (CalendarEvent, Insight, UrgencyItem, SidebarBadge, InlineKpi, NavSection)
- 9 atoms in `src/components/ui/`:
  - `fin-row.tsx`, `coverage-bar.tsx`, `health-bar.tsx`, `kpi-card.tsx`
  - `section-header.tsx`, `insight-card.tsx`, `urgency-list.tsx`, `company-row.tsx`
  - `calendar-widget.tsx`
- 2 chrome components in `src/components/layout/`:
  - `app-sidebar.tsx` (proto sidebar, renamed — will replace existing `sidebar.tsx` in Plan 4B)
  - `app-header.tsx` (proto header, renamed — will replace existing `header.tsx` in Plan 4B)
- One `.test.tsx` file per component (11 test files total)

### Out of scope (Plan 4B / 4C)
- Wiring components to real data (Plan 4B)
- Replacing `app/(dashboard)/layout.tsx` (Plan 4B)
- Deleting the old `sidebar.tsx`/`header.tsx`/`MobileNav.tsx` (Plan 4B)
- Dashboard page migration (Plan 4B)
- Tasks / Calendar / Search / Settings pages (Plan 4C)

### Key design decisions
- **No mock imports.** All proto components imported from `@/mock/*`. We rip those out — every component takes all needed data via props.
- **No `usePrototype`.** Proto used a role provider. The new components receive `role` and `userName` as props.
- **New naming.** `ProtoCoverageBar` → `CoverageBar`. Layout components get `app-` prefix to avoid colliding with existing `sidebar.tsx`/`header.tsx` until Plan 4B swaps them in.
- **kebab-case filenames, PascalCase exports.** Matches shadcn/ui convention.
- **Pure client components.** `'use client'` at top, no server-side data fetching.

---

## Task 0: Setup — shared types + directory structure

**Files:**
- Create: `src/types/ui.ts`
- Verify: `src/components/ui/` directory exists (it should — shadcn-style)

- [ ] **Step 0.1: Verify ui directory exists**

Run: `ls src/components/ui | head -5`
Expected: lists existing files (Pagination.tsx, SearchAndFilter.tsx, etc.)

- [ ] **Step 0.2: Create shared UI types file**

Create `src/types/ui.ts`:

```typescript
// ---------------------------------------------------------------
// Delte UI-typer — bruges af proto-migrerede komponenter
// ---------------------------------------------------------------

export type CalendarEventType = 'expiry' | 'deadline' | 'meeting' | 'case' | 'renewal'

export interface CalendarEvent {
  id: string
  date: string // 'YYYY-MM-DD'
  title: string
  subtitle: string
  type: CalendarEventType
  aiExtracted?: boolean
}

export type InsightType = 'critical' | 'warning' | 'info' | 'coverage'

export interface Insight {
  id: string
  type: InsightType
  icon: 'AlertTriangle' | 'TrendingDown' | 'FileWarning' | 'BarChart3' | 'CheckCircle2'
  title: string
  description: string
  actionLabel: string
  actionHref: string
}

export interface UrgencyItem {
  id: string
  name: string
  subtitle: string
  days: string
  indicator: 'red' | 'amber' | 'blue'
  overdue?: boolean
  href?: string
}

export interface SidebarBadge {
  count: number
  urgency: 'critical' | 'neutral'
}

export interface InlineKpi {
  label: string
  value: string
  color?: 'amber' | 'red'
}

export interface NavItem {
  name: string
  href: string
  iconName: 'LayoutDashboard' | 'Building2' | 'FileText' | 'CheckSquare' | 'FolderOpen' | 'Calendar' | 'Users' | 'Briefcase'
  badgeKey: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}

// Hjælper: map CalendarEventType → hex-farve (bruges af widget + kalender-side)
export function getEventTypeColor(type: CalendarEventType): string {
  switch (type) {
    case 'expiry':   return '#ef4444'
    case 'deadline': return '#f59e0b'
    case 'meeting':  return '#3b82f6'
    case 'case':     return '#8b5cf6'
    case 'renewal':  return '#22c55e'
  }
}
```

- [ ] **Step 0.3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean exit, no errors.

- [ ] **Step 0.4: Commit**

```bash
git add src/types/ui.ts
git commit -m "feat(types): add shared UI types for plan 4a component library"
```

---

## Task 1: FinRow — finans-række til paneler

**Files:**
- Create: `src/components/ui/fin-row.tsx`
- Test: `src/__tests__/components/fin-row.test.tsx`

- [ ] **Step 1.1: Create component**

Create `src/components/ui/fin-row.tsx`:

```tsx
'use client'

import { cn } from '@/lib/utils'

export interface FinRowProps {
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

- [ ] **Step 1.2: Write failing test**

Create `src/__tests__/components/fin-row.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinRow } from '@/components/ui/fin-row'

describe('FinRow', () => {
  it('renderer label og value', () => {
    render(<FinRow label="Omsætning" value="28.6M" />)
    expect(screen.getByText('Omsætning')).toBeInTheDocument()
    expect(screen.getByText('28.6M')).toBeInTheDocument()
  })

  it('anvender valueColor inline style', () => {
    render(<FinRow label="Forfaldne" value="340k" valueColor="#ef4444" />)
    const val = screen.getByText('340k')
    expect(val).toHaveStyle({ color: '#ef4444' })
  })

  it('viser trend med grøn baggrund for up', () => {
    render(<FinRow label="EBITDA" value="5.6M" trend={{ text: '+12%', direction: 'up' }} />)
    const trend = screen.getByText('+12%')
    expect(trend).toHaveClass('bg-green-50', 'text-green-600')
  })

  it('viser trend med rød baggrund for down', () => {
    render(<FinRow label="Margin" value="8.4%" trend={{ text: '-3%', direction: 'down' }} />)
    const trend = screen.getByText('-3%')
    expect(trend).toHaveClass('bg-red-50', 'text-red-600')
  })

  it('skjuler trend når ikke angivet', () => {
    render(<FinRow label="Lokationer" value="7" />)
    expect(screen.queryByText(/%/)).toBeNull()
  })
})
```

- [ ] **Step 1.3: Run test**

Run: `npx vitest run src/__tests__/components/fin-row.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 1.4: Commit**

```bash
git add src/components/ui/fin-row.tsx src/__tests__/components/fin-row.test.tsx
git commit -m "feat(ui): add FinRow component from proto with unit tests"
```

---

## Task 2: CoverageBar — kontraktdæknings-bar

**Files:**
- Create: `src/components/ui/coverage-bar.tsx`
- Test: `src/__tests__/components/coverage-bar.test.tsx`

- [ ] **Step 2.1: Create component**

Create `src/components/ui/coverage-bar.tsx`:

```tsx
'use client'

import { cn } from '@/lib/utils'

export interface CoverageBarProps {
  label: string
  percentage: number
}

export function CoverageBar({ label, percentage }: CoverageBarProps) {
  const fillColor = percentage >= 100
    ? 'bg-green-500'
    : percentage >= 75
      ? 'bg-blue-500'
      : 'bg-amber-500'

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

- [ ] **Step 2.2: Write failing test**

Create `src/__tests__/components/coverage-bar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoverageBar } from '@/components/ui/coverage-bar'

describe('CoverageBar', () => {
  it('renderer label og procent', () => {
    render(<CoverageBar label="Ejeraftale" percentage={85} />)
    expect(screen.getByText('Ejeraftale')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('bruger grøn farve ved 100%', () => {
    const { container } = render(<CoverageBar label="Fuld dækning" percentage={100} />)
    const fill = container.querySelector('.bg-green-500')
    expect(fill).not.toBeNull()
  })

  it('bruger blå farve ved 75-99%', () => {
    const { container } = render(<CoverageBar label="Delvis" percentage={80} />)
    expect(container.querySelector('.bg-blue-500')).not.toBeNull()
  })

  it('bruger amber farve under 75%', () => {
    const { container } = render(<CoverageBar label="Lav" percentage={40} />)
    expect(container.querySelector('.bg-amber-500')).not.toBeNull()
  })

  it('sætter width inline style på fill-div', () => {
    const { container } = render(<CoverageBar label="Test" percentage={42} />)
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('42%')
  })
})
```

- [ ] **Step 2.3: Run test**

Run: `npx vitest run src/__tests__/components/coverage-bar.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 2.4: Commit**

```bash
git add src/components/ui/coverage-bar.tsx src/__tests__/components/coverage-bar.test.tsx
git commit -m "feat(ui): add CoverageBar component from proto with unit tests"
```

---

## Task 3: HealthBar — portfolio health-indicator

**Files:**
- Create: `src/components/ui/health-bar.tsx`
- Test: `src/__tests__/components/health-bar.test.tsx`

- [ ] **Step 3.1: Create component**

Create `src/components/ui/health-bar.tsx`:

```tsx
'use client'

export interface HealthBarProps {
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

- [ ] **Step 3.2: Write failing test**

Create `src/__tests__/components/health-bar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthBar } from '@/components/ui/health-bar'

describe('HealthBar', () => {
  it('viser alle tre tal med danske labels', () => {
    render(<HealthBar healthy={5} warning={2} critical={1} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Sund')).toBeInTheDocument()
    expect(screen.getByText('Advarsel')).toBeInTheDocument()
    expect(screen.getByText('Kritisk')).toBeInTheDocument()
  })

  it('sætter flex-ratio på segment-bars', () => {
    const { container } = render(<HealthBar healthy={10} warning={3} critical={2} />)
    const segments = container.querySelectorAll('.h-2 > div')
    expect(segments).toHaveLength(3)
    expect((segments[0] as HTMLElement).style.flex).toBe('10 1 0%')
    expect((segments[1] as HTMLElement).style.flex).toBe('3 1 0%')
    expect((segments[2] as HTMLElement).style.flex).toBe('2 1 0%')
  })

  it('håndterer nul-værdier', () => {
    render(<HealthBar healthy={0} warning={0} critical={0} />)
    const zeros = screen.getAllByText('0')
    expect(zeros).toHaveLength(3)
  })
})
```

- [ ] **Step 3.3: Run test**

Run: `npx vitest run src/__tests__/components/health-bar.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 3.4: Commit**

```bash
git add src/components/ui/health-bar.tsx src/__tests__/components/health-bar.test.tsx
git commit -m "feat(ui): add HealthBar component from proto with unit tests"
```

---

## Task 4: KpiCard — dashboard KPI-kort

**Files:**
- Create: `src/components/ui/kpi-card.tsx`
- Test: `src/__tests__/components/kpi-card.test.tsx`

- [ ] **Step 4.1: Create component**

Create `src/components/ui/kpi-card.tsx`:

```tsx
'use client'

import { cn } from '@/lib/utils'

export interface KpiCardProps {
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

- [ ] **Step 4.2: Write failing test**

Create `src/__tests__/components/kpi-card.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KpiCard } from '@/components/ui/kpi-card'

describe('KpiCard', () => {
  it('renderer label og value', () => {
    render(<KpiCard label="Selskaber" value={7} />)
    expect(screen.getByText('Selskaber')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('bruger amber farve ved valueColor=warning', () => {
    render(<KpiCard label="Udløbende" value="3" valueColor="warning" />)
    expect(screen.getByText('3')).toHaveClass('text-amber-600')
  })

  it('bruger rød farve ved valueColor=danger', () => {
    render(<KpiCard label="Forfaldne" value="12" valueColor="danger" />)
    expect(screen.getByText('12')).toHaveClass('text-red-600')
  })

  it('kalder onClick når kortet klikkes', () => {
    const handleClick = vi.fn()
    render(<KpiCard label="Klik mig" value="42" onClick={handleClick} />)
    fireEvent.click(screen.getByText('42'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('viser trend-badge med korrekt farve', () => {
    render(<KpiCard label="Omsætning" value="28M" trend={{ text: '+8%', direction: 'up' }} />)
    expect(screen.getByText('+8%')).toHaveClass('bg-green-50')
  })
})
```

- [ ] **Step 4.3: Run test**

Run: `npx vitest run src/__tests__/components/kpi-card.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 4.4: Commit**

```bash
git add src/components/ui/kpi-card.tsx src/__tests__/components/kpi-card.test.tsx
git commit -m "feat(ui): add KpiCard component from proto with unit tests"
```

---

## Task 5: SectionHeader — sektion-divider

**Files:**
- Create: `src/components/ui/section-header.tsx`
- Test: `src/__tests__/components/section-header.test.tsx`

- [ ] **Step 5.1: Create component**

Create `src/components/ui/section-header.tsx`:

```tsx
export interface SectionHeaderProps {
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

- [ ] **Step 5.2: Write failing test**

Create `src/__tests__/components/section-header.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionHeader } from '@/components/ui/section-header'

describe('SectionHeader', () => {
  it('renderer title i uppercase-tracking', () => {
    render(<SectionHeader title="Porteføljeoverblik" />)
    const el = screen.getByText('Porteføljeoverblik')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('uppercase', 'tracking-[0.08em]')
  })

  it('renderer divider-linjen', () => {
    const { container } = render(<SectionHeader title="Test" />)
    expect(container.querySelector('.h-px.bg-gray-200')).not.toBeNull()
  })
})
```

- [ ] **Step 5.3: Run test**

Run: `npx vitest run src/__tests__/components/section-header.test.tsx`
Expected: 2 tests pass.

- [ ] **Step 5.4: Commit**

```bash
git add src/components/ui/section-header.tsx src/__tests__/components/section-header.test.tsx
git commit -m "feat(ui): add SectionHeader component from proto with unit tests"
```

---

## Task 6: InsightCard — AI-indsigter med dismiss

**Files:**
- Create: `src/components/ui/insight-card.tsx`
- Test: `src/__tests__/components/insight-card.test.tsx`

**Change from proto:** Imports `Insight` type from `@/types/ui` instead of `@/mock/types`. Otherwise identical.

- [ ] **Step 6.1: Create component**

Create `src/components/ui/insight-card.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { AlertTriangle, TrendingDown, FileWarning, BarChart3, CheckCircle2, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight, InsightType } from '@/types/ui'

export interface InsightCardProps {
  insight: Insight
}

const colorMap: Record<InsightType, string> = {
  critical: 'border-red-500',
  warning: 'border-amber-500',
  info: 'border-blue-500',
  coverage: 'border-amber-500',
}

const iconBgMap: Record<InsightType, string> = {
  critical: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  coverage: 'text-amber-500',
}

const iconMap: Record<string, React.ElementType> = {
  AlertTriangle,
  TrendingDown,
  FileWarning,
  BarChart3,
  CheckCircle2,
}

export function InsightCard({ insight }: InsightCardProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const IconComponent = iconMap[insight.icon] ?? AlertTriangle

  return (
    <div
      className={cn(
        'border-l-4 rounded-r-xl px-4 py-3 bg-white shadow-sm',
        colorMap[insight.type],
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 shrink-0', iconBgMap[insight.type])}>
          <IconComponent className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{insight.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{insight.description}</p>
          <a
            href={insight.actionHref}
            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            {insight.actionLabel}
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Afvis"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: Write failing test**

Create `src/__tests__/components/insight-card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InsightCard } from '@/components/ui/insight-card'
import type { Insight } from '@/types/ui'

const sample: Insight = {
  id: 'i1',
  type: 'critical',
  icon: 'AlertTriangle',
  title: 'Ejeraftale mangler',
  description: 'Nordklinik ApS har ingen ejeraftale registreret',
  actionLabel: 'Opret nu',
  actionHref: '/contracts/new',
}

describe('InsightCard', () => {
  it('viser title, description og action-label', () => {
    render(<InsightCard insight={sample} />)
    expect(screen.getByText('Ejeraftale mangler')).toBeInTheDocument()
    expect(screen.getByText(/Nordklinik ApS/)).toBeInTheDocument()
    expect(screen.getByText('Opret nu')).toBeInTheDocument()
  })

  it('link peger på actionHref', () => {
    render(<InsightCard insight={sample} />)
    const link = screen.getByRole('link', { name: /Opret nu/ })
    expect(link).toHaveAttribute('href', '/contracts/new')
  })

  it('bruger rød venstre-border ved type=critical', () => {
    const { container } = render(<InsightCard insight={sample} />)
    expect(container.querySelector('.border-red-500')).not.toBeNull()
  })

  it('bruger amber border ved type=warning', () => {
    const warning: Insight = { ...sample, type: 'warning' }
    const { container } = render(<InsightCard insight={warning} />)
    expect(container.querySelector('.border-amber-500')).not.toBeNull()
  })

  it('fjernes fra DOM når luk-knap klikkes', () => {
    render(<InsightCard insight={sample} />)
    fireEvent.click(screen.getByRole('button', { name: 'Afvis' }))
    expect(screen.queryByText('Ejeraftale mangler')).toBeNull()
  })
})
```

- [ ] **Step 6.3: Run test**

Run: `npx vitest run src/__tests__/components/insight-card.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 6.4: Commit**

```bash
git add src/components/ui/insight-card.tsx src/__tests__/components/insight-card.test.tsx
git commit -m "feat(ui): add InsightCard component from proto with unit tests"
```

---

## Task 7: UrgencyList — liste af urgency-items

**Files:**
- Create: `src/components/ui/urgency-list.tsx`
- Test: `src/__tests__/components/urgency-list.test.tsx`

**Change from proto:** Imports `UrgencyItem` from `@/types/ui`.

- [ ] **Step 7.1: Create component**

Create `src/components/ui/urgency-list.tsx`:

```tsx
'use client'

import { cn } from '@/lib/utils'
import type { UrgencyItem } from '@/types/ui'

export interface UrgencyListProps {
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
          <a href={viewAllHref} className="text-xs font-medium text-blue-500 hover:text-blue-600">
            Se alle →
          </a>
        )}
      </div>
      <div className="space-y-0">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 border-b border-slate-50 py-2.5 last:border-none">
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
        {items.length === 0 && (
          <div className="py-6 text-center text-xs text-gray-400">Ingen punkter</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2: Write failing test**

Create `src/__tests__/components/urgency-list.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UrgencyList } from '@/components/ui/urgency-list'
import type { UrgencyItem } from '@/types/ui'

const items: UrgencyItem[] = [
  { id: 'u1', name: 'Ejeraftale Nordklinik', subtitle: 'Nordklinik ApS', days: '3d over', indicator: 'red', overdue: true },
  { id: 'u2', name: 'Huslejekontrakt Sundby', subtitle: 'Sundby Dental', days: '14 dage', indicator: 'amber' },
]

describe('UrgencyList', () => {
  it('renderer title', () => {
    render(<UrgencyList title="Kræver handling" items={items} />)
    expect(screen.getByText('Kræver handling')).toBeInTheDocument()
  })

  it('renderer alle items', () => {
    render(<UrgencyList title="Test" items={items} />)
    expect(screen.getByText('Ejeraftale Nordklinik')).toBeInTheDocument()
    expect(screen.getByText('Huslejekontrakt Sundby')).toBeInTheDocument()
  })

  it('overdue items har rød tekst på days', () => {
    render(<UrgencyList title="Test" items={items} />)
    const days = screen.getByText('3d over')
    expect(days).toHaveClass('text-red-600')
  })

  it('viser viewAllHref link når angivet', () => {
    render(<UrgencyList title="Test" items={items} viewAllHref="/tasks" />)
    const link = screen.getByRole('link', { name: /Se alle/ })
    expect(link).toHaveAttribute('href', '/tasks')
  })

  it('viser tom-state når items er tomme', () => {
    render(<UrgencyList title="Tom liste" items={[]} />)
    expect(screen.getByText('Ingen punkter')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7.3: Run test**

Run: `npx vitest run src/__tests__/components/urgency-list.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 7.4: Commit**

```bash
git add src/components/ui/urgency-list.tsx src/__tests__/components/urgency-list.test.tsx
git commit -m "feat(ui): add UrgencyList component from proto with unit tests"
```

---

## Task 8: CompanyRow — selskabs-række med status

**Files:**
- Create: `src/components/ui/company-row.tsx`
- Test: `src/__tests__/components/company-row.test.tsx`

- [ ] **Step 8.1: Create component**

Create `src/components/ui/company-row.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface CompanyRowProps {
  initials: string
  name: string
  meta: string
  status: { label: string; type: 'ok' | 'warning' | 'critical' }
  avatarColor: string
  href?: string
}

export function CompanyRow({ initials, name, meta, status, avatarColor, href }: CompanyRowProps) {
  const content = (
    <>
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
    </>
  )

  const className = 'flex items-center gap-3 border-b border-slate-50 py-2.5 last:border-none'

  if (href) {
    return <Link href={href} className={cn(className, 'cursor-pointer hover:bg-slate-50')}>{content}</Link>
  }
  return <div className={className}>{content}</div>
}
```

- [ ] **Step 8.2: Write failing test**

Create `src/__tests__/components/company-row.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompanyRow } from '@/components/ui/company-row'

describe('CompanyRow', () => {
  it('renderer initials, navn og meta', () => {
    render(
      <CompanyRow
        initials="TØ"
        name="Tandlæge Østerbro ApS"
        meta="CVR 87654321"
        status={{ label: 'Aktiv', type: 'ok' }}
        avatarColor="#3b82f6"
      />
    )
    expect(screen.getByText('TØ')).toBeInTheDocument()
    expect(screen.getByText('Tandlæge Østerbro ApS')).toBeInTheDocument()
    expect(screen.getByText('CVR 87654321')).toBeInTheDocument()
  })

  it('viser status badge med grøn farve for ok', () => {
    render(
      <CompanyRow
        initials="X" name="Test" meta="t" avatarColor="#000"
        status={{ label: 'Aktiv', type: 'ok' }}
      />
    )
    expect(screen.getByText('Aktiv')).toHaveClass('bg-green-50', 'text-green-600')
  })

  it('wrapper i <a> når href er angivet', () => {
    render(
      <CompanyRow
        initials="X" name="Klikbar" meta="t" avatarColor="#000"
        status={{ label: 'Aktiv', type: 'ok' }}
        href="/companies/123"
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/companies/123')
  })

  it('anvender avatarColor som inline backgroundColor', () => {
    render(
      <CompanyRow
        initials="AB" name="T" meta="t" avatarColor="#ef4444"
        status={{ label: 'Kritisk', type: 'critical' }}
      />
    )
    const avatar = screen.getByText('AB')
    expect(avatar).toHaveStyle({ backgroundColor: 'rgb(239, 68, 68)' })
  })
})
```

- [ ] **Step 8.3: Run test**

Run: `npx vitest run src/__tests__/components/company-row.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 8.4: Commit**

```bash
git add src/components/ui/company-row.tsx src/__tests__/components/company-row.test.tsx
git commit -m "feat(ui): add CompanyRow component from proto with unit tests"
```

---

## Task 9: CalendarWidget — månedskalender + kommende events

**Files:**
- Create: `src/components/ui/calendar-widget.tsx`
- Test: `src/__tests__/components/calendar-widget.test.tsx`

**Changes from proto:**
- Takes `events: CalendarEvent[]`, `upcoming: CalendarEvent[]`, `today: string` as props (no mock imports)
- Link destination: `/calendar` instead of `/proto/calendar`
- Default today = `new Date().toISOString().slice(0, 10)` if prop omitted
- Initial month/year derives from `today`
- Uses `getEventTypeColor` from `@/types/ui`

- [ ] **Step 9.1: Create component**

Create `src/components/ui/calendar-widget.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getEventTypeColor, type CalendarEvent, type CalendarEventType } from '@/types/ui'

const WEEKDAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']

const LEGEND: { type: CalendarEventType; label: string; color: string }[] = [
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
  return day === 0 ? 6 : day - 1
}

function formatEventDate(dateStr: string, today: string): string {
  if (dateStr === today) return 'I dag'
  const d = new Date(dateStr)
  return `${d.getDate()}. ${['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'][d.getMonth()]}`
}

export interface CalendarWidgetProps {
  events: CalendarEvent[]
  upcoming: CalendarEvent[]
  today?: string // 'YYYY-MM-DD' — defaults to new Date()
  fullCalendarHref?: string // defaults to /calendar
}

export function CalendarWidget({
  events,
  upcoming,
  today = new Date().toISOString().slice(0, 10),
  fullCalendarHref = '/calendar',
}: CalendarWidgetProps) {
  const initialYear = parseInt(today.slice(0, 4), 10)
  const initialMonth = parseInt(today.slice(5, 7), 10)
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  const prevMonthDays = getDaysInMonth(year, month === 1 ? 12 : month - 1)
  const prevDays = Array.from({ length: firstDay }, (_, i) => prevMonthDays - firstDay + 1 + i)
  const currentDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const totalCells = prevDays.length + currentDays.length
  const nextDays = Array.from({ length: (7 - (totalCells % 7)) % 7 }, (_, i) => i + 1)

  function getDotsForDay(day: number): CalendarEvent[] {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => e.date === dateStr).slice(0, 3)
  }

  function isToday(day: number): boolean {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` === today
  }

  const monthNames = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December']

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12) }
    else setMonth(month - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1) }
    else setMonth(month + 1)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-slate-900">{monthNames[month - 1]} {year}</div>
        <div className="flex gap-1">
          <button type="button" onClick={prevMonth} aria-label="Forrige måned" className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">‹</button>
          <button type="button" onClick={nextMonth} aria-label="Næste måned" className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-4">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-gray-400">{d}</div>
        ))}
        {prevDays.map((d) => (
          <div key={`prev-${d}`} className="py-1.5 text-center text-[13px] text-gray-300 rounded-lg">
            {d}
            <div className="flex justify-center gap-0.5 mt-0.5 min-h-[6px]" />
          </div>
        ))}
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
        {nextDays.map((d) => (
          <div key={`next-${d}`} className="py-1.5 text-center text-[13px] text-gray-300 rounded-lg">
            {d}
            <div className="flex justify-center gap-0.5 mt-0.5 min-h-[6px]" />
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-100 mb-3.5" />

      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-400 mb-2.5">
        Kommende 7 dage
      </div>

      <div className="space-y-0">
        {upcoming.map((ev) => (
          <div key={ev.id} className="flex items-start gap-2.5 border-b border-slate-50/80 py-2 last:border-none">
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

      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
        {LEGEND.map((l) => (
          <div key={l.type} className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      <div className="mt-3 text-center">
        <Link href={fullCalendarHref} className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors">
          Åbn fuld kalender →
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Write failing test**

Create `src/__tests__/components/calendar-widget.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarWidget } from '@/components/ui/calendar-widget'
import type { CalendarEvent } from '@/types/ui'

const events: CalendarEvent[] = [
  { id: 'e1', date: '2026-04-11', title: 'Udløb lejekontrakt', subtitle: 'Tandlæge Østerbro', type: 'expiry' },
  { id: 'e2', date: '2026-04-15', title: 'Bestyrelsesmøde', subtitle: 'TandlægeGruppen', type: 'meeting' },
  { id: 'e3', date: '2026-04-20', title: 'Sagsfrist', subtitle: 'Lejeforhandling', type: 'deadline', aiExtracted: true },
]

const upcoming: CalendarEvent[] = [events[0], events[1]]

describe('CalendarWidget', () => {
  it('viser månedsnavn og år', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    expect(screen.getByText('April 2026')).toBeInTheDocument()
  })

  it('viser kommende events-liste', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    expect(screen.getByText('Udløb lejekontrakt')).toBeInTheDocument()
    expect(screen.getByText('Bestyrelsesmøde')).toBeInTheDocument()
  })

  it('viser "I dag" for event på today-datoen', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    expect(screen.getByText('I dag')).toBeInTheDocument()
  })

  it('viser AI-badge for aiExtracted events', () => {
    render(<CalendarWidget events={events} upcoming={[events[2]]} today="2026-04-11" />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('navigerer til næste måned ved klik på højre-pil', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    fireEvent.click(screen.getByLabelText('Næste måned'))
    expect(screen.getByText('Maj 2026')).toBeInTheDocument()
  })

  it('navigerer til forrige måned ved klik på venstre-pil', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    fireEvent.click(screen.getByLabelText('Forrige måned'))
    expect(screen.getByText('Marts 2026')).toBeInTheDocument()
  })

  it('viser tom-state hvis upcoming er tomt', () => {
    render(<CalendarWidget events={[]} upcoming={[]} today="2026-04-11" />)
    expect(screen.getByText('Ingen events de næste 7 dage')).toBeInTheDocument()
  })

  it('link peger på fullCalendarHref', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" fullCalendarHref="/calendar" />)
    const link = screen.getByRole('link', { name: /Åbn fuld kalender/ })
    expect(link).toHaveAttribute('href', '/calendar')
  })
})
```

- [ ] **Step 9.3: Run test**

Run: `npx vitest run src/__tests__/components/calendar-widget.test.tsx`
Expected: 8 tests pass.

- [ ] **Step 9.4: Commit**

```bash
git add src/components/ui/calendar-widget.tsx src/__tests__/components/calendar-widget.test.tsx
git commit -m "feat(ui): add CalendarWidget component from proto with unit tests"
```

---

## Task 10: AppSidebar — proto-designet sidebar

**Files:**
- Create: `src/components/layout/app-sidebar.tsx`
- Test: `src/__tests__/components/app-sidebar.test.tsx`

**Changes from proto:**
- No `usePrototype` hook → takes `role: string`, `userName: string`, `userRoleLabel: string`, `badges: Record<string, SidebarBadge | null>` as props
- Real routes instead of `/proto/*`
- `Sager` route is `/cases` (not `/proto/portfolio`)
- `Personer` route is `/persons` (not `/proto/search`)
- No mock-data imports — all badge data flows via props

- [ ] **Step 10.1: Create component**

Create `src/components/layout/app-sidebar.tsx`:

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
  Settings,
  Calendar,
  Users,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SidebarBadge, NavSection } from '@/types/ui'

const ICON_MAP = {
  LayoutDashboard,
  Building2,
  FileText,
  CheckSquare,
  FolderOpen,
  Calendar,
  Users,
  Briefcase,
} as const

const SECTIONS: NavSection[] = [
  {
    label: 'Overblik',
    items: [
      { name: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard', badgeKey: 'dashboard' },
      { name: 'Kalender',  href: '/calendar',  iconName: 'Calendar',        badgeKey: 'calendar' },
    ],
  },
  {
    label: 'Portefølje',
    items: [
      { name: 'Selskaber',  href: '/companies', iconName: 'Building2',   badgeKey: 'portfolio' },
      { name: 'Kontrakter', href: '/contracts', iconName: 'FileText',    badgeKey: 'contracts' },
      { name: 'Sager',      href: '/cases',     iconName: 'Briefcase',   badgeKey: 'cases' },
      { name: 'Opgaver',    href: '/tasks',     iconName: 'CheckSquare', badgeKey: 'tasks' },
    ],
  },
  {
    label: 'Ressourcer',
    items: [
      { name: 'Dokumenter', href: '/documents', iconName: 'FolderOpen', badgeKey: 'documents' },
      { name: 'Personer',   href: '/persons',   iconName: 'Users',      badgeKey: 'persons' },
    ],
  },
]

export interface AppSidebarProps {
  userName: string
  userRoleLabel: string
  badges: Record<string, SidebarBadge | null>
}

export function AppSidebar({ userName, userRoleLabel, badges }: AppSidebarProps) {
  const pathname = usePathname() ?? ''

  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="flex h-full w-60 flex-col bg-[#0f172a]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.07] px-5">
        <div className="h-2 w-2 rounded-full bg-blue-500" />
        <Link href="/dashboard" className="text-lg font-bold text-white no-underline">
          ChainHub
        </Link>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.iconName]
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = badges[item.badgeKey] ?? null

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 no-underline',
                      isActive
                        ? 'bg-blue-500/[0.12] text-white'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={cn('h-[18px] w-[18px]', isActive ? 'text-blue-400' : '')} />
                      {item.name}
                    </span>
                    {badge && badge.count > 0 && (
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
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 no-underline',
            pathname.startsWith('/settings')
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
            <p className="truncate text-xs font-medium text-slate-200">{userName}</p>
            <span className="mt-0.5 inline-flex items-center rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-400">
              {userRoleLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 10.2: Write failing test**

Create `src/__tests__/components/app-sidebar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import type { SidebarBadge } from '@/types/ui'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

const emptyBadges: Record<string, SidebarBadge | null> = {}

describe('AppSidebar', () => {
  it('viser ChainHub logo og sektioner', () => {
    render(<AppSidebar userName="Philip Larsen" userRoleLabel="Kædeejer" badges={emptyBadges} />)
    expect(screen.getByText('ChainHub')).toBeInTheDocument()
    expect(screen.getByText('Overblik')).toBeInTheDocument()
    expect(screen.getByText('Portefølje')).toBeInTheDocument()
    expect(screen.getByText('Ressourcer')).toBeInTheDocument()
  })

  it('viser alle nav-items', () => {
    render(<AppSidebar userName="Test" userRoleLabel="Admin" badges={emptyBadges} />)
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: /Kalender/ })).toHaveAttribute('href', '/calendar')
    expect(screen.getByRole('link', { name: /Selskaber/ })).toHaveAttribute('href', '/companies')
    expect(screen.getByRole('link', { name: /Kontrakter/ })).toHaveAttribute('href', '/contracts')
    expect(screen.getByRole('link', { name: /Sager/ })).toHaveAttribute('href', '/cases')
    expect(screen.getByRole('link', { name: /Opgaver/ })).toHaveAttribute('href', '/tasks')
    expect(screen.getByRole('link', { name: /Dokumenter/ })).toHaveAttribute('href', '/documents')
    expect(screen.getByRole('link', { name: /Personer/ })).toHaveAttribute('href', '/persons')
  })

  it('viser brugerens initialer, navn og rolle-label', () => {
    render(<AppSidebar userName="Philip Larsen" userRoleLabel="Kædeejer" badges={emptyBadges} />)
    expect(screen.getByText('PL')).toBeInTheDocument()
    expect(screen.getByText('Philip Larsen')).toBeInTheDocument()
    expect(screen.getByText('Kædeejer')).toBeInTheDocument()
  })

  it('viser badge med count når urgency=critical', () => {
    const badges = { tasks: { count: 5, urgency: 'critical' as const } }
    render(<AppSidebar userName="T" userRoleLabel="R" badges={badges} />)
    const badge = screen.getByText('5')
    expect(badge).toHaveClass('bg-red-500/[0.15]', 'text-red-400')
  })

  it('viser neutral badge når urgency=neutral', () => {
    const badges = { tasks: { count: 3, urgency: 'neutral' as const } }
    render(<AppSidebar userName="T" userRoleLabel="R" badges={badges} />)
    const badge = screen.getByText('3')
    expect(badge).toHaveClass('bg-white/[0.08]', 'text-slate-400')
  })

  it('skjuler badge når count er 0', () => {
    const badges = { tasks: { count: 0, urgency: 'neutral' as const } }
    render(<AppSidebar userName="T" userRoleLabel="R" badges={badges} />)
    expect(screen.queryByText('0')).toBeNull()
  })
})
```

- [ ] **Step 10.3: Run test**

Run: `npx vitest run src/__tests__/components/app-sidebar.test.tsx`
Expected: 6 tests pass.

- [ ] **Step 10.4: Commit**

```bash
git add src/components/layout/app-sidebar.tsx src/__tests__/components/app-sidebar.test.tsx
git commit -m "feat(layout): add AppSidebar component from proto with unit tests"
```

---

## Task 11: AppHeader — proto-designet header med inline KPIs

**Files:**
- Create: `src/components/layout/app-header.tsx`
- Test: `src/__tests__/components/app-header.test.tsx`

**Changes from proto:**
- No `usePrototype` — takes `userName`, `kpis: InlineKpi[]` as props
- Greeting + date computed at render time from `new Date()`
- Søge-input er readOnly placeholder (wiring til `/search` sker i Plan 4C)

- [ ] **Step 11.1: Create component**

Create `src/components/layout/app-header.tsx`:

```tsx
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
```

- [ ] **Step 11.2: Write failing test**

Create `src/__tests__/components/app-header.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHeader } from '@/components/layout/app-header'
import type { InlineKpi } from '@/types/ui'

const kpis: InlineKpi[] = [
  { label: 'Selskaber', value: '7' },
  { label: 'Udløbende', value: '3', color: 'amber' },
  { label: 'Forfaldne', value: '12', color: 'red' },
]

describe('AppHeader', () => {
  it('viser hilsen med fornavn', () => {
    render(<AppHeader userName="Philip Larsen" kpis={kpis} />)
    expect(screen.getByText(/Philip/)).toBeInTheDocument()
    // Greeting varierer efter tidspunkt — tjek at én af de tre muligheder er i DOM
    const greetings = ['Godmorgen', 'God eftermiddag', 'God aften']
    const found = greetings.some((g) => screen.queryByText(new RegExp(g)) !== null)
    expect(found).toBe(true)
  })

  it('viser alle KPIs', () => {
    render(<AppHeader userName="T" kpis={kpis} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Selskaber')).toBeInTheDocument()
  })

  it('farver amber-KPI korrekt', () => {
    render(<AppHeader userName="T" kpis={kpis} />)
    expect(screen.getByText('3')).toHaveClass('text-amber-600')
  })

  it('farver red-KPI korrekt', () => {
    render(<AppHeader userName="T" kpis={kpis} />)
    expect(screen.getByText('12')).toHaveClass('text-red-600')
  })

  it('viser initialer fra userName', () => {
    render(<AppHeader userName="Philip Larsen" kpis={[]} />)
    expect(screen.getByText('PL')).toBeInTheDocument()
  })

  it('viser notifikations-bell med aria-label', () => {
    render(<AppHeader userName="T" kpis={[]} />)
    expect(screen.getByLabelText('Notifikationer')).toBeInTheDocument()
  })

  it('viser readonly søge-input', () => {
    render(<AppHeader userName="T" kpis={[]} />)
    const input = screen.getByPlaceholderText(/Søg efter/)
    expect(input).toHaveAttribute('readOnly')
  })
})
```

- [ ] **Step 11.3: Run test**

Run: `npx vitest run src/__tests__/components/app-header.test.tsx`
Expected: 7 tests pass.

- [ ] **Step 11.4: Commit**

```bash
git add src/components/layout/app-header.tsx src/__tests__/components/app-header.test.tsx
git commit -m "feat(layout): add AppHeader component from proto with unit tests"
```

---

## Task 12: Final validation

**Files:** none (verification only)

- [ ] **Step 12.1: Run full test suite**

Run: `npm test -- --run`
Expected: all previous 173 tests + new component tests pass. Target: at least 220 total tests passing.

- [ ] **Step 12.2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 12.3: Run production build**

Run: `npm run build`
Expected: build succeeds without errors.

- [ ] **Step 12.4: Verify all files exist**

Run (bash):

```bash
ls src/types/ui.ts \
   src/components/ui/fin-row.tsx \
   src/components/ui/coverage-bar.tsx \
   src/components/ui/health-bar.tsx \
   src/components/ui/kpi-card.tsx \
   src/components/ui/section-header.tsx \
   src/components/ui/insight-card.tsx \
   src/components/ui/urgency-list.tsx \
   src/components/ui/company-row.tsx \
   src/components/ui/calendar-widget.tsx \
   src/components/layout/app-sidebar.tsx \
   src/components/layout/app-header.tsx
```

Expected: all 12 files listed with no errors.

- [ ] **Step 12.5: Verify no component depends on mock data**

Run: `grep -rn "from '@/mock" src/components/ui src/components/layout/app-sidebar.tsx src/components/layout/app-header.tsx`
Expected: no matches (empty output).

- [ ] **Step 12.6: Clean up dev .next if stale**

Run: `rm -rf .next`
Expected: clean exit. This prevents the build-clobber issue where production `.next` breaks dev server.

- [ ] **Step 12.7: Commit validation marker**

Only if there are uncommitted changes from validation (unlikely).
Otherwise skip.

---

## Completion checklist

- [ ] 12 new files created (1 type file, 9 atoms, 2 layout chrome)
- [ ] 11 test files created (one per component)
- [ ] `npm test` reports at least 220 passing tests (173 existing + 47 new)
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` succeeds
- [ ] No `@/mock/*` imports anywhere in new components
- [ ] All components are `'use client'` where they use state/interactivity
- [ ] Pushed to remote

## What comes next

**Plan 4B: Dashboard + Layout**
- Replace `app/(dashboard)/layout.tsx` to use `AppSidebar` + `AppHeader`
- Delete old `sidebar.tsx`, `header.tsx`, `MobileNav.tsx`
- Rewrite `/dashboard` page with Timeline River + role-specific right panels
- Build new Server Actions: `getDashboardBadges`, `getInlineKpis`, `getCoverageByType`, `getUnderperformingCompanies`, `getHeatmapData`, `getTimelineItems`
- Wire `FinRow`, `CoverageBar`, `HealthBar`, `KpiCard`, `UrgencyList`, `CompanyRow`, `CalendarWidget`, `SectionHeader`, `InsightCard` into dashboard

**Plan 4C: Remaining pages**
- `/tasks` list + `/tasks/[id]` detail
- `/calendar` full page
- `/search` global search
- `/settings`
