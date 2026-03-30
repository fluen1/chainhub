'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { usePrototype } from '@/components/prototype/PrototypeProvider'

interface ToggleProps {
  label: string
  description?: string
  defaultChecked?: boolean
}

function ToggleSetting({ label, description, defaultChecked = false }: ToggleProps) {
  const [enabled, setEnabled] = useState(defaultChecked)

  const handleToggle = () => {
    const next = !enabled
    setEnabled(next)
    toast.success(`"${label}" ${next ? 'aktiveret' : 'deaktiveret'} (simuleret)`)
  }

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 ${
          enabled ? 'bg-gray-900' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = {
  GROUP_OWNER: 'Kæde-ejer',
  GROUP_ADMIN: 'Kæde-administrator',
  GROUP_LEGAL: 'Juridisk ansvarlig',
  GROUP_FINANCE: 'Finansansvarlig',
  GROUP_READONLY: 'Læseadgang (kæde)',
  COMPANY_MANAGER: 'Klinikmanager',
  COMPANY_LEGAL: 'Juridisk ansvarlig (klinik)',
  COMPANY_READONLY: 'Læseadgang (klinik)',
}

export default function PrototypeSettingsPage() {
  const { activeUser } = usePrototype()

  return (
    <div className="max-w-2xl space-y-8">
      <div className="border-b border-gray-200/60 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Indstillinger</h1>
        <p className="mt-1 text-sm text-gray-500">Administrer organisation, roller og notifikationer</p>
      </div>

      {/* Organisation */}
      <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Organisation</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500">Organisationsnavn</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">Tandlægegruppen A/S</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">CVR</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">12345678</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Plan</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              Enterprise
              <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Aktiv
              </span>
            </p>
          </div>
          <button
            onClick={() => toast.info('Rediger organisation ikke tilgængeligt i prototypen')}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Rediger organisationsoplysninger →
          </button>
        </div>
      </section>

      {/* Rolle og adgang */}
      <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Rolle og adgang</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500">Bruger</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{activeUser.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">E-mail</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{activeUser.email ?? '(ikke angivet)'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Rolle</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              {ROLE_LABELS[activeUser.role] ?? activeUser.role}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Rollen bestemmer hvilke moduler og selskaber du har adgang til.
            </p>
          </div>
          <button
            onClick={() => toast.info('Brugeradministration ikke tilgængeligt i prototypen')}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Administrer brugere og roller →
          </button>
        </div>
      </section>

      {/* Notifikationer */}
      <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Notifikationer</h2>
          <p className="text-xs text-gray-500 mt-0.5">Vælg hvad du vil adviseres om</p>
        </div>
        <div className="px-5">
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
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Integrationer</h2>
          <p className="text-xs text-gray-500 mt-0.5">Tilslut eksterne systemer</p>
        </div>
        <div className="px-5">
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
        </div>
      </section>
    </div>
  )
}
