'use client'

import { useState } from 'react'
import { Building2, UserCircle, Bell, Plug, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------
// Role labels
// ---------------------------------------------------------------
const ROLE_LABELS: Record<string, string> = {
  GROUP_OWNER:     'Kæde-ejer',
  GROUP_ADMIN:     'Kæde-administrator',
  GROUP_LEGAL:     'Juridisk ansvarlig',
  GROUP_FINANCE:   'Finansansvarlig',
  GROUP_READONLY:  'Læseadgang (kæde)',
  COMPANY_MANAGER: 'Klinikmanager',
  COMPANY_LEGAL:   'Juridisk ansvarlig (klinik)',
  COMPANY_READONLY:'Læseadgang (klinik)',
}

// ---------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------
function ToggleSetting({
  label,
  description,
  defaultChecked = false,
}: {
  label: string
  description?: string
  defaultChecked?: boolean
}) {
  const [enabled, setEnabled] = useState(defaultChecked)

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    toast.success(`${label} ${next ? 'aktiveret' : 'deaktiveret'}`)
  }

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-slate-900">{label}</div>
        {description && <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</div>}
      </div>
      <button
        role="switch"
        type="button"
        aria-checked={enabled}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:ring-offset-2',
          enabled ? 'bg-slate-900' : 'bg-slate-200',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.15)] transition-transform',
            enabled ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------
// Section card
// ---------------------------------------------------------------
function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <header className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------
// Data row (for read-only data)
// ---------------------------------------------------------------
function DataRow({ label, value, badge }: { label: string; value: React.ReactNode; badge?: { label: string; tone: 'healthy' } }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-b-0">
      <span className="text-[12px] text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-slate-900">{value}</span>
        {badge && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
            {badge.label}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------
export default function SettingsPage() {
  const { activeUser } = usePrototype()

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[720px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Indstillinger</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Administrer organisation, roller og notifikationer
          </p>
        </div>

        <div className="space-y-4">
          {/* Organisation */}
          <SectionCard icon={Building2} title="Organisation">
            <DataRow label="Organisationsnavn" value="Tandlægegruppen A/S" />
            <DataRow label="CVR" value="12345678" />
            <DataRow label="Plan" value="Enterprise" badge={{ label: 'Aktiv', tone: 'healthy' }} />
            <div className="pt-3 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => toast.info('Rediger organisation kommer senere')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors"
              >
                Rediger organisationsoplysninger
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </SectionCard>

          {/* Rolle og adgang */}
          <SectionCard icon={UserCircle} title="Rolle og adgang">
            <DataRow label="Bruger" value={activeUser.name} />
            <DataRow label="E-mail" value={activeUser.email ?? '(ikke angivet)'} />
            <div className="flex items-start justify-between py-2 border-b border-slate-50">
              <span className="text-[12px] text-slate-500">Rolle</span>
              <div className="text-right">
                <div className="text-[13px] font-medium text-slate-900">
                  {ROLE_LABELS[activeUser.role] ?? activeUser.role}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 max-w-[260px]">
                  Rollen bestemmer hvilke moduler og selskaber du har adgang til
                </div>
              </div>
            </div>
            <div className="pt-3 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => toast.info('Brugeradministration kommer senere')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors"
              >
                Administrer brugere og roller
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </SectionCard>

          {/* Notifikationer */}
          <SectionCard icon={Bell} title="Notifikationer" description="Vælg hvad du vil adviseres om">
            <ToggleSetting
              label="Daglig e-mail digest"
              description="Modtag en daglig opsummering af kritiske items kl. 07:30"
              defaultChecked={true}
            />
            <ToggleSetting
              label="Kontrakt udløber om 90 dage"
              description="Advis når en kontrakt nærmer sig udløb"
              defaultChecked={true}
            />
            <ToggleSetting
              label="Ny sag oprettet"
              description="Advis når en ny sag oprettes i systemet"
              defaultChecked={false}
            />
            <ToggleSetting
              label="Dokument klar til gennemgang"
              description="Advis når AI-analyse er fuldført og dokumentet afventer review"
              defaultChecked={true}
            />
            <ToggleSetting
              label="Forfaldne opgaver"
              description="Daglig påmindelse om opgaver der er overskredet forfaldsdato"
              defaultChecked={true}
            />
            <ToggleSetting
              label="Finansielt underskud registreret"
              description="Advis ved negativ EBITDA i seneste kvartalsrapport"
              defaultChecked={false}
            />
          </SectionCard>

          {/* Integrationer */}
          <SectionCard icon={Plug} title="Integrationer" description="Tilslut eksterne systemer">
            <ToggleSetting
              label="CVR-opslag (Virk)"
              description="Automatisk synkronisering af CVR-data fra Erhvervsstyrelsen"
              defaultChecked={true}
            />
            <ToggleSetting
              label="E-conomic (bogføring)"
              description="Importer regnskabsdata automatisk fra E-conomic"
              defaultChecked={false}
            />
            <ToggleSetting
              label="Outlook-kalender"
              description="Synkroniser tilsynsbesøg og møder med din kalender"
              defaultChecked={false}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
