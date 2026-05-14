'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Breadcrumb,
  PageHeader,
  Panel,
  PanelHeader,
  PanelFooter,
  Badge,
  type BadgeTone,
  BottomBar,
  KbdHint,
} from '@/components/ui/b'
import { OrganizationForm } from '@/components/settings/organization-form'
import { CreateUserForm } from '@/components/settings/CreateUserForm'
import { UserActions } from '@/components/settings/UserActions'

// ────────────────────────────────────────────────────────────────────────────
// /settings — klient-komponent.
// Layout: venstre section-nav (160px) + højre content. Section-state via ?section=.
//
// Sektioner Organisation/Brugere/AI er fuldt funktionelle (data + actions).
// Notifikationer/Integrationer/Sikkerhed/Abonnement er "coming soon"-paneler
// i V1 — schemaet har ikke modeller for dem endnu.
// ────────────────────────────────────────────────────────────────────────────

export type SettingsSection =
  | 'org'
  | 'brugere'
  | 'ai'
  | 'notif'
  | 'integr'
  | 'sikkerhed'
  | 'faktura'

export interface SettingsUser {
  id: string
  navn: string
  email: string
  initials: string
  rolle: string
  rolleLabel: string
  sidstAktiv: string
  isSelf: boolean
  active: boolean
  companyIds: string[]
}

interface SettingsOrg {
  id: string
  name: string
  cvr: string | null
  plan: string
  planExpiresAt: string | null
  chainStructure: boolean
  createdAt: string
}

const SECTIONS: Array<{ key: SettingsSection; label: string; dot?: 'warn' | 'alert' }> = [
  { key: 'org', label: 'Organisation' },
  { key: 'brugere', label: 'Brugere og adgang' },
  { key: 'ai', label: 'AI-brug', dot: 'warn' },
  { key: 'notif', label: 'Notifikationer' },
  { key: 'integr', label: 'Integrationer' },
  { key: 'sikkerhed', label: 'Sikkerhed' },
  { key: 'faktura', label: 'Abonnement' },
]

function roleTone(role: string): BadgeTone {
  if (role === 'GROUP_OWNER' || role === 'GROUP_ADMIN') return 'blue'
  if (role === 'GROUP_LEGAL') return 'blue'
  if (role === 'GROUP_FINANCE') return 'amber'
  if (role.startsWith('COMPANY_')) return 'gray'
  return 'gray'
}

export function SettingsPageB({
  section,
  canManage,
  organization,
  companies,
  users,
  currentUserId,
  aiUsage,
}: {
  section: SettingsSection
  canManage: boolean
  organization: SettingsOrg | null
  companies: Array<{ id: string; name: string }>
  users: SettingsUser[]
  currentUserId: string
  aiUsage: { used: number; max: number; percent: number }
}) {
  const sectionLabel = SECTIONS.find((s) => s.key === section)?.label ?? ''

  return (
    <>
      <Breadcrumb trail={[{ label: 'Indstillinger', href: '/settings' }]} current={sectionLabel} />

      <div className="grid gap-3 lg:grid-cols-[180px_1fr] lg:items-start">
        <SectionNav active={section} />

        <div className="flex min-w-0 flex-col gap-3">
          {!canManage ? (
            <NoAccessPanel />
          ) : section === 'org' && organization ? (
            <OrgSection org={organization} />
          ) : section === 'brugere' ? (
            <BrugereSection users={users} companies={companies} currentUserId={currentUserId} />
          ) : section === 'ai' ? (
            <AISection usage={aiUsage} />
          ) : section === 'notif' ? (
            <ComingSoonSection
              title="Notifikationer"
              sub="E-mail og push-notifikationer"
              body="Konfigurérbare notifikationer (kontraktudløb, sagsfrister, AI-review) kommer i en senere version."
            />
          ) : section === 'integr' ? (
            <ComingSoonSection
              title="Integrationer"
              sub="E-conomic, Slack, Microsoft 365 mfl."
              body="Integration-konfiguration kommer når de respektive klienter er tilgængelige."
            />
          ) : section === 'sikkerhed' ? (
            <ComingSoonSection
              title="Sikkerhed"
              sub="2FA, session-timeout, audit log"
              body="Sikkerhedsindstillinger er under udvikling. Audit log findes i databasen og kan eksporteres på forespørgsel."
            />
          ) : section === 'faktura' ? (
            <FakturaSection org={organization} />
          ) : null}
        </div>
      </div>

      <BottomBar
        left={
          organization
            ? `${organization.name} · ${organization.plan} · ${currentUserIdToEmail(users, currentUserId)}`
            : '—'
        }
        right={
          <>
            <KbdHint k="⌘K" label="handling" />
            <span>·</span>
            <KbdHint k="S" label="gem" />
          </>
        }
      />
    </>
  )
}

function currentUserIdToEmail(users: SettingsUser[], id: string): string {
  return users.find((u) => u.id === id)?.email ?? ''
}

// ────────────────────────────────────────────────────────────────────────────

function SectionNav({ active }: { active: SettingsSection }) {
  const params = useSearchParams()

  function href(key: SettingsSection): string {
    const sp = new URLSearchParams(params.toString())
    if (key === 'org') sp.delete('section')
    else sp.set('section', key)
    const q = sp.toString()
    return q ? `/settings?${q}` : '/settings'
  }

  return (
    <aside className="sticky top-3 self-start">
      <div
        className="mb-1.5 px-2 text-[10px] font-semibold uppercase text-b-2"
        style={{ letterSpacing: '0.5px' }}
      >
        Indstillinger
      </div>
      <nav className="flex flex-col gap-px">
        {SECTIONS.map((s) => {
          const isActive = s.key === active
          return (
            <Link
              key={s.key}
              href={href(s.key)}
              className={`flex items-center gap-2 rounded-[4px] px-2.5 py-1 text-[13px] no-underline transition-colors ${
                isActive ? 'bg-[#e8eaee] font-medium text-b-1' : 'text-b-1 hover:bg-[#ecedf0]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  s.dot === 'warn'
                    ? 'bg-b-amber-fg'
                    : s.dot === 'alert'
                      ? 'bg-b-red-fg'
                      : 'bg-transparent'
                }`}
              />
              {s.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function NoAccessPanel() {
  return (
    <Panel>
      <PanelHeader title="Ingen adgang" />
      <div className="px-3 py-4 text-[13px] text-b-2">
        Du har ikke adgang til indstillinger. Kontakt din kædeejer eller administrator.
      </div>
    </Panel>
  )
}

function OrgSection({ org }: { org: SettingsOrg }) {
  return (
    <>
      <PageHeader title="Organisation" meta="Stamdata og kontaktoplysninger for kædegruppen" />

      <Panel>
        <PanelHeader title="Kædegruppe" />
        <div className="px-3 py-3">
          <OrganizationForm
            initialName={org.name}
            initialCvr={org.cvr}
            initialChainStructure={org.chainStructure}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Plan og oprettelse" />
        <KvRow
          label="Plan"
          value={
            <>
              <Badge tone="blue">{org.plan}</Badge>
              {org.planExpiresAt && (
                <span className="ml-2 text-[11px] text-b-2">Fornyelse {org.planExpiresAt}</span>
              )}
            </>
          }
        />
        <KvRow label="Oprettet" value={<span className="text-b-2">{org.createdAt}</span>} isLast />
      </Panel>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function BrugereSection({
  users,
  companies,
}: {
  users: SettingsUser[]
  companies: Array<{ id: string; name: string }>
  currentUserId: string
}) {
  return (
    <>
      <PageHeader
        title="Brugere og adgang"
        meta={`${users.length} ${users.length === 1 ? 'bruger' : 'brugere'} · Roller styrer adgang til data`}
        actions={
          <div className="flex shrink-0 items-center">
            <CreateUserForm companies={companies} />
          </div>
        }
      />

      <Panel>
        <PanelHeader title="Aktive brugere" meta={`${users.length} brugere`} />
        {users.length === 0 ? (
          <div className="px-3 py-3 text-center text-[12px] text-b-3">Ingen brugere endnu</div>
        ) : (
          users.map((u, i) => (
            <div
              key={u.id}
              className={`grid grid-cols-[28px_1fr_auto_auto] items-center gap-2.5 px-3 py-1.5 ${
                i < users.length - 1 ? 'border-b border-b-divider' : ''
              }`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] bg-b-border text-[11px] font-semibold text-b-gray-fg">
                {u.initials}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5 text-[13px]">
                  <span className="truncate font-medium text-b-1">{u.navn}</span>
                  {u.isSelf && <span className="text-[10px] text-b-3">dig</span>}
                </div>
                <div className="truncate text-[11px] text-b-2">
                  {u.email} · Sidst aktiv: {u.sidstAktiv}
                </div>
              </div>
              <Badge tone={roleTone(u.rolle)}>{u.rolleLabel}</Badge>
              <UserActions
                userId={u.id}
                currentRole={u.rolle as Parameters<typeof UserActions>[0]['currentRole']}
                currentCompanyIds={u.companyIds}
                active={u.active}
                isSelf={u.isSelf}
                companies={companies}
              />
            </div>
          ))
        )}
        <PanelFooter>
          <span>Roller: Ejer · Admin · Juridisk · Finans · Læse adgang</span>
        </PanelFooter>
      </Panel>

      <Panel>
        <PanelHeader title="Ventende invitationer" meta="0" />
        <div className="px-3 py-3 text-center text-[12px] text-b-3">
          Ingen ventende invitationer
        </div>
      </Panel>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function AISection({ usage }: { usage: { used: number; max: number; percent: number } }) {
  const fillTone =
    usage.percent >= 80 ? 'bg-b-red-fg' : usage.percent >= 60 ? 'bg-b-amber-fg' : 'bg-b-green-fg'
  const pctColor =
    usage.percent >= 80
      ? 'text-b-red-fg'
      : usage.percent >= 60
        ? 'text-b-amber-fg'
        : 'text-b-green-fg'

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            AI-brug
            <Badge tone="blue">Plus</Badge>
          </span>
        }
        meta="Extraction, insights og risikovurdering"
      />

      <Panel>
        <PanelHeader
          title="Månedlig kvota"
          meta={<span className={`font-medium ${pctColor}`}>{usage.percent}% brugt</span>}
        />
        <div className="px-3 py-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-b-border">
            <div
              className={`h-full transition-all ${fillTone}`}
              style={{ width: `${Math.min(100, usage.percent)}%` }}
            />
          </div>
          <div className="b-tnum mt-2 flex justify-between text-[11px] text-b-2">
            <span>{usage.used.toLocaleString('da-DK')} extractions brugt</span>
            <span>{usage.max.toLocaleString('da-DK')} pr. måned (Plus)</span>
          </div>
        </div>
        <PanelFooter>
          <div className="flex items-center justify-between">
            <span>
              Nulstilles første dag i næste måned · {Math.max(0, usage.max - usage.used)}{' '}
              extractions tilbage
            </span>
            <Link href="/settings/ai-usage" className="text-b-blue-fg no-underline hover:underline">
              Se detaljeret brug →
            </Link>
          </div>
        </PanelFooter>
      </Panel>

      <Panel>
        <PanelHeader title="AI-funktioner" />
        <ToggleRow
          name="Auto-extraction ved upload"
          sub="Dokumenter analyseres automatisk ved upload — kræver review"
          enabled
        />
        <ToggleRow
          name="AI Insights på selskabsdetaljer"
          sub="Renewal-risk, markedsanalyse og anbefalinger"
          enabled
        />
        <ToggleRow
          name="Sagsrisikovurdering"
          sub="AI analyserer sager og foreslår sandsynlighed for forlig"
          enabled
        />
        <PanelFooter>
          <span>AI-output kræver altid menneskelig godkendelse — toggles gemmes ikke endnu</span>
        </PanelFooter>
      </Panel>
    </>
  )
}

function ToggleRow({ name, sub, enabled }: { name: string; sub: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-b-divider px-3 py-2 last:border-b-0">
      <div className="min-w-0 pr-3">
        <div className="text-[13px] font-medium text-b-1">{name}</div>
        <div className="mt-px text-[11px] text-b-2">{sub}</div>
      </div>
      <div
        className={`relative h-4 w-7 rounded-full transition-colors ${
          enabled ? 'bg-b-blue-fg' : 'bg-b-border-strong'
        }`}
        title="Toggle er placeholder — server-state kommer senere"
      >
        <div
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            enabled ? 'left-3.5' : 'left-0.5'
          }`}
        />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function FakturaSection({ org }: { org: SettingsOrg | null }) {
  return (
    <>
      <PageHeader title="Abonnement" meta={org ? `${org.plan}-plan` : 'Ingen plan-data'} />
      <Panel>
        <PanelHeader title="Nuværende plan" />
        <KvRow label="Plan" value={<Badge tone="blue">{org?.plan ?? '—'}</Badge>} />
        <KvRow
          label="Fornyelse"
          value={
            org?.planExpiresAt ? (
              <span className="text-b-2">{org.planExpiresAt} · automatisk</span>
            ) : (
              <span className="text-b-3">Ingen fornyelsesdato</span>
            )
          }
        />
        <KvRow
          label="Oprettet"
          value={<span className="text-b-2">{org?.createdAt ?? '—'}</span>}
          isLast
        />
        <PanelFooter>
          <span>Detaljeret faktura-historik kommer i en senere version</span>
        </PanelFooter>
      </Panel>
    </>
  )
}

function ComingSoonSection({ title, sub, body }: { title: string; sub: string; body: string }) {
  return (
    <>
      <PageHeader title={title} meta={sub} />
      <Panel>
        <div className="px-3 py-8 text-center">
          <div className="text-[13px] font-medium text-b-2">Funktion under udvikling</div>
          <div className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-b-3">{body}</div>
        </div>
      </Panel>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function KvRow({
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
      className={`grid grid-cols-[140px_1fr] items-center gap-3 px-3 py-2 ${
        isLast ? '' : 'border-b border-b-divider'
      }`}
    >
      <span className="text-[11px] uppercase text-b-2" style={{ letterSpacing: '0.3px' }}>
        {label}
      </span>
      <span className="text-[13px] text-b-1">{value}</span>
    </div>
  )
}
