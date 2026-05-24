import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import Link from 'next/link'
import { getVisitTypeLabel, getVisitStatusLabel } from '@/lib/labels'
import { formatDanishDate } from '@/lib/date-helpers'
import { VisitStatusForm } from '@/components/visits/VisitStatusForm'
import { VisitNotesForm } from '@/components/visits/VisitNotesForm'
import { Breadcrumb, PageTopbar, Panel, PanelHeader, Badge } from '@/components/ui/b'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const session = await auth()
  if (!session) return { title: 'Besøg' }
  const visit = await prisma.visit.findFirst({
    where: { id: params.id, organization_id: session.user.organizationId, deleted_at: null },
    select: { company: { select: { name: true } }, visit_date: true },
  })
  if (!visit) return { title: 'Besøg' }
  const date = visit.visit_date.toISOString().slice(0, 10)
  return { title: `Besøg · ${visit.company.name} · ${date}` }
}

// ─────────────────────────────────────────────────────────────────────────────
// /visits/[id] — B-stil port. Breadcrumb + PageTopbar + Panels.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string }
}

const STATUS_TONE: Record<string, 'green' | 'amber' | 'gray'> = {
  PLANLAGT: 'amber',
  GENNEMFOERT: 'green',
  AFLYST: 'gray',
}

export default async function VisitDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const [visit, userRoles] = await Promise.all([
    prisma.visit.findFirst({
      where: {
        id: params.id,
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      include: {
        company: { select: { id: true, name: true } },
        visitor: { select: { id: true, name: true } },
      },
    }),
    prisma.userRoleAssignment.findMany({
      where: { user_id: session.user.id, organization_id: session.user.organizationId },
      select: { role: true },
    }),
  ])

  if (!visit) notFound()

  const hasAccess = await canAccessCompany(
    session.user.id,
    visit.company_id,
    session.user.organizationId
  )
  if (!hasAccess) notFound()

  const canReopen = userRoles.some((r) => ['GROUP_OWNER', 'GROUP_ADMIN'].includes(r.role))

  const statusLabel = getVisitStatusLabel(visit.status)
  const statusTone = STATUS_TONE[visit.status] ?? 'gray'

  return (
    <div className="space-y-3">
      <Breadcrumb
        trail={[{ label: 'Kalender', href: '/calendar' }]}
        current={`Besøg · ${visit.company.name}`}
      />

      <PageTopbar
        title={`Besøg hos ${visit.company.name}`}
        meta={formatDanishDate(visit.visit_date)}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Hoved-kolonne */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          {/* Besøgsdetaljer */}
          <Panel>
            <PanelHeader
              title="Besøgsdetaljer"
              actions={<Badge tone={statusTone}>{statusLabel}</Badge>}
            />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 text-[13px]">
              <div>
                <dt
                  className="text-[11px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.4px' }}
                >
                  Selskab
                </dt>
                <dd className="mt-0.5 text-b-1">
                  <Link
                    href={`/companies/${visit.company.id}`}
                    className="text-b-blue-fg no-underline hover:underline"
                  >
                    {visit.company.name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt
                  className="text-[11px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.4px' }}
                >
                  Besøgsdato
                </dt>
                <dd className="mt-0.5 text-b-1">{formatDanishDate(visit.visit_date)}</dd>
              </div>
              <div>
                <dt
                  className="text-[11px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.4px' }}
                >
                  Type
                </dt>
                <dd className="mt-0.5 text-b-1">{getVisitTypeLabel(visit.visit_type)}</dd>
              </div>
              <div>
                <dt
                  className="text-[11px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.4px' }}
                >
                  Besøgt af
                </dt>
                <dd className="mt-0.5 text-b-1">{visit.visitor.name}</dd>
              </div>
              <div>
                <dt
                  className="text-[11px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.4px' }}
                >
                  Oprettet
                </dt>
                <dd className="mt-0.5 text-b-1">{formatDanishDate(visit.created_at)}</dd>
              </div>
            </dl>
          </Panel>

          {/* Noter + opsummering */}
          <VisitNotesForm
            visitId={visit.id}
            initialNotes={visit.notes ?? ''}
            initialSummary={visit.summary ?? ''}
            showSummary={visit.status === 'GENNEMFOERT'}
          />
        </div>

        {/* Side-kolonne */}
        <div className="flex flex-col gap-3">
          <VisitStatusForm visitId={visit.id} currentStatus={visit.status} canReopen={canReopen} />

          {/* Hurtige handlinger */}
          <Panel>
            <PanelHeader title="Hurtige handlinger" />
            <div className="flex flex-col gap-1.5 px-4 py-3">
              <Link
                href={`/companies/${visit.company.id}`}
                className="block w-full rounded-[4px] border border-b-border-strong bg-b-panel px-3 py-1.5 text-center text-[12px] font-medium text-b-1 no-underline hover:bg-b-row-hover"
              >
                Gå til selskab
              </Link>
              <Link
                href={`/companies/${visit.company.id}/visits`}
                className="block w-full rounded-[4px] border border-b-border-strong bg-b-panel px-3 py-1.5 text-center text-[12px] font-medium text-b-1 no-underline hover:bg-b-row-hover"
              >
                Se alle besøg for selskabet
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
