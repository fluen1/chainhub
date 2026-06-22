'use client'

import { Clock, FileQuestion, AlertTriangle, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import type { AlertItem } from '@/actions/alerts'
import { Panel, PanelHeader, PanelBody, Badge, type BadgeTone } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// Hjælpere
// ────────────────────────────────────────────────────────────────────────────

function severityTone(severity: AlertItem['severity']): BadgeTone {
  if (severity === 'CRITICAL') return 'red'
  if (severity === 'WARNING') return 'amber'
  return 'blue'
}

function severityLabel(severity: AlertItem['severity']): string {
  if (severity === 'CRITICAL') return 'Kritisk'
  if (severity === 'WARNING') return 'Advarsel'
  return 'Info'
}

function CategoryIcon({ category }: { category: AlertItem['category'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0 text-b-2'
  if (category === 'DEADLINE') return <Clock className={cls} aria-hidden />
  if (category === 'MISSING') return <FileQuestion className={cls} aria-hidden />
  if (category === 'RISK') return <AlertTriangle className={cls} aria-hidden />
  return <ShieldAlert className={cls} aria-hidden />
}

function entityHref(entityType: string, entityId: string): string {
  if (entityType === 'contract') return `/contracts/${entityId}`
  if (entityType === 'task') return `/tasks/${entityId}`
  if (entityType === 'company') return `/companies/${entityId}`
  return '/dashboard'
}

// ────────────────────────────────────────────────────────────────────────────
// Komponent
// ────────────────────────────────────────────────────────────────────────────

interface AlertsWidgetProps {
  alerts: AlertItem[]
}

export function AlertsWidget({ alerts }: AlertsWidgetProps) {
  // Kollaps til én kompakt linje ved ingen aktive advarsler — undgå tomt panel
  // der fylder en tredjedel af dashboard-siden (UX-review #11).
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-b-border bg-white px-3 py-2 text-[12px] text-b-3">
        Ingen aktive advarsler
      </div>
    )
  }

  return (
    <Panel>
      <PanelHeader title="Advarsler" meta={`${alerts.length} aktive`} />
      <PanelBody noPadding>
        <ul aria-live="polite" aria-atomic="false" aria-label={`${alerts.length} aktive advarsler`}>
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                href={entityHref(alert.entityType, alert.entityId)}
                className="flex items-start gap-2.5 border-b border-b-border px-3 py-2.5 text-[12px] transition-colors last:border-b-0 hover:bg-b-row-hover"
              >
                <CategoryIcon category={alert.category} />
                <span className="flex-1 text-b-1">{alert.message}</span>
                <Badge tone={severityTone(alert.severity)}>{severityLabel(alert.severity)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  )
}
