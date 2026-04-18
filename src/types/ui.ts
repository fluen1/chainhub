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
  iconName:
    | 'LayoutDashboard'
    | 'Building2'
    | 'FileText'
    | 'CheckSquare'
    | 'FolderOpen'
    | 'Calendar'
    | 'Users'
    | 'Briefcase'
  badgeKey: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}

// Hjælper: map CalendarEventType → hex-farve (bruges af widget + kalender-side)
export function getEventTypeColor(type: CalendarEventType): string {
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
