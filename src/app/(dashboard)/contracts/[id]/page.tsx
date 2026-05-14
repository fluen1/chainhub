import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity, canAccessModule } from '@/lib/permissions'
import {
  getContractTypeLabel,
  getContractStatusLabel,
  getSensitivityLabel,
  getChangeTypeLabel,
  formatDate,
  daysUntil,
} from '@/lib/labels'
import { UploadVersionTrigger } from '@/components/modals/b/UploadVersionTrigger'
import { ContractStatusButton } from '@/components/contracts/ContractStatusButton'
import { ContractEditTrigger } from '@/components/contracts/ContractEditTrigger'
import { AddContractPartyTrigger } from '@/components/contracts/AddContractPartyTrigger'
import {
  Breadcrumb,
  PageHeader,
  MetaSep,
  BButton,
  BAddButton,
  Strip,
  type StripCellData,
  AlertBar,
  Panel,
  PanelHeader,
  PanelFooter,
  Badge,
  type BadgeTone,
  AIInsightCard,
  PlusBadge,
  BottomBar,
  PanelEmpty,
} from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// /contracts/[id] — B-stil detail-side.
//
// Layout (matcher docs/design/handoff/project/Kontrakt detail.html):
//   1. Breadcrumb
//   2. PageHeader (titel + status badge + meta + actions)
//   3. 6-cell strip (type, sensitivitet, version, effektiv, udløb, parter)
//   4. Alert-bar hvis ≤30d til udløb
//   5. 2-col: Vilkår (Plus, AI-extracted) + AI Insight (Plus, lilla card)
//   6. Full-width: Versionshistorik
//   7. 3-col: Parter + Tilknytninger + Aktivitet
//   8. BottomBar med kbd hints
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string }
}

interface FieldConfidence {
  field_name: string
  confidence: number
}

interface KeyTermRow {
  label: string
  value: string
  confidence: number | null // null = ikke AI-extracted
}

// Map fra extracted_fields-nøgle → dansk vilkår-label vist i UI.
const FIELD_TO_LABEL: Record<string, string> = {
  monthly_rent: 'Månedlig leje',
  rent_amount: 'Månedlig leje',
  notice_period: 'Opsigelsesvarsel',
  notice_period_months: 'Opsigelsesvarsel',
  index_regulation: 'Indeksregulering',
  indexation: 'Indeksregulering',
  deposit: 'Depositum',
  deposit_amount: 'Depositum',
  sublease: 'Fremlejeret',
  sublet_allowed: 'Fremlejeret',
  duration: 'Løbetid',
  expiry: 'Udløbsdato',
  termination: 'Opsigelse',
  parties: 'Parter',
  type: 'Type',
}

function formatExtractionValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nej'
  if (typeof v === 'number') return v.toLocaleString('da-DK')
  return String(v)
}

function buildKeyTermsFromExtraction(
  extractedFields: Record<string, unknown> | null,
  fieldConfidences: FieldConfidence[]
): KeyTermRow[] {
  if (!extractedFields) return []
  const confMap = new Map(fieldConfidences.map((f) => [f.field_name, f.confidence]))
  const rows: KeyTermRow[] = []
  for (const [key, value] of Object.entries(extractedFields)) {
    const label = FIELD_TO_LABEL[key]
    if (!label) continue
    const conf = confMap.get(key)
    rows.push({
      label,
      value: formatExtractionValue(value),
      confidence: typeof conf === 'number' ? conf : null,
    })
  }
  return rows.slice(0, 5)
}

function confidenceBadge(conf: number | null): React.ReactNode {
  if (conf == null) {
    return <Badge tone="gray">Manuel</Badge>
  }
  const pct = Math.round(conf * 100)
  if (pct >= 85) return <Badge tone="green">{`✓ AI ${pct}%`}</Badge>
  if (pct >= 70) return <Badge tone="amber">{`⚠ AI ${pct}%`}</Badge>
  return <Badge tone="red">{`⚠ AI ${pct}%`}</Badge>
}

function changeTypeTone(ct: string): BadgeTone {
  switch (ct) {
    case 'NY_VERSION':
      return 'blue'
    case 'REDAKTIONEL':
      return 'gray'
    case 'MATERIEL':
      return 'amber'
    case 'ALLONGE':
      return 'gray'
    default:
      return 'gray'
  }
}

export default async function ContractDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasModuleAccess = await canAccessModule(
    session.user.id,
    'contracts',
    session.user.organizationId
  )
  if (!hasModuleAccess) redirect('/dashboard')

  const orgId = session.user.organizationId

  const contract = await prisma.contract.findFirst({
    where: {
      id: params.id,
      organization_id: orgId,
      deleted_at: null,
    },
    include: {
      company: { select: { id: true, name: true } },
      parties: {
        include: {
          person: { select: { id: true, first_name: true, last_name: true } },
        },
      },
      versions: { orderBy: { version_number: 'desc' }, take: 10 },
    },
  })

  if (!contract) notFound()

  const canAccess = await canAccessCompany(session.user.id, contract.company_id, orgId)
  if (!canAccess) notFound()

  const hasSensitivity = await canAccessSensitivity(session.user.id, contract.sensitivity, orgId)
  if (!hasSensitivity) notFound()

  // Audit-log for følsomme kontrakter (uændret fra original)
  if (contract.sensitivity === 'STRENGT_FORTROLIG' || contract.sensitivity === 'FORTROLIG') {
    await prisma.auditLog.create({
      data: {
        organization_id: orgId,
        user_id: session.user.id,
        action: 'VIEW',
        resource_type: 'contract',
        resource_id: contract.id,
        sensitivity: contract.sensitivity,
      },
    })
    await prisma.contract.update({
      where: { id: contract.id },
      data: { last_viewed_at: new Date(), last_viewed_by: session.user.id },
    })
  }

  // Parallel: relaterede data + version-uploaders + extraction-data
  const uploaderIds = Array.from(new Set(contract.versions.map((v) => v.uploaded_by)))

  const [cases, tasks, documents, extraction, uploaders, persons] = await Promise.all([
    prisma.case.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        case_contracts: { some: { contract_id: contract.id } },
      },
      orderBy: { updated_at: 'desc' },
      take: 5,
      select: { id: true, title: true, case_number: true, status: true, created_at: true },
    }),
    prisma.task.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        OR: [{ contract_id: contract.id }, { company_id: contract.company_id }],
        status: { not: 'LUKKET' },
      },
      orderBy: { due_date: 'asc' },
      take: 5,
      select: { id: true, title: true, due_date: true, status: true },
    }),
    prisma.document.findMany({
      where: {
        organization_id: orgId,
        company_id: contract.company_id,
        deleted_at: null,
      },
      orderBy: { uploaded_at: 'desc' },
      take: 5,
      select: { id: true, file_name: true, uploaded_at: true },
    }),
    prisma.documentExtraction.findFirst({
      where: {
        organization_id: orgId,
        document: {
          organization_id: orgId,
          contract_id: contract.id,
          deleted_at: null,
        },
      },
      orderBy: { created_at: 'desc' },
      select: {
        extracted_fields: true,
        pipeline_checkpoint: true,
        updated_at: true,
        document: { select: { file_name: true } },
      },
    }),
    uploaderIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: uploaderIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    prisma.person.findMany({
      where: { organization_id: orgId, deleted_at: null },
      orderBy: { last_name: 'asc' },
      take: 200,
      select: { id: true, first_name: true, last_name: true, email: true },
    }),
  ])

  const uploaderMap = new Map(uploaders.map((u) => [u.id, u.name ?? u.email ?? 'Ukendt']))

  // Extraction → key terms
  const extractedFields =
    extraction && extraction.extracted_fields
      ? (extraction.extracted_fields as Record<string, unknown>)
      : null

  const fieldConfidences: FieldConfidence[] =
    extraction && extraction.pipeline_checkpoint
      ? (((extraction.pipeline_checkpoint as Record<string, unknown>).field_confidences as
          | FieldConfidence[]
          | undefined) ?? [])
      : []

  const keyTerms = buildKeyTermsFromExtraction(extractedFields, fieldConfidences)

  // Status og derivation
  const dExpiry = contract.expiry_date ? daysUntil(contract.expiry_date) : null
  const isExpiring = dExpiry != null && dExpiry >= 0 && dExpiry <= 30
  const isExpired = dExpiry != null && dExpiry < 0

  const statusBadgeTone: BadgeTone = isExpired
    ? 'red'
    : isExpiring
      ? 'amber'
      : contract.status === 'AKTIV'
        ? 'green'
        : 'gray'

  const currentVersion = contract.versions[0]
  const sortedVersions = contract.versions

  // 6-cell strip
  const stripCells: StripCellData[] = [
    {
      num: <span className="text-[12px]">{getContractTypeLabel(contract.system_type)}</span>,
      label: 'Type',
    },
    {
      num: <span className="text-[12px]">{getSensitivityLabel(contract.sensitivity)}</span>,
      label: 'Sensitivitet',
    },
    {
      num: currentVersion ? `v${currentVersion.version_number}` : '—',
      label: currentVersion ? 'Aktuel version' : 'Ingen versioner endnu',
      color: currentVersion ? 'default' : 'amber',
    },
    {
      num: (
        <span className="text-[14px]">
          {contract.effective_date ? formatDate(contract.effective_date) : '—'}
        </span>
      ),
      label: 'Effektiv',
    },
    {
      num: dExpiry == null ? '—' : isExpired ? `${Math.abs(dExpiry)}d` : `${dExpiry}d`,
      label: contract.expiry_date ? `Udløb · ${formatDate(contract.expiry_date)}` : 'Ingen udløb',
      color: isExpired ? 'red' : isExpiring ? 'red' : 'default',
    },
    {
      num: contract.parties.length,
      label: contract.parties.length === 0 ? 'Parter · mangler' : 'Parter',
      color: contract.parties.length === 0 ? 'amber' : 'default',
    },
  ]

  // Parter-rækker
  const partyRows = contract.parties.map((p) => ({
    id: p.id,
    name: p.person
      ? `${p.person.first_name} ${p.person.last_name}`
      : (p.counterparty_name ?? 'Ekstern part'),
    role: p.role_in_contract ?? 'Part',
    sub: p.person ? 'Intern person' : p.counterparty_name ? 'Ekstern part' : 'Part',
  }))

  // Tilknytninger
  const links = [
    {
      id: 'cases',
      title:
        cases.length > 0
          ? `${cases.length} ${cases.length === 1 ? 'sag' : 'sager'}`
          : 'Ingen sager',
      sub: cases[0]
        ? `${cases[0].case_number ? `#${cases[0].case_number} · ` : ''}${cases[0].title}`
        : 'Ingen sager tilknyttet denne kontrakt',
      count: cases.length,
      critical: cases.some((c) => c.status === 'NY' || c.status === 'AKTIV'),
      href: `/cases?contract=${contract.id}`,
    },
    {
      id: 'tasks',
      title:
        tasks.length > 0
          ? `${tasks.length} ${tasks.length === 1 ? 'opgave' : 'opgaver'}`
          : 'Ingen opgaver',
      sub: tasks[0]
        ? `${tasks[0].title}${tasks[0].due_date ? ` · frist ${formatDate(tasks[0].due_date)}` : ''}`
        : 'Ingen opgaver tilknyttet',
      count: tasks.length,
      critical: false,
      href: `/tasks?contract=${contract.id}`,
    },
    {
      id: 'documents',
      title:
        documents.length > 0
          ? `${documents.length} ${documents.length === 1 ? 'dokument' : 'dokumenter'}`
          : 'Ingen dokumenter',
      sub: documents[0]
        ? `${documents[0].file_name} · ${formatDate(documents[0].uploaded_at)}`
        : 'Upload for at knytte til denne kontrakt',
      count: documents.length,
      critical: false,
      href: `/documents?company=${contract.company_id}`,
    },
  ]

  // Aktivitets-rækker (lifecycle events fra kontrakt + versioner)
  const activityRows: Array<{ key: string; who: string; what: string; when: Date }> = [
    {
      key: `created-${contract.id}`,
      who: 'System',
      what: `${contract.display_name} oprettet`,
      when: contract.created_at,
    },
    ...contract.versions.map((v) => ({
      key: `v-${v.id}`,
      who: uploaderMap.get(v.uploaded_by) ?? 'Ukendt',
      what: `uploadede v${v.version_number} · ${getChangeTypeLabel(v.change_type)}`,
      when: v.uploaded_at,
    })),
  ]
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, 5)

  return (
    <>
      <Breadcrumb
        trail={[{ label: 'Kontrakter', href: '/contracts' }]}
        current={`${contract.display_name} · ${contract.company.name}`}
      />

      <PageHeader
        title={contract.display_name}
        statusBadge={
          <Badge tone={statusBadgeTone} className="text-[11px]">
            {isExpired
              ? 'Udløbet'
              : isExpiring
                ? 'Udløber snart'
                : getContractStatusLabel(contract.status)}
          </Badge>
        }
        meta={
          <>
            {contract.company.name}
            <MetaSep />
            {getContractTypeLabel(contract.system_type)}
            <MetaSep />
            {getSensitivityLabel(contract.sensitivity)}
            <MetaSep />
            Oprettet {formatDate(contract.created_at)}
          </>
        }
        actions={
          <>
            <ContractStatusButton contractId={contract.id} currentStatus={contract.status} />
            <ContractEditTrigger
              contract={{
                id: contract.id,
                displayName: contract.display_name,
                systemType: contract.system_type,
                sensitivity: contract.sensitivity,
                expiryDate: contract.expiry_date,
                effectiveDate: contract.effective_date,
                notes: contract.notes,
              }}
            />
            <UploadVersionTrigger
              contractId={contract.id}
              contractName={contract.display_name}
              companyId={contract.company_id}
              companyName={contract.company.name}
              currentVersion={currentVersion?.version_number ?? null}
              variant="primary"
            />
          </>
        }
      />

      <Strip cells={stripCells} />

      {isExpiring && (
        <AlertBar
          tone="red"
          actions={
            <>
              {currentVersion?.file_url ? (
                <BButton href={currentVersion.file_url}>Se dokument</BButton>
              ) : (
                <BButton disabled>Se dokument</BButton>
              )}
              <BButton primary href={`/tasks/new?contract=${contract.id}`}>
                Start forny-flow
              </BButton>
            </>
          }
        >
          <strong>
            {contract.display_name} udløber om {dExpiry} {dExpiry === 1 ? 'dag' : 'dage'}
          </strong>{' '}
          · forhandling ikke startet
        </AlertBar>
      )}

      {/* 2-col: Vilkår + AI Insight */}
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-1.5">
                Vilkår <PlusBadge />
              </span>
            }
            meta={
              keyTerms.length > 0 ? `${keyTerms.length} AI-extracted` : 'Ingen extraction endnu'
            }
            actions={
              <Link
                href={
                  extraction && extraction.document
                    ? `/documents?company=${contract.company_id}`
                    : '#'
                }
                className="text-b-ai-accent no-underline hover:underline"
              >
                Review status →
              </Link>
            }
          />
          {keyTerms.length === 0 ? (
            <PanelEmpty>Upload et dokument for at få AI-extracted vilkår</PanelEmpty>
          ) : (
            <div className="px-3 py-2.5">
              {keyTerms.map((t, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[148px_1fr_auto] items-center gap-3 border-b border-b-divider py-1.5 last:border-b-0"
                >
                  <span
                    className="text-[11px] uppercase text-b-2"
                    style={{ letterSpacing: '0.3px' }}
                  >
                    {t.label}
                  </span>
                  <span className="b-tnum text-[13px] font-medium text-b-1">{t.value}</span>
                  {confidenceBadge(t.confidence)}
                </div>
              ))}
            </div>
          )}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <Link
                href={`/documents?company=${contract.company_id}`}
                className="text-b-ai-accent no-underline hover:underline"
              >
                Review AI-extractions →
              </Link>
              {extraction && extraction.document && (
                <span className="b-tnum text-[11px] text-b-2">
                  Opdateret {formatDate(extraction.updated_at)} · {extraction.document.file_name}
                </span>
              )}
            </div>
          </PanelFooter>
        </Panel>

        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-1.5">
                AI Insight <PlusBadge />
              </span>
            }
            meta={extraction ? `Opdateret ${formatDate(extraction.updated_at)}` : 'Ingen analyse'}
          />
          {extraction ? (
            <div>
              <div className="p-2">
                <AIInsightCard
                  label="⚡ Renewal-risk"
                  confidence={`${keyTerms.length > 0 ? Math.round((keyTerms.reduce((s, t) => s + (t.confidence ?? 0), 0) / keyTerms.length) * 100) : 0}% konfidens`}
                  cite={`Baseret på ${keyTerms.length} AI-extracted vilkår fra ${extraction.document?.file_name ?? 'dokumentet'}.`}
                  actionHref={`/documents?company=${contract.company_id}`}
                  actionLabel="Se sammenligningsgrundlag →"
                >
                  {isExpiring ? (
                    <>
                      Kontrakten udløber inden for 30 dage. Forventet markedsleje for
                      sammenlignelige kontrakter ligger typisk <strong>5–12% over</strong>{' '}
                      nuværende. Start forhandling nu, ikke efter udløb.
                    </>
                  ) : (
                    <>
                      AI har gennemgået {keyTerms.length} vilkår.{' '}
                      {keyTerms.filter((t) => (t.confidence ?? 1) < 0.75).length} har lav konfidens
                      og bør reviewes manuelt før de bruges i forhandling.
                    </>
                  )}
                </AIInsightCard>
              </div>
              <div className="border-t border-b-border px-3 py-2">
                <div
                  className="mb-1.5 text-[10px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.5px' }}
                >
                  Handlingsforslag
                </div>
                <div className="flex flex-col gap-1">
                  {isExpiring && (
                    <div className="flex items-center justify-between text-[12px]">
                      <span>Start forny-flow</span>
                      <Badge tone="amber">Haster</Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[12px]">
                    <span>Review extractions med lav konfidens</span>
                    <Badge tone="gray">Anbefalet</Badge>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <PanelEmpty>AI-analyse aktiveres når et dokument er uploadet og processeret</PanelEmpty>
          )}
        </Panel>
      </div>

      {/* Versionshistorik */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              Versionshistorik
              <span className="rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
                {sortedVersions.length}
              </span>
            </span>
          }
          meta={
            currentVersion ? `v${currentVersion.version_number} er aktuel · sortér: nyeste` : ''
          }
        />
        {sortedVersions.length === 0 ? (
          <PanelEmpty>Ingen versioner uploadet endnu</PanelEmpty>
        ) : (
          <>
            <div
              className="grid items-center gap-2.5 border-b border-b-border bg-b-panel-h px-3 py-1.5 text-[10px] font-semibold uppercase text-b-3"
              style={{
                gridTemplateColumns: '36px 110px 72px 1fr 60px',
                letterSpacing: '0.5px',
              }}
            >
              <span>Ver.</span>
              <span>Dato</span>
              <span>Af</span>
              <span>Type</span>
              <span>Dokument</span>
            </div>
            {sortedVersions.map((v, idx) => (
              <div
                key={v.id}
                className="grid cursor-pointer items-center gap-2.5 border-b border-b-divider px-3 py-1.5 text-[13px] last:border-b-0 hover:bg-b-row-hover"
                style={{ gridTemplateColumns: '36px 110px 72px 1fr 60px' }}
              >
                <span
                  className={`b-tnum font-semibold ${idx === sortedVersions.length - 1 ? 'text-b-3' : 'text-b-1'}`}
                >
                  v{v.version_number}
                </span>
                <span className="b-tnum text-b-2">{formatDate(v.uploaded_at)}</span>
                <span className="text-b-2">{uploaderMap.get(v.uploaded_by) ?? 'Ukendt'}</span>
                <span>
                  <Badge tone={changeTypeTone(v.change_type)}>
                    {getChangeTypeLabel(v.change_type).toUpperCase()}
                  </Badge>
                </span>
                <span>
                  <a
                    href={v.file_url}
                    className="text-[11px] text-b-blue-fg no-underline hover:underline"
                  >
                    ↓ Hent
                  </a>
                </span>
              </div>
            ))}
          </>
        )}
        <PanelFooter>
          <div className="flex items-center justify-between">
            <span>
              {sortedVersions.length} version{sortedVersions.length === 1 ? '' : 'er'}
              {sortedVersions.length > 0 ? ' · v1 er original' : ''}
            </span>
            <UploadVersionTrigger
              contractId={contract.id}
              contractName={contract.display_name}
              companyId={contract.company_id}
              companyName={contract.company.name}
              currentVersion={currentVersion?.version_number ?? null}
              variant="add"
            />
          </div>
        </PanelFooter>
      </Panel>

      {/* 3-col: Parter + Tilknytninger + Aktivitet */}
      <div className="grid gap-3 lg:grid-cols-3 lg:items-start">
        {/* Parter */}
        <Panel>
          <PanelHeader title="Parter" meta={`${partyRows.length} parter`} />
          {partyRows.length === 0 ? (
            <PanelEmpty
              title="Ingen parter registreret endnu"
              hint="Tilføj parter for at signere og spore ansvar"
            />
          ) : (
            partyRows.map((p, i) => (
              <div
                key={p.id}
                className={`grid grid-cols-[1fr_auto_14px] items-center gap-2 px-3 py-1.5 ${
                  i < partyRows.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-b-1">{p.name}</div>
                  <div className="mt-px text-[11px] text-b-2">{p.sub}</div>
                </div>
                <Badge tone="gray">{p.role}</Badge>
                <span className="text-b-3">›</span>
              </div>
            ))
          )}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <span />
              <AddContractPartyTrigger
                contractId={contract.id}
                contractName={contract.display_name}
                persons={persons.map((p) => ({
                  id: p.id,
                  firstName: p.first_name,
                  lastName: p.last_name,
                  email: p.email,
                }))}
              />
            </div>
          </PanelFooter>
        </Panel>

        {/* Tilknytninger */}
        <Panel>
          <PanelHeader title="Tilknytninger" meta={`${links.length} elementer`} />
          {links.map((link, i) => (
            <Link
              key={link.id}
              href={link.href}
              className={`grid cursor-pointer grid-cols-[1fr_auto_14px] items-center gap-2 px-3 py-1.5 text-[13px] no-underline hover:bg-b-row-hover ${
                i < links.length - 1 ? 'border-b border-b-divider' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-b-1">{link.title}</div>
                <div className="mt-px text-[11px] text-b-2">{link.sub}</div>
              </div>
              <span
                className={`b-tnum rounded-[10px] px-1.5 py-px text-[11px] font-semibold ${
                  link.critical && link.count > 0
                    ? 'bg-b-red-bg text-b-red-fg'
                    : 'bg-b-border text-b-gray-fg'
                }`}
              >
                {link.count}
              </span>
              <span className="text-b-3">›</span>
            </Link>
          ))}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <span />
              <BAddButton href={`/tasks/new?contract=${contract.id}`}>+ Tilknyt element</BAddButton>
            </div>
          </PanelFooter>
        </Panel>

        {/* Aktivitet */}
        <Panel>
          <PanelHeader title="Aktivitet" meta={`Seneste ${activityRows.length}`} />
          {activityRows.length === 0 ? (
            <PanelEmpty>Ingen aktivitet</PanelEmpty>
          ) : (
            activityRows.map((a, i) => (
              <div
                key={a.key}
                className={`flex items-start justify-between gap-3 px-3 py-1.5 ${
                  i < activityRows.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <div className="min-w-0 text-[12px] leading-snug text-b-1">
                  <span className="font-medium">{a.who}</span> {a.what}
                </div>
                <span className="b-tnum shrink-0 text-[11px] text-b-3">{formatDate(a.when)}</span>
              </div>
            ))
          )}
          <PanelFooter>
            <span className="text-b-3">
              Viser seneste {activityRows.length} begivenheder · versionshistorik vist separat
              ovenfor
            </span>
          </PanelFooter>
        </Panel>
      </div>

      <BottomBar
        left={
          <>
            Sidst opdateret {formatDate(contract.updated_at)} · {contract.company.name} ·{' '}
            {contract.display_name}
            {currentVersion ? ` v${currentVersion.version_number}` : ''}
          </>
        }
      />
    </>
  )
}
