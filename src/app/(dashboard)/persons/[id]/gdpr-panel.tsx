'use client'

import { useState } from 'react'
import { ShieldAlert, Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { prepareGdprExport, executeGdprDelete } from '@/actions/gdpr'
import { AccessibleDialog } from '@/components/ui/accessible-dialog'

interface Props {
  personId: string
  personName: string
}

export function GdprPanel({ personId, personName }: Props) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    const result = await prepareGdprExport(personId)
    setBusy(false)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    if (result.data) {
      window.location.href = result.data.downloadUrl
    }
  }

  async function handleDelete() {
    if (confirmText !== personName) {
      toast.error('Navn matcher ikke — kunne ikke slette')
      return
    }
    setBusy(true)
    const result = await executeGdprDelete(personId)
    setBusy(false)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    setDeleteOpen(false)
    if (result.data) {
      toast.success(`Persondata slettet (${result.data.total} relations berørt)`)
    } else {
      toast.success('Persondata slettet')
    }
    router.push('/persons')
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" aria-hidden />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">GDPR-handlinger</h3>
          <p className="text-sm text-gray-600 mt-1">
            Kun admin. Handlinger er audit-loggede og uomkørbare.
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Eksportér persondata (Art. 15)
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Slet persondata (Art. 17)
            </button>
          </div>
        </div>
      </div>

      <AccessibleDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
          setConfirmText('')
        }}
        title="Slet persondata — GDPR Art. 17"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Du er ved at pseudonymisere og slette persondata for <strong>{personName}</strong>.
            Personen pseudonymiseres til &quot;Slettet person&quot;, og alle tilknytninger
            (ansættelser, ejerskaber, kontrakt-parter, sags-parter) nedlægges eller slettes.
          </p>
          <p className="text-sm text-gray-700">Skriv personens navn for at bekræfte:</p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder={personName}
            aria-label="Bekræft navn"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false)
                setConfirmText('')
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Annullér
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || confirmText !== personName}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Sletter...' : 'Slet permanent'}
            </button>
          </div>
        </div>
      </AccessibleDialog>
    </div>
  )
}
