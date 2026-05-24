'use server'

import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'

// ────────────────────────────────────────────────────────────────────────────
// Activity feed til dashboard "Sidste aktivitet"-panel.
//
// Aggregerer fra AuditLog. Skåret til seneste 10 events i organisationen,
// med user-navn (resolvet i et separat batch — AuditLog har ingen relation).
// ────────────────────────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string
  who: string
  action: string // dansk verbum, fx "oprettede"
  target: string // dansk subjekt + kontext, fx "Kontrakt · v3"
  time: string // relativ tid på dansk
  resource_type: string // bruges til klikbar link-routing i UI
  resource_id: string // bruges til klikbar link-routing i UI
}

const ACTION_VERB: Record<string, string> = {
  CREATE: 'oprettede',
  UPDATE: 'opdaterede',
  DELETE: 'slettede',
  END: 'afsluttede',
  CLOSE: 'lukkede',
  ESCALATE: 'eskalerede',
  STATUS_CHANGE: 'ændrede status på',
  COMMENT_CREATE: 'kommenterede',
  VIEW: 'åbnede',
  UPLOAD: 'uploadede',
  EXPORT: 'eksporterede',
  BACKUP: 'tog backup af',
  GDPR_EXPORT: 'GDPR-eksporterede',
  GDPR_DELETE: 'GDPR-slettede',
}

const RESOURCE_LABEL: Record<string, string> = {
  case: 'Sag',
  contract: 'Kontrakt',
  contract_version: 'Kontraktversion',
  company: 'Selskab',
  company_person: 'Personrelation',
  ownership: 'Ejerskab',
  person: 'Person',
  document: 'Dokument',
  task: 'Opgave',
  // Audit-log API'er bruger uppercase nogle steder
  PERSON: 'Person',
  DOCUMENT: 'Dokument',
  EXPORT: 'Eksport',
}

function formatRelative(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'lige nu'
  if (min < 60) return `${min} min siden`
  const hr = Math.floor(min / 60)
  if (hr < 24) {
    const remMin = min % 60
    return remMin > 0 ? `${hr}t ${remMin} min siden` : `${hr}t siden`
  }
  const d = Math.floor(hr / 24)
  if (d === 1)
    return `i går ${date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}`
  return `${d} dage siden`
}

export async function getRecentActivity(
  organizationId: string,
  userId: string,
  preloadedCompanyIds?: string[],
  since?: Date
): Promise<ActivityEvent[]> {
  // Default: 24 timer tilbage fra nu
  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Hent accessible companies for RBAC-scope — brug preloaded liste hvis tilgængelig
  const companyIds =
    preloadedCompanyIds !== undefined
      ? preloadedCompanyIds
      : await getAccessibleCompanies(userId, organizationId)

  const logs = await prisma.auditLog.findMany({
    where: {
      organization_id: organizationId,
      created_at: { gte: sinceDate },
      // Scope: events der vedrører selskaber brugeren har adgang til, eller org-brede events (company_id=null)
      OR: [{ resource_company_id: { in: companyIds } }, { resource_company_id: null }],
    },
    orderBy: { created_at: 'desc' },
    take: 20,
    select: {
      id: true,
      user_id: true,
      action: true,
      resource_type: true,
      resource_id: true,
      created_at: true,
    },
  })

  if (logs.length === 0) return []

  const userIds = Array.from(new Set(logs.map((l) => l.user_id)))
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, organization_id: organizationId, deleted_at: null },
    select: { id: true, name: true, email: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email ?? 'Ukendt']))

  const now = new Date()
  return logs.map((l) => {
    const verb = ACTION_VERB[l.action] ?? l.action.toLowerCase()
    const resource = RESOURCE_LABEL[l.resource_type] ?? l.resource_type
    return {
      id: l.id,
      who: userMap.get(l.user_id) ?? 'Ukendt',
      action: verb,
      target: resource,
      time: formatRelative(l.created_at, now),
      resource_type: l.resource_type,
      resource_id: l.resource_id,
    }
  })
}
