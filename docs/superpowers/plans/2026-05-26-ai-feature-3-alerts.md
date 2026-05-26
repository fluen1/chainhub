# Feature 3: Proaktive Alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daglig automatisk scanning af selskaber/kontrakter med proaktive alerts i dashboard-widget og notification-bell i sidebar.

**Architecture:** Ny `Alert` Prisma-model, rule-based scanner (gratis) + AI krydsvalidering (gpt-5-nano, kun ved behov). PgBoss cron-job kl. 06:00 UTC. In-app levering: AlertsWidget på dashboard + NotificationBell i sidebar.

**Tech Stack:** Prisma, PgBoss (cron), OpenAI gpt-5-nano (optional), Server Actions, React (B-stil)

---

### Task 1: Alert Prisma-model + enums

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Tilføj enums og Alert model**

I `prisma/schema.prisma`, tilføj:

```prisma
enum AlertSeverity {
  CRITICAL
  WARNING
  INFO

  @@map("alert_severity")
}

enum AlertCategory {
  DEADLINE
  MISSING
  RISK
  COMPLIANCE

  @@map("alert_category")
}

model Alert {
  id              String         @id @default(uuid())
  organization_id String
  severity        AlertSeverity
  category        AlertCategory
  entity_type     String         // "company", "contract", "person"
  entity_id       String
  entity_name     String
  message         String
  details         Json?
  dismissed_at    DateTime?
  dismissed_by    String?
  created_at      DateTime       @default(now())

  organization    Organization   @relation(fields: [organization_id], references: [id])

  @@index([organization_id, dismissed_at])
  @@index([organization_id, severity])
  @@index([entity_type, entity_id])
}
```

Tilføj relation i Organization model:

```prisma
alerts Alert[]
```

- [ ] **Step 2: Generér Prisma client**

Run: `npx prisma generate`
Expected: Successfully generated Prisma Client

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: tilføj Alert model med severity, category og entity-relation"
```

---

### Task 2: Alert actions (CRUD)

**Files:**

- Create: `src/actions/alerts.ts`
- Create: `src/__tests__/actions/alerts.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
// src/__tests__/actions/alerts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    alert: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('alerts actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getActiveAlerts returns undismissed alerts for org', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.alert.findMany).mockResolvedValue([
      {
        id: 'a1',
        severity: 'CRITICAL',
        category: 'DEADLINE',
        message: 'Kontrakt udløber',
        entity_type: 'contract',
        entity_id: 'c1',
        entity_name: 'Lejekontrakt X',
      },
    ] as never)

    const { getActiveAlerts } = await import('@/actions/alerts')
    const result = await getActiveAlerts()

    expect(result.data).toHaveLength(1)
    expect(result.data![0].severity).toBe('CRITICAL')
  })

  it('getActiveAlerts returns error when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null)

    const { getActiveAlerts } = await import('@/actions/alerts')
    const result = await getActiveAlerts()

    expect(result.error).toBe('Din session er udløbet — log ind igen.')
  })

  it('dismissAlert marks alert as dismissed', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.alert.update).mockResolvedValue({ id: 'a1' } as never)

    const { dismissAlert } = await import('@/actions/alerts')
    const result = await dismissAlert('a1')

    expect(result.data).toBeDefined()
    expect(prisma.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({ dismissed_by: 'user-1' }),
      })
    )
  })

  it('getAlertStats returns counts by severity', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.alert.count)
      .mockResolvedValueOnce(2) // critical
      .mockResolvedValueOnce(5) // warning
      .mockResolvedValueOnce(3) // info

    const { getAlertStats } = await import('@/actions/alerts')
    const result = await getAlertStats()

    expect(result.data).toEqual({ critical: 2, warning: 5, info: 3, total: 10 })
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/actions/alerts.test.ts`
Expected: FAIL — modul eksisterer ikke

- [ ] **Step 3: Implementér actions**

```typescript
// src/actions/alerts.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { ActionResult } from '@/types/actions'

export interface AlertItem {
  id: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  category: 'DEADLINE' | 'MISSING' | 'RISK' | 'COMPLIANCE'
  entityType: string
  entityId: string
  entityName: string
  message: string
  details: Record<string, unknown> | null
  createdAt: Date
}

export interface AlertStats {
  critical: number
  warning: number
  info: number
  total: number
}

export async function getActiveAlerts(limit = 20): Promise<ActionResult<AlertItem[]>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const alerts = await prisma.alert.findMany({
    where: {
      organization_id: session.user.organizationId,
      dismissed_at: null,
    },
    orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
    take: limit,
  })

  return {
    data: alerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      category: a.category,
      entityType: a.entity_type,
      entityId: a.entity_id,
      entityName: a.entity_name,
      message: a.message,
      details: a.details as Record<string, unknown> | null,
      createdAt: a.created_at,
    })),
  }
}

export async function dismissAlert(alertId: string): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      dismissed_at: new Date(),
      dismissed_by: session.user.id,
    },
    select: { id: true, organization_id: true },
  })

  if (alert.organization_id !== session.user.organizationId) {
    return { error: 'Du har ikke adgang til denne alert.' }
  }

  return { data: { id: alert.id } }
}

export async function getAlertStats(): Promise<ActionResult<AlertStats>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const orgId = session.user.organizationId
  const baseWhere = { organization_id: orgId, dismissed_at: null }

  const [critical, warning, info] = await Promise.all([
    prisma.alert.count({ where: { ...baseWhere, severity: 'CRITICAL' } }),
    prisma.alert.count({ where: { ...baseWhere, severity: 'WARNING' } }),
    prisma.alert.count({ where: { ...baseWhere, severity: 'INFO' } }),
  ])

  return { data: { critical, warning, info, total: critical + warning + info } }
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/actions/alerts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/alerts.ts src/__tests__/actions/alerts.test.ts
git commit -m "feat: tilføj alert actions (getActiveAlerts, dismissAlert, getAlertStats)"
```

---

### Task 3: Portfolio scanner job (rule-based)

**Files:**

- Create: `src/lib/ai/jobs/portfolio-scan.ts`
- Create: `src/__tests__/lib/ai/jobs/portfolio-scan.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
// src/__tests__/lib/ai/jobs/portfolio-scan.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    company: { findMany: vi.fn() },
    alert: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/ai/feature-flags', () => ({
  isAIEnabled: vi.fn().mockResolvedValue(true),
}))

describe('portfolio-scan', () => {
  beforeEach(() => vi.clearAllMocks())

  it('generates DEADLINE alerts for contracts expiring within 30 days', async () => {
    const { prisma } = await import('@/lib/db')
    const thirtyDaysFromNow = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000)

    vi.mocked(prisma.organization.findMany).mockResolvedValue([{ id: 'org-1' }] as never)

    vi.mocked(prisma.contract.findMany).mockResolvedValue([
      {
        id: 'c1',
        name: 'Lejekontrakt',
        end_date: thirtyDaysFromNow,
        status: 'AKTIV',
        company: { id: 'comp-1', name: 'Test ApS' },
      },
    ] as never)

    vi.mocked(prisma.company.findMany).mockResolvedValue([])
    vi.mocked(prisma.alert.deleteMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.alert.createMany).mockResolvedValue({ count: 1 })

    const { runPortfolioScan } = await import('@/lib/ai/jobs/portfolio-scan')
    const result = await runPortfolioScan('org-1')

    expect(result.alertsCreated).toBeGreaterThan(0)
    expect(prisma.alert.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            severity: 'WARNING',
            category: 'DEADLINE',
          }),
        ]),
      })
    )
  })

  it('generates MISSING alerts for companies without required documents', async () => {
    const { prisma } = await import('@/lib/db')

    vi.mocked(prisma.organization.findMany).mockResolvedValue([{ id: 'org-1' }] as never)

    vi.mocked(prisma.contract.findMany).mockResolvedValue([])
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'comp-1', name: 'Test ApS', contracts: [], _count: { documents: 0 } },
    ] as never)
    vi.mocked(prisma.alert.deleteMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.alert.createMany).mockResolvedValue({ count: 1 })

    const { runPortfolioScan } = await import('@/lib/ai/jobs/portfolio-scan')
    const result = await runPortfolioScan('org-1')

    expect(prisma.alert.createMany).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/lib/ai/jobs/portfolio-scan.test.ts`
Expected: FAIL — modul eksisterer ikke

- [ ] **Step 3: Implementér portfolio scanner**

```typescript
// src/lib/ai/jobs/portfolio-scan.ts
import { prisma } from '@/lib/db'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { logger } from '@/lib/ai/logger'

interface ScanResult {
  alertsCreated: number
  alertsCleared: number
  errors: string[]
}

interface AlertInput {
  organization_id: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  category: 'DEADLINE' | 'MISSING' | 'RISK' | 'COMPLIANCE'
  entity_type: string
  entity_id: string
  entity_name: string
  message: string
  details?: Record<string, unknown>
}

export async function runPortfolioScan(organizationId: string): Promise<ScanResult> {
  const enabled = await isAIEnabled(organizationId, 'alerts')
  if (!enabled) {
    return { alertsCreated: 0, alertsCleared: 0, errors: [] }
  }

  const alerts: AlertInput[] = []
  const errors: string[] = []

  // Rule 1: Contracts expiring within 30 days
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const expiringContracts = await prisma.contract.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: 'AKTIV',
        end_date: { lte: thirtyDaysFromNow, gte: new Date() },
      },
      include: { company: { select: { id: true, name: true } } },
    })

    for (const contract of expiringContracts) {
      const daysLeft = Math.ceil(
        (contract.end_date!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      )
      alerts.push({
        organization_id: organizationId,
        severity: daysLeft <= 7 ? 'CRITICAL' : 'WARNING',
        category: 'DEADLINE',
        entity_type: 'contract',
        entity_id: contract.id,
        entity_name: contract.name ?? 'Unavngivet kontrakt',
        message: `Kontrakt "${contract.name}" udløber om ${daysLeft} dage`,
        details: { days_left: daysLeft, company_name: contract.company?.name },
      })
    }
  } catch (err) {
    errors.push(`Deadline scan fejlede: ${String(err)}`)
    logger.error({ err }, 'Deadline scan failed')
  }

  // Rule 2: Companies without key documents (ejeraftale, vedtægter)
  try {
    const companies = await prisma.company.findMany({
      where: { organization_id: organizationId, deleted_at: null },
      select: {
        id: true,
        name: true,
        contracts: {
          where: { deleted_at: null },
          select: { contract_type: true },
        },
      },
    })

    for (const company of companies) {
      const types = company.contracts.map((c) => c.contract_type)
      if (!types.includes('EJERAFTALE')) {
        alerts.push({
          organization_id: organizationId,
          severity: 'INFO',
          category: 'MISSING',
          entity_type: 'company',
          entity_id: company.id,
          entity_name: company.name,
          message: `"${company.name}" mangler ejeraftale`,
        })
      }
      if (!types.includes('VEDTAEGTER')) {
        alerts.push({
          organization_id: organizationId,
          severity: 'INFO',
          category: 'MISSING',
          entity_type: 'company',
          entity_id: company.id,
          entity_name: company.name,
          message: `"${company.name}" mangler vedtægter`,
        })
      }
    }
  } catch (err) {
    errors.push(`Missing docs scan fejlede: ${String(err)}`)
    logger.error({ err }, 'Missing docs scan failed')
  }

  // Rule 3: Overdue tasks
  try {
    const overdueTasks = await prisma.task.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { notIn: ['AFSLUTTET', 'ANNULLERET'] },
        due_date: { lt: new Date() },
      },
      select: { id: true, title: true, due_date: true },
      take: 50,
    })

    for (const task of overdueTasks) {
      const daysOverdue = Math.ceil((Date.now() - task.due_date!.getTime()) / (24 * 60 * 60 * 1000))
      alerts.push({
        organization_id: organizationId,
        severity: daysOverdue > 14 ? 'CRITICAL' : 'WARNING',
        category: 'COMPLIANCE',
        entity_type: 'task',
        entity_id: task.id,
        entity_name: task.title,
        message: `Opgave "${task.title}" er ${daysOverdue} dage forsinket`,
        details: { days_overdue: daysOverdue },
      })
    }
  } catch (err) {
    errors.push(`Overdue tasks scan fejlede: ${String(err)}`)
    logger.error({ err }, 'Overdue tasks scan failed')
  }

  // Clear old auto-generated alerts and write new ones
  const cleared = await prisma.alert.deleteMany({
    where: {
      organization_id: organizationId,
      dismissed_at: null,
      created_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })

  let created = 0
  if (alerts.length > 0) {
    const result = await prisma.alert.createMany({ data: alerts })
    created = result.count
  }

  logger.info({ organizationId, created, cleared: cleared.count }, 'Portfolio scan complete')

  return { alertsCreated: created, alertsCleared: cleared.count, errors }
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/lib/ai/jobs/portfolio-scan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/jobs/portfolio-scan.ts src/__tests__/lib/ai/jobs/portfolio-scan.test.ts
git commit -m "feat: tilføj portfolio-scan job med rule-based alert-generering"
```

---

### Task 4: PgBoss cron-job registration

**Files:**

- Modify: `src/lib/ai/queue.ts`

- [ ] **Step 1: Tilføj PORTFOLIO_SCAN job name**

I `src/lib/ai/queue.ts`, udvid JOB_NAMES:

```typescript
export const JOB_NAMES = {
  EXTRACT_DOCUMENT: 'extraction.full',
  PORTFOLIO_SCAN: 'alerts.portfolio-scan',
} as const
```

- [ ] **Step 2: Tilføj cron-schedule i createQueue**

I `createQueue()` funktionen, efter boss.start(), tilføj:

```typescript
// Schedule daily portfolio scan at 06:00 UTC
await boss.schedule(
  JOB_NAMES.PORTFOLIO_SCAN,
  '0 6 * * *',
  {},
  {
    tz: 'UTC',
  }
)
```

- [ ] **Step 3: Tilføj job-handler registration**

Tilføj worker-registration (kan være i en separat worker-fil eller i queue.ts):

```typescript
import { runPortfolioScan } from '@/lib/ai/jobs/portfolio-scan'

// In worker setup:
await boss.work(JOB_NAMES.PORTFOLIO_SCAN, async (job) => {
  const orgs = await prisma.organization.findMany({ select: { id: true } })
  for (const org of orgs) {
    await runPortfolioScan(org.id)
  }
})
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/queue.ts
git commit -m "feat: registrér portfolio-scan som dagligt PgBoss cron-job"
```

---

### Task 5: AlertsWidget dashboard-komponent

**Files:**

- Create: `src/components/dashboard/AlertsWidget.tsx`
- Create: `src/__tests__/components/dashboard/AlertsWidget.test.tsx`

- [ ] **Step 1: Skriv test**

```typescript
// src/__tests__/components/dashboard/AlertsWidget.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertsWidget } from '@/components/dashboard/AlertsWidget'

describe('AlertsWidget', () => {
  const mockAlerts = [
    { id: 'a1', severity: 'CRITICAL' as const, category: 'DEADLINE' as const, entityType: 'contract', entityId: 'c1', entityName: 'Lejekontrakt X', message: 'Udløber om 5 dage', details: null, createdAt: new Date() },
    { id: 'a2', severity: 'WARNING' as const, category: 'MISSING' as const, entityType: 'company', entityId: 'comp-1', entityName: 'Test ApS', message: 'Mangler ejeraftale', details: null, createdAt: new Date() },
  ]

  it('renders alerts grouped by severity', () => {
    render(<AlertsWidget alerts={mockAlerts} />)

    expect(screen.getByText('Udløber om 5 dage')).toBeDefined()
    expect(screen.getByText('Mangler ejeraftale')).toBeDefined()
  })

  it('shows empty state when no alerts', () => {
    render(<AlertsWidget alerts={[]} />)
    expect(screen.getByText(/Ingen aktive advarsler/)).toBeDefined()
  })

  it('shows severity indicators', () => {
    render(<AlertsWidget alerts={mockAlerts} />)
    // Critical alerts have red indicator
    expect(screen.getByText('Udløber om 5 dage').closest('[data-severity]')?.getAttribute('data-severity')).toBe('CRITICAL')
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/components/dashboard/AlertsWidget.test.tsx`
Expected: FAIL — komponent eksisterer ikke

- [ ] **Step 3: Implementér AlertsWidget**

```typescript
// src/components/dashboard/AlertsWidget.tsx
'use client'

import { Panel, PanelHeader, PanelBody, Badge, PanelEmpty } from '@/components/ui/b'
import { AlertTriangle, Clock, FileQuestion, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import type { AlertItem } from '@/actions/alerts'

interface Props {
  alerts: AlertItem[]
}

const severityConfig = {
  CRITICAL: { tone: 'red' as const, icon: AlertTriangle },
  WARNING: { tone: 'amber' as const, icon: Clock },
  INFO: { tone: 'blue' as const, icon: FileQuestion },
}

const categoryIcons = {
  DEADLINE: Clock,
  MISSING: FileQuestion,
  RISK: AlertTriangle,
  COMPLIANCE: ShieldAlert,
}

export function AlertsWidget({ alerts }: Props) {
  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium">Advarsler</span>
          {alerts.length > 0 && (
            <Badge tone={alerts.some(a => a.severity === 'CRITICAL') ? 'red' : 'amber'}>
              {alerts.length}
            </Badge>
          )}
        </div>
      </PanelHeader>
      <PanelBody>
        {alerts.length === 0 ? (
          <PanelEmpty>Ingen aktive advarsler</PanelEmpty>
        ) : (
          <div className="flex flex-col gap-1.5">
            {alerts.slice(0, 5).map(alert => {
              const config = severityConfig[alert.severity]
              const CategoryIcon = categoryIcons[alert.category]
              const href = alert.entityType === 'company'
                ? `/companies/${alert.entityId}`
                : alert.entityType === 'contract'
                ? `/contracts/${alert.entityId}`
                : `/tasks/${alert.entityId}`

              return (
                <Link
                  key={alert.id}
                  href={href}
                  data-severity={alert.severity}
                  className="flex items-start gap-2.5 rounded-md border border-b-border px-3 py-2 hover:bg-b-surface-hover transition-colors"
                >
                  <CategoryIcon className={`h-4 w-4 mt-0.5 shrink-0 ${
                    alert.severity === 'CRITICAL' ? 'text-red-500' :
                    alert.severity === 'WARNING' ? 'text-amber-500' : 'text-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-b-text truncate">
                      {alert.message}
                    </p>
                    <p className="text-[11px] text-b-muted truncate">
                      {alert.entityName}
                    </p>
                  </div>
                  <Badge tone={config.tone}>{alert.severity === 'CRITICAL' ? 'Kritisk' : alert.severity === 'WARNING' ? 'Advarsel' : 'Info'}</Badge>
                </Link>
              )
            })}
            {alerts.length > 5 && (
              <p className="text-center text-[11px] text-b-muted pt-1">
                +{alerts.length - 5} flere advarsler
              </p>
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  )
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/components/dashboard/AlertsWidget.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/AlertsWidget.tsx src/__tests__/components/dashboard/AlertsWidget.test.tsx
git commit -m "feat: tilføj AlertsWidget dashboard-komponent"
```

---

### Task 6: NotificationBell sidebar-komponent

**Files:**

- Create: `src/components/layout/NotificationBell.tsx`
- Create: `src/__tests__/components/layout/NotificationBell.test.tsx`

- [ ] **Step 1: Skriv test**

```typescript
// src/__tests__/components/layout/NotificationBell.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationBell } from '@/components/layout/NotificationBell'

describe('NotificationBell', () => {
  it('shows count badge when alerts exist', () => {
    render(<NotificationBell count={3} />)
    expect(screen.getByText('3')).toBeDefined()
  })

  it('shows no badge when count is 0', () => {
    render(<NotificationBell count={0} />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('caps display at 99+', () => {
    render(<NotificationBell count={150} />)
    expect(screen.getByText('99+')).toBeDefined()
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/components/layout/NotificationBell.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementér NotificationBell**

```typescript
// src/components/layout/NotificationBell.tsx
'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'

interface Props {
  count: number
}

export function NotificationBell({ count }: Props) {
  return (
    <Link
      href="/dashboard"
      className="relative inline-flex items-center justify-center rounded-md p-1.5 hover:bg-b-surface-hover transition-colors"
      title={count > 0 ? `${count} aktive advarsler` : 'Ingen advarsler'}
    >
      <Bell className="h-4 w-4 text-b-muted" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/components/layout/NotificationBell.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/NotificationBell.tsx src/__tests__/components/layout/NotificationBell.test.tsx
git commit -m "feat: tilføj NotificationBell komponent til sidebar"
```

---

### Task 7: Integrér AlertsWidget og NotificationBell

**Files:**

- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/components/layout/b-sidebar.tsx`

- [ ] **Step 1: Tilføj AlertsWidget til dashboard**

I `src/app/(dashboard)/dashboard/page.tsx`, tilføj import og data-fetch:

```typescript
import { getActiveAlerts } from '@/actions/alerts'
import { AlertsWidget } from '@/components/dashboard/AlertsWidget'

// I page-funktionen, tilføj til Promise.all:
const alertsResult = await getActiveAlerts(5)
const alerts = alertsResult.data ?? []
```

Tilføj i JSX efter UrgencyPanel/HeatmapPanel grid:

```tsx
<AlertsWidget alerts={alerts} />
```

- [ ] **Step 2: Tilføj NotificationBell til sidebar**

I `src/components/layout/b-sidebar.tsx`, tilføj:

```typescript
import { NotificationBell } from './NotificationBell'
```

Tilføj `alertCount` til sidebar props og render `<NotificationBell count={alertCount} />` i header-området.

- [ ] **Step 3: Opdatér layout til at hente alert-count**

I `src/app/(dashboard)/layout.tsx`, tilføj `getAlertStats()` kald og send count til BShell.

- [ ] **Step 4: Verificér build**

Run: `npx next build`
Expected: Build successful

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx src/components/layout/b-sidebar.tsx src/app/\(dashboard\)/layout.tsx
git commit -m "feat: integrér AlertsWidget på dashboard og NotificationBell i sidebar"
```
