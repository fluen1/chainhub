import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
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
import { getCaseDetailPageData, getCaseTitle } from '@/actions/cases'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: await getCaseTitle(id) }
}

export default async function CaseDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/login')

  const pageData = await getCaseDetailPageData(id)
  if (!pageData) notFound()

  const { caseItem, comments: commentsRaw, userMap, currentUserId } = pageData

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
