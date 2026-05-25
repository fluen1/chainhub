import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity, canAccessModule } from '@/lib/permissions'
import {
  getCaseStatusLabel,
  getCaseTypeLabel,
  getSensitivityLabel,
  formatDate,
  daysUntil,
} from '@/lib/labels'
import { formatShortDate } from '@/lib/date-helpers'
import {
  CaseDetailB,
  type CaseDetailData,
  type CaseTaskData,
  type CaseLinkData,
  type CaseDocData,
  type CaseActivityData,
  type CaseCommentData,
} from './case-detail-b'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const session = await auth()
  if (!session) return { title: 'Sag' }
  const c = await prisma.case.findFirst({
    where: { id, organization_id: session.user.organizationId, deleted_at: null },
    select: { title: true, case_number: true },
  })
  if (!c) return { title: 'Sag' }
  return { title: c.case_number ? `${c.case_number} · ${c.title}` : c.title }
}

export default async function CaseDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/login')

  const caseItem = await prisma.case.findFirst({
    where: {
      id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      case_companies: {
        include: { company: { select: { id: true, name: true } } },
      },
      case_contracts: {
        include: {
          contract: {
            select: { id: true, display_name: true, system_type: true, status: true },
          },
        },
      },
      case_persons: {
        include: {
          person: { select: { id: true, first_name: true, last_name: true } },
        },
      },
      tasks: {
        where: { deleted_at: null },
        orderBy: { due_date: 'asc' },
      },
      documents: {
        where: { deleted_at: null },
        orderBy: { uploaded_at: 'desc' },
        take: 10,
        include: { extraction: { select: { extraction_status: true } } },
      },
    },
  })

  if (!caseItem) notFound()

  let hasAccess = false
  for (const cc of caseItem.case_companies) {
    const ok = await canAccessCompany(session.user.id, cc.company.id, session.user.organizationId)
    if (ok) {
      hasAccess = true
      break
    }
  }
  if (!hasAccess) notFound()

  // Tjek modul-adgang
  const hasModule = await canAccessModule(session.user.id, 'cases', session.user.organizationId)
  if (!hasModule) notFound()

  // Tjek sensitivity-adgang
  const hasSensitivity = await canAccessSensitivity(
    session.user.id,
    caseItem.sensitivity,
    session.user.organizationId
  )
  if (!hasSensitivity) notFound()

  // Hent kommentarer (nyeste øverst)
  const commentsRaw = await prisma.comment.findMany({
    where: { case_id: id, organization_id: session.user.organizationId, deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: { author: { select: { id: true, name: true, email: true } } },
  })

  // User-navne (ansvarlig + task assignees)
  const userIds = Array.from(
    new Set(
      [caseItem.responsible_id, ...caseItem.tasks.map((t) => t.assigned_to ?? null)].filter(
        (id): id is string => !!id
      )
    )
  )
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email ?? 'Ukendt']))

  // Strip-data
  const dFrist = caseItem.due_date ? daysUntil(caseItem.due_date) : null
  const fristShort =
    caseItem.due_date == null
      ? '—'
      : dFrist != null && dFrist < 0
        ? `${Math.abs(dFrist)}d for sent`
        : dFrist != null
          ? `${dFrist}d`
          : '—'

  const firstCompany = caseItem.case_companies[0]?.company
  const isUrgent = dFrist != null && dFrist >= 0 && dFrist <= 3

  const data: CaseDetailData = {
    id: caseItem.id,
    nr: caseItem.case_number ?? caseItem.id.slice(0, 6),
    title: caseItem.title,
    type: getCaseTypeLabel(caseItem.case_type),
    rawType: caseItem.case_type,
    status: getCaseStatusLabel(caseItem.status),
    rawStatus: caseItem.status,
    sensitivity: getSensitivityLabel(caseItem.sensitivity),
    rawSensitivity: caseItem.sensitivity,
    description: caseItem.description ?? '',
    subtype: caseItem.case_subtype ?? null,
    selskab: firstCompany?.name ?? '—',
    selskabId: firstCompany?.id ?? null,
    ansvarlig: caseItem.responsible_id ? (userMap.get(caseItem.responsible_id) ?? '—') : '—',
    frist: caseItem.due_date ? formatDate(caseItem.due_date) : 'Ingen frist',
    fristShort,
    fristDays: dFrist,
    isUrgent,
    createdAt: formatDate(caseItem.created_at),
    createdAtShort: formatShortDate(caseItem.created_at),
    updatedAt: formatDate(caseItem.updated_at),
    closedAt: caseItem.closed_at ? formatDate(caseItem.closed_at) : null,
    dueDate: caseItem.due_date ? caseItem.due_date.toISOString().slice(0, 10) : null,
    responsibleId: caseItem.responsible_id ?? null,
  }

  const tasks: CaseTaskData[] = caseItem.tasks.map((t) => {
    const dDue = t.due_date ? daysUntil(t.due_date) : null
    const dueShort = !t.due_date
      ? '—'
      : dDue != null && dDue < 0
        ? `${Math.abs(dDue)}d for sent`
        : t.due_date
          ? formatShortDate(t.due_date)
          : '—'
    return {
      id: t.id,
      title: t.title,
      assignee: t.assigned_to ? (userMap.get(t.assigned_to) ?? '—') : '—',
      due: dueShort,
      dueDays: dDue,
      done: t.status === 'LUKKET',
      urgent: dDue != null && dDue >= 0 && dDue <= 3,
    }
  })

  const links: CaseLinkData[] = [
    ...caseItem.case_contracts.map((cc) => ({
      key: `c-${cc.contract.id}`,
      type: 'Kontrakt',
      title: cc.contract.display_name,
      sub: `${cc.contract.system_type}`,
      badge: cc.contract.status === 'AKTIV' ? 'Aktiv' : cc.contract.status,
      badgeTone: cc.contract.status === 'AKTIV' ? ('green' as const) : ('gray' as const),
      href: `/contracts/${cc.contract.id}`,
    })),
    ...caseItem.case_persons.map((cp) => ({
      key: `p-${cp.person.id}`,
      type: 'Person',
      title: `${cp.person.first_name} ${cp.person.last_name}`,
      sub: 'Tilknyttet person',
      badge: 'Person',
      badgeTone: 'blue' as const,
      href: `/persons/${cp.person.id}`,
    })),
  ]

  const docs: CaseDocData[] = caseItem.documents.map((d) => {
    const ext = (d.file_name.split('.').pop() ?? '').toUpperCase()
    return {
      id: d.id,
      ext: ext.length > 0 && ext.length <= 4 ? ext : 'FIL',
      navn: d.file_name,
      aiStatus: d.extraction?.extraction_status ?? null,
      date: formatShortDate(d.uploaded_at),
    }
  })

  // Aktivitets-feed (lifecycle events)
  const activity: CaseActivityData[] = [
    {
      key: `created-${caseItem.id}`,
      who: 'System',
      type: 'Oprettelse',
      typeTone: 'green' as const,
      detail: `Sag oprettet${data.description ? ' med beskrivelse' : ''}.`,
      time: formatShortDate(caseItem.created_at),
    },
    ...caseItem.tasks.map((t) => ({
      key: `task-${t.id}`,
      who: t.assigned_to ? (userMap.get(t.assigned_to) ?? 'Ukendt') : 'System',
      type: t.status === 'LUKKET' ? 'Opgave fuldført' : 'Opgave tilføjet',
      typeTone: t.status === 'LUKKET' ? ('green' as const) : ('blue' as const),
      detail: t.title,
      time: formatShortDate(t.created_at),
      _ts: t.created_at.getTime(),
    })),
    ...caseItem.documents.map((d) => ({
      key: `doc-${d.id}`,
      who: 'Bruger',
      type: 'Dokument',
      typeTone: 'gray' as const,
      detail: `${d.file_name} uploadet`,
      time: formatShortDate(d.uploaded_at),
      _ts: d.uploaded_at.getTime(),
    })),
  ]
    .sort((a, b) => ((b as { _ts?: number })._ts ?? 0) - ((a as { _ts?: number })._ts ?? 0))
    .slice(0, 8)

  const comments: CaseCommentData[] = commentsRaw.map((c) => ({
    id: c.id,
    content: c.content,
    authorId: c.created_by,
    authorName: c.author.name ?? c.author.email ?? 'Ukendt',
    createdAt: formatShortDate(c.created_at),
  }))

  const currentUserId = session.user.id

  return (
    <CaseDetailB
      data={data}
      tasks={tasks}
      links={links}
      docs={docs}
      activity={activity}
      comments={comments}
      currentUserId={currentUserId}
    />
  )
}
