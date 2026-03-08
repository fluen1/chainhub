'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Mail,
  Cloud,
  CloudOff,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  User,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { checkOutlookConnection, importOutlookContacts } from '@/actions/persons'
import { OutlookContact, OutlookImportResult } from '@/types/person'

// Miljøvariabel tjek
const MICROSOFT_CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID

export function OutlookImport() {
  const router = useRouter()
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [userEmail, setUserEmail] = useState<string>()
  const [contacts, setContacts] = useState<OutlookContact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<OutlookImportResult | null>(null)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    setIsCheckingConnection(true)
    try {
      const result = await checkOutlookConnection()
      if (result.data) {
        setIsConnected(result.data.connected)
        setUserEmail(result.data.email)
      }
    } catch {
      setIsConnected(false)
    } finally {
      setIsCheckingConnection(false)
    }
  }

  // Vis opsætningsvejledning hvis Microsoft-integration ikke er konfigureret
  if (!MICROSOFT_CLIENT_ID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudOff className="h-5 w-5 text-gray-400" />
            Microsoft-integration ikke konfigureret
          </CardTitle>
          <CardDescription>
            For at importere kontakter fra Outlook skal Microsoft Graph API-integrationen
            opsættes først.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Opsætning påkrævet</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p>Følg disse trin for at konfigurere Outlook-import:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Opret en app-registrering i Azure Active Directory</li>
                <li>Tilføj Microsoft Graph API-tilladelser (Contacts.Read)</li>
                <li>Konfigurer redirect URI til din applikation</li>
                <li>
                  Tilføj følgende miljøvariabler:
                  <ul className="list-disc list-inside ml-4 mt-1 text-gray-600">
                    <li>MICROSOFT_CLIENT_ID</li>
                    <li>MICROSOFT_CLIENT_SECRET</li>
                    <li>NEXT_PUBLIC_MICROSOFT_CLIENT_ID</li>
                  </ul>
                </li>
              </ol>
              <p className="mt-4">
                <a
                  href="https://docs.microsoft.com/en-us/graph/auth-register-app-v2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Se Microsoft-dokumentation →
                </a>
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (isCheckingConnection) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-500">Tjekker forbindelse...</span>
        </CardContent>
      </Card>
    )
  }

  // Bruger ikke forbundet til Microsoft
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Forbind til Microsoft 365
          </CardTitle>
          <CardDescription>
            Log ind med din Microsoft-konto for at importere kontakter fra Outlook
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Cloud className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-center text-sm text-gray-500 max-w-md">
              Ved at forbinde din Microsoft-konto kan du importere dine Outlook-kontakter
              direkte til ChainHub. Vi læser kun dine kontakter — vi ændrer ikke noget.
            </p>
            <Button onClick={() => {
              // Her ville vi normalt starte Microsoft OAuth flow
              // For nu viser vi bare en placeholder
              toast.info('Microsoft-login ville starte her')
            }}>
              <Mail className="mr-2 h-4 w-4" />
              Log ind med Microsoft
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Simulerede kontakter til demo (erstattes med rigtig Graph API-kald)
  const loadDemoContacts = () => {
    setIsLoadingContacts(true)
    // Simuler API-kald
    setTimeout(() => {
      const demoContacts: OutlookContact[] = [
        {
          microsoftContactId: 'demo-1',
          displayName: 'Anders Andersen',
          givenName: 'Anders',
          surname: 'Andersen',
          emailAddresses: [{ address: 'anders@example.dk' }],
          mobilePhone: '+45 12 34 56 78',
        },
        {
          microsoftContactId: 'demo-2',
          displayName: 'Bente Bentsen',
          givenName: 'Bente',
          surname: 'Bentsen',
          emailAddresses: [{ address: 'bente@example.dk' }],
          businessPhones: ['+45 87 65 43 21'],
        },
        {
          microsoftContactId: 'demo-3',
          displayName: 'Carl Carlsen',
          givenName: 'Carl',
          surname: 'Carlsen',
          emailAddresses: [{ address: 'carl@example.dk' }],
        },
      ]
      setContacts(demoContacts)
      setIsLoadingContacts(false)
    }, 1000)
  }

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c.microsoftContactId)))
    }
  }

  const handleToggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId)
    } else {
      newSelected.add(contactId)
    }
    setSelectedContacts(newSelected)
  }

  const handleImport = async () => {
    if (selectedContacts.size === 0) {
      toast.error('Vælg mindst én kontakt at importere')
      return
    }

    const contactsToImport = contacts.filter((c) =>
      selectedContacts.has(c.microsoftContactId)
    )

    setIsImporting(true)
    try {
      const result = await importOutlookContacts({ contacts: contactsToImport })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setImportResult(result.data)
      if (result.data.imported > 0) {
        toast.success(`${result.data.imported} kontakter blev importeret`)
      }
    } catch {
      toast.error('Der opstod en fejl ved import')
    } finally {
      setIsImporting(false)
    }
  }

  // Vis importresultat
  if (importResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Import færdig
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-semibold text-green-700">
                {importResult.imported}
              </p>
              <p className="text-sm text-green-600">Importeret</p>
            </div>
            <div className="rounded-lg bg-yellow-50 p-4 text-center">
              <p className="text-2xl font-semibold text-yellow-700">
                {importResult.skipped}
              </p>
              <p className="text-sm text-yellow-600">Sprunget over</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-2xl font-semibold text-red-700">
                {importResult.errors.length}
              </p>
              <p className="text-sm text-red-600">Fejl</p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nogle kontakter kunne ikke importeres</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc list-inside text-sm">
                  {importResult.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button onClick={() => router.push('/persons')}>
              Gå til persondatabase
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setImportResult(null)
                setSelectedContacts(new Set())
              }}
            >
              Importér flere
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Hent kontakter view
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-green-600" />
          Forbundet til Microsoft 365
        </CardTitle>
        <CardDescription>
          {userEmail && <>Logget ind som {userEmail}</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-center text-sm text-gray-500">
              Klik nedenfor for at hente dine Outlook-kontakter
            </p>
            <Button onClick={loadDemoContacts} disabled={isLoadingContacts}>
              {isLoadingContacts ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Henter kontakter...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Hent kontakter
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedContacts.size === contacts.length}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm text-gray-600">
                  Vælg alle ({contacts.length})
                </label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDemoContacts}
                disabled={isLoadingContacts}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Opdater
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 rounded-lg border p-2">
              {contacts.map((contact) => (
                <div
                  key={contact.microsoftContactId}
                  className="flex items-center gap-3 rounded-lg p-3 hover:bg-gray-50"
                >
                  <Checkbox
                    id={contact.microsoftContactId}
                    checked={selectedContacts.has(contact.microsoftContactId)}
                    onCheckedChange={() => handleToggleContact(contact.microsoftContactId)}
                  />
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      {contact.displayName || `${contact.givenName} ${contact.surname}`}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {contact.emailAddresses?.[0]?.address || 'Ingen e-mail'}
                    </p>
                  </div>
                  {selectedContacts.has(contact.microsoftContactId) && (
                    <Check className="h-5 w-5 text-green-600" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                {selectedContacts.size} af {contacts.length} valgt
              </p>
              <Button
                onClick={handleImport}
                disabled={selectedContacts.size === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importerer...
                  </>
                ) : (
                  <>Importér {selectedContacts.size} kontakter</>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}