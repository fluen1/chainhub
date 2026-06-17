'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CookieWithdrawPanel } from '@/components/settings/CookieWithdrawPanel'
import { CreateUserForm } from '@/components/settings/CreateUserForm'
import { OrganizationForm } from '@/components/settings/organization-form'
import { UserActions } from '@/components/settings/UserActions'
import {
  Breadcrumb,
  PageHeader,
  Panel,
  PanelHeader,
  PanelFooter,
  Badge,
  type BadgeTone,
  BottomBar,
} from '@/components/ui/b'

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
  /** "Aldrig" for nye brugere, formateret dato ellers */
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
  aiUsage: {
    used: number
    max: number
    percent: number
    threshold?: 'none' | '50-info' | '75-warn' | '90-alert' | 'exceeded'
    capUsd?: number
    currentUsd?: number
  }
}) {
  const sectionLabel = SECTIONS.find((s) => s.key === section)?.label ?? ''

  return (
    <>
      <Breadcrumb trail={[{ label: 'Indstillinger', href: '/settings' }]} current={sectionLabel} />

      <div className="grid gap-3 md:grid-cols-[180px_1fr] lg:items-start">
        <SectionNav active={section} />

        <div className="flex min-w-0 flex-col gap-3">
          {!canManage ? (
            <NoAccessPanel />
          ) : section === 'org' && organization ? (
            <OrgSection org={organization} />
          ) : section === 'brugere' ? (
            <BrugereSection users={users} companies={companies} />
          ) : section === 'ai' ? (
            <AISection usage={aiUsage} />
          ) : section === 'notif' ? (
            <NotifikationerSection />
          ) : section === 'integr' ? (
            <IntegrationerSection />
          ) : section === 'sikkerhed' ? (
            <SikkerhedSection />
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
      <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-b-2">
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

function AISection({
  usage,
}: {
  usage: {
    used: number
    max: number
    percent: number
    threshold?: 'none' | '50-info' | '75-warn' | '90-alert' | 'exceeded'
    capUsd?: number
    currentUsd?: number
  }
}) {
  // Tærskler matcher cost-cap spec: none / 50-info / 75-warn / 90-alert / exceeded
  const fillTone =
    usage.percent >= 90
      ? 'bg-b-red-fg'
      : usage.percent >= 75
        ? 'bg-b-amber-fg'
        : usage.percent >= 50
          ? 'bg-b-amber-fg'
          : 'bg-b-green-fg'
  const pctColor =
    usage.percent >= 90
      ? 'text-b-red-fg'
      : usage.percent >= 75
        ? 'text-b-amber-fg'
        : usage.percent >= 50
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
            <span>{usage.used.toLocaleString('da-DK')} analyser brugt</span>
            <span>{usage.max.toLocaleString('da-DK')} pr. måned</span>
          </div>
          {usage.threshold && usage.threshold !== 'none' && (
            <div
              className={`mt-2 rounded-[4px] px-2.5 py-1.5 text-[11px] ${
                usage.threshold === 'exceeded' || usage.threshold === '90-alert'
                  ? 'bg-b-red-bg text-b-red-fg'
                  : 'bg-b-amber-bg text-b-amber-fg'
              }`}
            >
              {usage.threshold === 'exceeded'
                ? 'Månedlig kvota er nået — nye AI-analyser er blokeret. Kontakt support.'
                : usage.threshold === '90-alert'
                  ? `90% af kvota brugt (AI-omkostning: $${usage.currentUsd?.toFixed(2) ?? '—'} / $${usage.capUsd?.toFixed(0) ?? '—'}).`
                  : `${usage.threshold === '75-warn' ? '75' : '50'}% af kvota nået (AI-omkostning: $${usage.currentUsd?.toFixed(2) ?? '—'} brugt).`}
            </div>
          )}
        </div>
        <PanelFooter>
          <div className="flex items-center justify-between">
            <span>
              Nulstilles første dag i næste måned · {Math.max(0, usage.max - usage.used)} analyser
              tilbage
            </span>
            <Link href="/settings/ai-usage" className="text-b-blue-fg no-underline hover:underline">
              Se detaljeret brug →
            </Link>
          </div>
        </PanelFooter>
      </Panel>

      <Panel>
        <PanelHeader title="AI-funktioner" />
        <div className="px-3 py-3">
          <p className="text-[13px] text-b-2">
            AI-funktioner er aktiveret globalt for jeres abonnement. Kontakt support for at
            deaktivere specifikke funktioner.
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-b-3">
            <li>· Auto-analyse ved dokumentupload (kræver review)</li>
            <li>· AI-insights på selskabsdetaljer (fornyelsesrisiko, markedsanalyse)</li>
            <li>· Sagsrisikovurdering (sandsynlighed for forlig)</li>
          </ul>
        </div>
        <PanelFooter>
          <span>AI-output kræver altid menneskelig godkendelse</span>
        </PanelFooter>
      </Panel>
    </>
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
          <Link
            href="/billing"
            className="inline-flex items-center rounded-md bg-b-accent px-4 py-2 text-sm font-medium text-white hover:bg-b-accent/90"
          >
            Gå til abonnement
          </Link>
        </PanelFooter>
      </Panel>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Stub-sektioner — under udvikling, men med konkrete roadmap-punkter
// ────────────────────────────────────────────────────────────────────────────

function NotifikationerSection() {
  return (
    <>
      <PageHeader title="Notifikationer" meta="E-mail og push-notifikationer" />
      <Panel>
        <PanelHeader title="Under udvikling" />
        <div className="px-3 py-3">
          <p className="text-[12px] text-b-3">
            Notifikationssystemet er under udvikling. Planlagte funktioner:
          </p>
          <ul className="mt-2 space-y-1.5 text-[12px] text-b-3">
            <li>
              <span className="font-medium text-b-2">E-mail-digest</span> — daglig eller ugentlig
              opsummering af udløbende kontrakter og åbne sager
            </li>
            <li>
              <span className="font-medium text-b-2">Push-notifikationer</span> — browser-
              notifikationer ved kontraktudløb, sagsfrister og AI-review-klar
            </li>
            <li>
              <span className="font-medium text-b-2">Slack-integration</span> — besked til kanal ved
              kritiske hændelser (cap nået, sag eskaleret)
            </li>
            <li>
              <span className="font-medium text-b-2">Pr. bruger konfiguration</span> — hver bruger
              vælger hvilke hændelser der notificeres
            </li>
          </ul>
        </div>
        <PanelFooter>
          <span>Kontakt support for at prioritere specifikke notifikationstyper</span>
        </PanelFooter>
      </Panel>
    </>
  )
}

function IntegrationerSection() {
  return (
    <>
      <PageHeader title="Integrationer" meta="E-conomic, Slack, Microsoft 365 mfl." />
      <Panel>
        <PanelHeader title="Under udvikling" />
        <div className="px-3 py-3">
          <p className="text-[12px] text-b-3">
            Integrationskonfiguration kommer når de respektive klienter er tilgængelige. Planlagte
            integrationer:
          </p>
          <ul className="mt-2 space-y-1.5 text-[12px] text-b-3">
            <li>
              <span className="font-medium text-b-2">E-conomic</span> — synkroniser faktura-data og
              selskabsøkonomi direkte til ChainHub
            </li>
            <li>
              <span className="font-medium text-b-2">Microsoft 365</span> — hent kontrakter fra
              SharePoint, kalendersynk, Teams-notifikationer
            </li>
            <li>
              <span className="font-medium text-b-2">Slack</span> — tovejs notifikationer og
              godkendelsesflow direkte i Slack
            </li>
            <li>
              <span className="font-medium text-b-2">Zapier / Make</span> — no-code automatisering
              til eksisterende workflows
            </li>
          </ul>
        </div>
        <PanelFooter>
          <span>Kontakt support for at anmode om specifik integration</span>
        </PanelFooter>
      </Panel>
    </>
  )
}

function SikkerhedSection() {
  return (
    <>
      <PageHeader title="Sikkerhed" meta="2FA, session-timeout, audit log" />
      <CookieWithdrawPanel />
      <Panel>
        <PanelHeader title="Under udvikling" />
        <div className="px-3 py-3">
          <p className="text-[12px] text-b-3">
            Sikkerhedsindstillinger er under udvikling. Audit log gemmes løbende og kan eksporteres
            på forespørgsel. Planlagte funktioner:
          </p>
          <ul className="mt-2 space-y-1.5 text-[12px] text-b-3">
            <li>
              <span className="font-medium text-b-2">To-faktor autentifikation (2FA)</span> — TOTP
              via autentifikator-app for alle brugere
            </li>
            <li>
              <span className="font-medium text-b-2">SSO via SAML 2.0</span> — log ind med Microsoft
              Entra ID, Okta eller anden identity provider
            </li>
            <li>
              <span className="font-medium text-b-2">Session-timeout</span> — konfigurér automatisk
              logout efter X minutters inaktivitet
            </li>
            <li>
              <span className="font-medium text-b-2">Audit log export</span> — hent CSV-log over
              alle brugerhandlinger (hvem, hvad, hvornår)
            </li>
          </ul>
        </div>
        <PanelFooter>
          <span>Audit log er tilgængelig i databasen og kan udtrækkes på forespørgsel</span>
        </PanelFooter>
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
      <span className="text-[11px] uppercase tracking-[0.3px] text-b-2">{label}</span>
      <span className="text-[13px] text-b-1">{value}</span>
    </div>
  )
}
