'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importOutlookContacts } from '@/actions/persons'
import { toast } from 'sonner'
import type { OutlookContact } from '@/types/person'

const MICROSOFT_CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID

const GRAPH_SCOPES = ['Contacts.Read', 'User.Read']

type ImportStep = 'idle' | 'connecting' | 'selecting' | 'importing' | 'done'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export default function OutlookImport() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<ImportStep>('idle')
  const [contacts, setContacts] = useState<OutlookContact[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const hasClientId = Boolean(MICROSOFT_CLIENT_ID)

  const handleConnect = async () => {
    if (!hasClientId) return

    setStep('connecting')
    setError(null)

    try {
      // Microsoft Graph authentication via MSAL popup
      const { PublicClientApplication } = await import('@azure/msal-browser')

      const msalConfig = {
        auth: {
          clientId: MICROSOFT_CLIENT_ID!,
          authority: 'https://login.microsoftonline.com/common',
          redirectUri: window.location.origin,
        },
      }

      const msalInstance = new PublicClientApplication(msalConfig)
      await msalInstance.initialize()

      const tokenResponse = await msalInstance.acquireTokenPopup({
        scopes: GRAPH_SCOPES,
      })

      const accessToken = tokenResponse.accessToken

      // Hent kontakter fra Microsoft Graph
      const response = await fetch(
        'https://graph.microsoft.com/v1.0/me/contacts?$select=id,givenName,surname,emailAddresses,mobilePhone,businessPhones,displayName&$top=100',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error('Kunne ikke hente kontakter fra Outlook')
      }

      const data = await response.json()
      const fetchedContacts: OutlookContact[] = data.value ?? []

      setContacts(fetchedContacts)
      setSelected(new Set())
      setStep('selecting')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Forbindelsen til Outlook mislykkedes'
      setError(message)
      setStep('idle')
    }
  }

  const handleToggleContact = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map((c) => c.id)))
    }
  }

  const handleImport = () => {
    if (selected.size === 0) {
      toast.error('Vælg mindst én kontakt at importere')
      return
    }

    const selectedContacts = contacts.filter((c) => selected.has(c.id))

    const importPayload = selectedContacts.map((c) => ({
      microsoftContactId: c.id,
      firstName: c.givenName || c.displayName.split(' ')[0] || 'Ukendt',
      lastName:
        c.surname ||
        c.displayName.split(' ').slice(1).join(' ') ||
        '',
      email: c.emailAddresses[0]?.address || '',
      phone: c.mobilePhone || c.businessPhones[0] || '',
    }))

    setStep('importing')
    startTransition(async () => {
      const result = await importOutlookContacts({ contacts: importPayload })
      if (result.error) {
        toast.error(result.error)
        setStep('selecting')
      } else {
        setResult(result.data)
        setStep('done')
        router.refresh()
      }
    })
  }

  const handleClose = () => {
    setIsOpen(false)
    setStep('idle')
    setContacts([])
    setSelected(new Set())
    setResult(null)
    setError(null)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <OutlookIcon />
        <span>Importér fra Outlook</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <OutlookIcon className="h-6 w-6" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Importér fra Outlook
                  </h2>
                  <p className="text-xs text-gray-500">
                    Via Microsoft Graph API
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              {/* Ikke konfigureret */}
              {!hasClientId && (
                <SetupGuide />
              )}

              {/* Idle — konfigureret */}
              {hasClientId && step === 'idle' && (
                <div className="space-y-4 text-center py-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                    <OutlookIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      Forbind til din Outlook-konto
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Vi henter dine kontakter via Microsoft Graph API.
                      Du skal logge ind med din Microsoft-konto.
                    </p>
                  </div>
                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handleConnect}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Forbind til Microsoft
                  </button>
                </div>
              )}

              {/* Forbinder */}
              {hasClientId && step === 'connecting' && (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                  <p className="text-sm text-gray-500">
                    Forbinder til Microsoft...
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Et login-vindue åbnes om et øjeblik
                  </p>
                </div>
              )}

              {/* Vælg kontakter */}
              {hasClientId && step === 'selecting' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{contacts.length}</span>{' '}
                      kontakter fundet i Outlook
                    </p>
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {selected.size === contacts.length
                        ? 'Fravælg alle'
                        : 'Vælg alle'}
                    </button>
                  </div>

                  {contacts.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 py-8 text-center">
                      <p className="text-sm text-gray-500">
                        Ingen kontakter fundet i din Outlook-konto
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
                      {contacts.map((contact) => (
                        <label
                          key={contact.id}
                          className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(contact.id)}
                            onChange={() => handleToggleContact(contact.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {contact.displayName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {contact.emailAddresses[0]?.address ?? ''}
                              {contact.mobilePhone
                                ? ` · ${contact.mobilePhone}`
                                : ''}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-400">
                    {selected.size} af {contacts.length} kontakter valgt
                  </p>
                </div>
              )}

              {/* Importerer */}
              {hasClientId && step === 'importing' && (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                  <p className="text-sm text-gray-500">
                    Importerer {selected.size} kontakter...
                  </p>
                </div>
              )}

              {/* Resultat */}
              {hasClientId && step === 'done' && result && (
                <div className="space-y-4 py-4">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <h3 className="font-medium text-green-900">
                      Import fuldført
                    </h3>
                    <div className="mt-2 space-y-1 text-sm text-green-700">
                      <p>✅ {result.imported} kontakter importeret</p>
                      {result.skipped > 0 && (
                        <p>⏭️ {result.skipped} sprunget over (eksisterer allerede)</p>
                      )}
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                      <h4 className="text-sm font-medium text-yellow-900">
                        Advarsler ({result.errors.length})
                      </h4>
                      <ul className="mt-2 space-y-1 text-xs text-yellow-700">
                        {result.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              {step === 'selecting' && (
                <>
                  <button
                    onClick={() => setStep('idle')}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Tilbage
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={selected.size === 0 || isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Importér {selected.size > 0 ? `(${selected.size})` : ''}
                  </button>
                </>
              )}
              {(step === 'idle' || step === 'done' || !hasClientId) && (
                <button
                  onClick={handleClose}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {step === 'done' ? 'Luk' : 'Annuller'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ==================== SUBKOMPONENTER ====================

function OutlookIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="4" fill="#0078D4" />
      <path
        d="M13 6h7v12h-7V6zm1 1v10h5V7h-5z"
        fill="white"
        fillOpacity="0.9"
      />
      <path
        d="M4 8.5C4 7.12 5.12 6 6.5 6h3C10.88 6 12 7.12 12 8.5v7c0 1.38-1.12 2.5-2.5 2.5h-3C5.12 18 4 16.88 4 15.5v-7z"
        fill="white"
      />
      <text
        x="8"
        y="14"
        textAnchor="middle"
        fontSize="7"
        fontWeight="bold"
        fill="#0078D4"
        fontFamily="Arial"
      >
        O
      </text>
    </svg>
  )
}

function SetupGuide() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h3 className="font-medium text-yellow-900">
              Outlook-integration ikke konfigureret
            </h3>
            <p className="mt-1 text-sm text-yellow-700">
              <code className="rounded bg-yellow-100 px-1 py-0.5 font-mono text-xs">
                NEXT_PUBLIC_MICROSOFT_CLIENT_ID
              </code>{' '}
              er ikke sat. Følg vejledningen nedenfor for at aktivere
              Outlook-import.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="text-sm font-semibold text-gray-900">
          Opsætningsvejledning
        </h4>

        <ol className="space-y-3 text-sm text-gray-700">
          <li className="flex gap-2">
            <span className="flex-shrink-0 font-medium text-blue-600">1.</span>
            <span>
              Gå til{' '}
              <a
                href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Azure Portal → App registrations
              </a>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 font-medium text-blue-600">2.</span>
            <span>
              Klik <strong>New registration</strong> og angiv et navn (fx
              &quot;ChainHub&quot;)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 font-medium text-blue-600">3.</span>
            <span>
              Under <strong>Supported account types</strong> vælges{' '}
              <em>Accounts in any organizational directory and personal Microsoft accounts</em>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 font-medium text-blue-600">4.</span>
            <span>
              Tilføj Redirect URI:{' '}
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs">
                {typeof window !== 'undefined'
                  ? window.location.origin
                  : 'https://din-app.dk'}
              </code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 font-medium text-blue-600">5.</span>
            <span>
              Under <strong>API permissions</strong> tilføjes:{' '}
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs">
                Contacts.Read
              </code>{' '}
              og{' '}
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs">
                User.Read
              </code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 font-medium text-blue-600">6.</span>
            <span>
              Kopiér <strong>Application (client) ID</strong> og tilføj til{' '}
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs">
                .env.local
              </code>
              :
            </span>
          </li>
        </ol>

        <div className="rounded-lg border border-gray-300 bg-white p-3 font-mono text-xs text-gray-800">
          NEXT_PUBLIC_MICROSOFT_CLIENT_ID=din-client-id-her
        </div>

        <p className="text-xs text-gray-500">
          Genstart Next.js-serveren efter at have tilføjet miljøvariablen.
          Kontakt{' '}
          <a href="mailto:support@chainhub.dk" className="text-blue-600 hover:underline">
            support@chainhub.dk
          </a>{' '}
          hvis du har brug for hjælp.
        </p>
      </div>
    </div>
  )
}