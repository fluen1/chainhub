'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Breadcrumb,
  PageHeader,
  MetaSep,
  BButton,
  BAddButton,
  Strip,
  type StripCellData,
  Panel,
  PanelHeader,
  PanelFooter,
  Badge,
  type BadgeTone,
  PlusBadge,
  BottomBar,
  KbdHint,
  AIBadge,
} from '@/components/ui/b'
import dynamic from 'next/dynamic'
import { EndRoleLink } from './end-role-link'
import { EditPersonDialog } from '@/components/persons/EditPersonDialog'

// Lazy-load GdprPanel — kun vist for admins, splittes fra hoved-bundle
const GdprPanel = dynamic(() => import('@/components/persons/GdprPanel').then(m => m.GdprPanel))
import { AddPersonRoleModal } from '@/components/persons/AddPersonRoleModal'
import { AddPersonOwnershipModal } from '@/components/persons/AddPersonOwnershipModal'
import { getCaseStatusLabel } from '@/lib/labels'

// ────────────────────────────────────────────────────────────────────────────
// /persons/[id] — server-component (ingen client interaktivitet behov for V1).
// Layout matcher docs/design/handoff/project/Person detail.html.
// ────────────────────────────────────────────────────────────────────────────

export interface PersonView {
  id: string
  firstName: string
  lastName: string
  fullName: string
  initials: string
  email: string | null
  phone: string | null
  notes: string | null
  activeRolesCount: number
  historicRolesCount: number
  companiesCount: number
  contractsCount: number
  casesCount: number
  status: string
  activeSince: string | null
  anciennitet: string
  lonStr: string
  primaryRoles: Array<{ label: string; rawRole: string }>
}

export interface PersonRoleData {
  id: string
  rolle: string
  rawRole: string
  selskab: string
  selskabId: string
  type: string
  aktivSiden: string
}

export interface PersonOwnershipData {
  id: string
  selskab: string
  selskabId: string
  pct: number
  type: string
  siden: string
  isEnded: boolean
  contractStatus: string | null
}

export interface PersonContractData {
  id: string
  ver: string
  type: string
  selskab: string
  ai: boolean
  status: string
  rawStatus: string
  udlob: string
}

export interface PersonCaseData {
  id: string
  nr: string
  title: string
  status: string
}

export interface PersonAIFieldData {
  label: string
  value: string
  confidence: number
}

function roleTone(rawRole: string): BadgeTone {
  const governance = [
    'direktoer',
    'bestyrelsesformand',
    'bestyrelsesmedlem',
    'tegningsberettiget',
    'leder',
  ]
  return governance.includes(rawRole) ? 'blue' : 'gray'
}

function confidenceBadge(conf: number): React.ReactNode {
  const pct = Math.round(conf * 100)
  if (pct >= 85) return <Badge tone="green">{`✓ AI ${pct}%`}</Badge>
  if (pct >= 70) return <Badge tone="amber">{`⚠ AI ${pct}%`}</Badge>
  return <Badge tone="red">{`⚠ AI ${pct}%`}</Badge>
}

function contractStatusTone(status: string): BadgeTone {
  if (status === 'AKTIV') return 'green'
  if (status === 'UDLOEBET') return 'red'
  return 'gray'
}

interface AccessibleCompany {
  id: string
  name: string
}

export function PersonDetailB({
  person,
  roller,
  ejerskab,
  contracts,
  sager,
  aiVilkaar,
  aiSourceDoc,
  isAdmin,
  accessibleCompanies,
}: {
  person: PersonView
  roller: PersonRoleData[]
  ejerskab: PersonOwnershipData[]
  contracts: PersonContractData[]
  sager: PersonCaseData[]
  aiVilkaar: PersonAIFieldData[]
  aiSourceDoc: string | null
  isAdmin: boolean
  accessibleCompanies: AccessibleCompany[]
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [addRoleOpen, setAddRoleOpen] = useState(false)
  const [addOwnershipOpen, setAddOwnershipOpen] = useState(false)

  const stripCells: StripCellData[] = [
    { num: person.activeRolesCount, label: 'Roller' },
    { num: person.companiesCount, label: 'Selskaber' },
    { num: person.contractsCount, label: 'Kontrakter' },
    { num: person.casesCount, label: 'Sager', color: person.casesCount > 0 ? 'red' : 'default' },
    {
      num: <span className="text-[14px]">{person.anciennitet}</span>,
      label: 'Anciennitet',
    },
    { num: person.lonStr, label: 'Løn kr/md', color: person.lonStr !== '—' ? 'green' : 'default' },
  ]

  return (
    <>
      <Breadcrumb trail={[{ label: 'Personer', href: '/persons' }]} current={person.fullName} />

      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <InitialsBox ini={person.initials} size="lg" />
            <span>{person.fullName}</span>
            {person.primaryRoles.map((r, i) => (
              <Badge key={i} tone={roleTone(r.rawRole)} className="text-[11px]">
                {r.label}
              </Badge>
            ))}
          </span>
        }
        meta={
          <>
            {person.activeSince ? `Aktiv siden ${person.activeSince}` : 'Ingen aktive roller'}
            <MetaSep />
            {person.companiesCount} {person.companiesCount === 1 ? 'selskab' : 'selskaber'}
            <MetaSep />
            {person.contractsCount} {person.contractsCount === 1 ? 'kontrakt' : 'kontrakter'}
            {person.status !== 'Aktiv' && (
              <>
                <MetaSep />
                <Badge tone="gray">{person.status}</Badge>
              </>
            )}
          </>
        }
        actions={<BButton onClick={() => setEditOpen(true)}>Rediger</BButton>}
      />

      <Strip cells={stripCells} />

      {/* 3-col: Roller + Ejerskab + AI Vilkår */}
      <div className="grid gap-3 lg:grid-cols-3 lg:items-start">
        {/* Roller og tilknytninger */}
        <Panel>
          <PanelHeader
            title="Roller og tilknytninger"
            meta={`${roller.length} ${roller.length === 1 ? 'aktiv' : 'aktive'}`}
          />
          {roller.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-b-3">
              Ingen aktive roller — tilføj en rolle for at knytte personen til et selskab
            </div>
          ) : (
            roller.map((r, i) => (
              <div
                key={r.id}
                className={`grid grid-cols-[1fr_auto_auto_14px] items-center gap-2 px-3 py-1.5 hover:bg-b-row-hover ${
                  i < roller.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <Link href={`/companies/${r.selskabId}`} className="min-w-0 no-underline">
                  <div className="truncate text-[13px] font-medium text-b-1">{r.selskab}</div>
                  <div className="mt-px text-[11px] text-b-2">
                    {r.type} · aktiv siden {r.aktivSiden}
                  </div>
                </Link>
                <Badge tone={roleTone(r.rawRole)}>{r.rolle}</Badge>
                <EndRoleLink
                  companyPersonId={r.id}
                  personName={person.fullName}
                  roleLabel={r.rolle}
                  selskab={r.selskab}
                  startDate={r.aktivSiden}
                />
                <Link href={`/companies/${r.selskabId}`} className="text-b-3 no-underline">
                  ›
                </Link>
              </div>
            ))
          )}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <span />
              <BAddButton onClick={() => setAddRoleOpen(true)}>+ Tilføj rolle</BAddButton>
            </div>
          </PanelFooter>
        </Panel>

        {/* Ejerskab */}
        <Panel>
          <PanelHeader
            title="Ejerskab"
            meta={`${ejerskab.length} ${ejerskab.length === 1 ? 'selskab' : 'selskaber'}`}
          />
          {ejerskab.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-b-3">
              Personen er ikke registreret som ejer
            </div>
          ) : (
            ejerskab.map((e, idx) => (
              <div
                key={e.id}
                className={`${idx < ejerskab.length - 1 ? 'border-b-2 border-b-divider' : ''}`}
              >
                <OwnRow label="Selskab" value={<span className="font-medium">{e.selskab}</span>} />
                <OwnRow
                  label="Andel"
                  value={
                    <span className="b-tnum text-[14px] font-semibold text-b-1">
                      {e.pct.toFixed(0)}%
                    </span>
                  }
                />
                <OwnRow label="Type" value={e.type} />
                <OwnRow label="Siden" value={<span className="text-b-2">{e.siden}</span>} />
                <OwnRow
                  label="Ejeraftale"
                  value={
                    e.contractStatus ? (
                      <Badge tone={contractStatusTone(e.contractStatus)}>
                        {e.contractStatus === 'AKTIV' ? 'Aktiv' : e.contractStatus}
                      </Badge>
                    ) : (
                      <span className="text-b-3">Ikke registreret</span>
                    )
                  }
                  isLast
                />
              </div>
            ))
          )}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <span />
              <BAddButton onClick={() => setAddOwnershipOpen(true)}>+ Tilføj ejerskab</BAddButton>
            </div>
          </PanelFooter>
        </Panel>

        {/* AI Ansættelses-vilkår (Plus) */}
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-1.5">
                Ansættelses-vilkår <PlusBadge />
              </span>
            }
            meta={aiVilkaar.length > 0 ? 'AI-extracted' : 'Ingen extraction'}
          />
          {aiVilkaar.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-b-3">
              Upload en ansættelseskontrakt for at få AI-extracted vilkår
            </div>
          ) : (
            <div className="px-3 py-2.5">
              {aiVilkaar.map((v, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[110px_1fr_auto] items-center gap-2 border-b border-b-divider py-1.5 last:border-b-0"
                >
                  <span
                    className="text-[11px] uppercase text-b-2"
                    style={{ letterSpacing: '0.3px' }}
                  >
                    {v.label}
                  </span>
                  <span className="b-tnum text-[13px] font-medium text-b-1">{v.value}</span>
                  {confidenceBadge(v.confidence)}
                </div>
              ))}
            </div>
          )}
          {aiSourceDoc && (
            <PanelFooter>
              <div className="flex items-center justify-between">
                <Link
                  href={`/documents/review/${aiSourceDoc}`}
                  className="text-b-ai-accent no-underline hover:underline"
                >
                  Review AI-extractions →
                </Link>
                <span className="text-b-2">Kilde: dokument</span>
              </div>
            </PanelFooter>
          )}
        </Panel>
      </div>

      {/* Kontrakter (full-width) */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              Kontrakter
              <span className="rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
                {contracts.length}
              </span>
            </span>
          }
          meta="sortér: type"
        />
        {contracts.length === 0 ? (
          <div className="px-3 py-4 text-center text-[12px] text-b-3">
            Ingen kontrakter knyttet — upload den første for at begynde
          </div>
        ) : (
          <>
            <div
              className="grid items-center gap-2 border-b border-b-border bg-b-panel-h px-3 py-1.5 text-[10px] font-semibold uppercase text-b-3"
              style={{
                gridTemplateColumns: '36px 1fr 160px 80px 70px 14px',
                letterSpacing: '0.5px',
              }}
            >
              <span>Ver.</span>
              <span>Type</span>
              <span>Selskab</span>
              <span>Status</span>
              <span>Udløb</span>
              <span />
            </div>
            {contracts.map((c, i) => (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className={`grid items-center gap-2 px-3 py-1.5 text-[13px] no-underline hover:bg-b-row-hover ${
                  i < contracts.length - 1 ? 'border-b border-b-divider' : ''
                }`}
                style={{ gridTemplateColumns: '36px 1fr 160px 80px 70px 14px' }}
              >
                <Badge tone="gray">{c.ver}</Badge>
                <span className="flex items-center gap-1.5 font-medium text-b-1">
                  {c.type}
                  {c.ai && <AIBadge />}
                </span>
                <span className="truncate text-b-2">{c.selskab}</span>
                <Badge tone={contractStatusTone(c.rawStatus)}>{c.status}</Badge>
                <span className="text-b-2">{c.udlob}</span>
                <span className="text-b-3">›</span>
              </Link>
            ))}
          </>
        )}
        <PanelFooter>
          <div className="flex items-center justify-between">
            <span>
              {contracts.filter((c) => c.rawStatus === 'AKTIV').length} aktive ·{' '}
              {contracts.filter((c) => c.rawStatus === 'UDLOEBET').length} udløbne
            </span>
            <BAddButton href="/contracts/new">+ Upload kontrakt</BAddButton>
          </div>
        </PanelFooter>
      </Panel>

      {/* 2-col: Sager + Kontakt */}
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        {/* Sager */}
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                Sager
                <span className="rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
                  {sager.length}
                </span>
              </span>
            }
            meta={
              sager.filter((s) => s.status === 'NY' || s.status === 'AKTIV').length > 0
                ? `${sager.filter((s) => s.status === 'NY' || s.status === 'AKTIV').length} åbne`
                : 'Ingen åbne'
            }
          />
          {sager.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-b-3">
              Personen er ikke tilknyttet nogen sager
            </div>
          ) : (
            sager.map((s, i) => (
              <Link
                key={s.id}
                href={`/cases/${s.id}`}
                className={`grid grid-cols-[40px_1fr_auto_14px] items-center gap-2 px-3 py-1.5 text-[13px] no-underline hover:bg-b-row-hover ${
                  i < sager.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <span className="b-tnum text-b-2">{s.nr}</span>
                <span className="truncate text-b-1">{s.title}</span>
                <Badge
                  tone={
                    s.status === 'NY' || s.status === 'AKTIV'
                      ? 'blue'
                      : s.status === 'LUKKET'
                        ? 'green'
                        : 'gray'
                  }
                >
                  {getCaseStatusLabel(s.status)}
                </Badge>
                <span className="text-b-3">›</span>
              </Link>
            ))
          )}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <span />
              <BAddButton href="/cases/new">+ Opret sag</BAddButton>
            </div>
          </PanelFooter>
        </Panel>

        {/* Kontakt */}
        <Panel>
          <PanelHeader title="Kontaktoplysninger" />
          <div className="px-3 py-2.5">
            <CtRow
              label="E-mail"
              value={
                person.email ? (
                  <a
                    href={`mailto:${person.email}`}
                    className="text-b-blue-fg no-underline hover:underline"
                  >
                    {person.email}
                  </a>
                ) : (
                  <span className="text-b-3">Ingen e-mail</span>
                )
              }
            />
            <CtRow
              label="Telefon"
              value={person.phone ? person.phone : <span className="text-b-3">Ingen telefon</span>}
            />
            <CtRow
              label="Status"
              value={
                <Badge
                  tone={
                    person.status === 'Aktiv'
                      ? 'green'
                      : person.status === 'Opsagt'
                        ? 'red'
                        : 'gray'
                  }
                >
                  {person.status}
                </Badge>
              }
            />
            <CtRow
              label="Aktiv siden"
              value={
                person.activeSince ? (
                  <>
                    {person.activeSince} <span className="text-b-2">· {person.anciennitet}</span>
                  </>
                ) : (
                  <span className="text-b-3">Ingen aktive roller</span>
                )
              }
              isLast={!person.notes}
            />
            {person.notes && (
              <CtRow
                label="Noter"
                value={<span className="text-[12px] text-b-2">{person.notes}</span>}
                isLast
              />
            )}
          </div>
          <PanelFooter>
            <div className="flex items-center justify-between">
              <span />
              <BAddButton onClick={() => setEditOpen(true)}>Rediger</BAddButton>
            </div>
          </PanelFooter>
        </Panel>
      </div>

      {/* GDPR-panel — vises kun for admins */}
      <GdprPanel personId={person.id} personFullName={person.fullName} isAdmin={isAdmin} />

      <BottomBar
        left={
          <>
            {person.fullName} · {person.companiesCount}{' '}
            {person.companiesCount === 1 ? 'selskab' : 'selskaber'} · {person.contractsCount}{' '}
            kontrakter
          </>
        }
        right={
          <>
            <KbdHint k="⌘K" label="handling" />
            <span>·</span>
            <KbdHint k="E" label="rediger" />
            <span>·</span>
            <KbdHint k="G" label="derhen" />
          </>
        }
      />

      {/* Modaler */}
      <EditPersonDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        person={{
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          phone: person.phone,
          notes: person.notes,
        }}
      />
      <AddPersonRoleModal
        open={addRoleOpen}
        onClose={() => setAddRoleOpen(false)}
        personId={person.id}
        personFullName={person.fullName}
        accessibleCompanies={accessibleCompanies}
      />
      <AddPersonOwnershipModal
        open={addOwnershipOpen}
        onClose={() => setAddOwnershipOpen(false)}
        personId={person.id}
        personFullName={person.fullName}
        accessibleCompanies={accessibleCompanies}
      />
    </>
  )
}

function InitialsBox({ ini, size = 'lg' }: { ini: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim =
    size === 'lg'
      ? 'h-9 w-9 text-[12px]'
      : size === 'md'
        ? 'h-7 w-7 text-[11px]'
        : 'h-5 w-5 text-[10px]'
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] bg-b-border font-semibold text-b-gray-fg ${dim}`}
    >
      {ini}
    </span>
  )
}

function OwnRow({
  label,
  value,
  isLast,
}: {
  label: string
  value: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div
      className={`grid grid-cols-[80px_1fr] items-center gap-2 px-3 py-1 text-[12px] ${
        isLast ? '' : 'border-b border-b-divider'
      }`}
    >
      <span className="text-[11px] text-b-2">{label}</span>
      <span className="text-b-1">{value}</span>
    </div>
  )
}

function CtRow({
  label,
  value,
  isLast,
}: {
  label: string
  value: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div
      className={`grid grid-cols-[100px_1fr] items-center gap-3 py-1.5 ${
        isLast ? '' : 'border-b border-b-divider'
      }`}
    >
      <span
        className="text-[10px] font-semibold uppercase text-b-2"
        style={{ letterSpacing: '0.3px' }}
      >
        {label}
      </span>
      <span className="text-[13px] text-b-1">{value}</span>
    </div>
  )
}
