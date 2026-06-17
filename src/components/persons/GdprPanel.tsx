'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { prepareGdprExport, executeGdprDelete } from '@/actions/gdpr'
import { AccessibleDialog } from '@/components/ui/accessible-dialog'

// ─────────────────────────────────────────────────────────────────────────────
// GdprPanel — GDPR Art. 15 eksport + Art. 17 sletning.
// Admin-only (rendres KUN hvis isAdmin=true fra page.tsx).
// Amber-bordered panel med bekræftelsesdialog for sletning.
// ─────────────────────────────────────────────────────────────────────────────

interface GdprPanelProps {
  personId: string
  personFullName: string
  isAdmin: boolean
}

export function GdprPanel({ personId, personFullName, isAdmin }: GdprPanelProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [exporting, startExport] = useTransition()
  const [deleting, startDelete] = useTransition()

  // Admin-guard — panel rendres slet ikke til ikke-admins
  if (!isAdmin) return null

  function handleExport() {
    startExport(async () => {
      const result = await prepareGdprExport(personId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      // Trigger browser-download via URL
      window.location.href = result.data.downloadUrl
      toast.success('GDPR-eksport klargjort — download starter nu')
    })
  }

  function handleDeleteConfirm() {
    startDelete(async () => {
      const result = await executeGdprDelete(personId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Persondata er slettet permanent')
      setDeleteOpen(false)
      router.push('/persons')
    })
  }

  const nameMatches = confirmName.trim() === personFullName.trim()

  return (
    <>
      {/* Amber-bordered GDPR-panel */}
      <div className="rounded-[6px] border border-amber-300 bg-amber-50 px-4 py-3">
        <div className="mb-2.5 flex items-center gap-2">
          <span
            className="text-[12px] font-semibold uppercase text-amber-700"
            style={{ letterSpacing: '0.4px' }}
          >
            GDPR — Persondata
          </span>
          <span className="rounded-[3px] bg-amber-200 px-1.5 py-px text-[10px] font-medium text-amber-800">
            Admin
          </span>
        </div>
        <p className="mb-3 text-[12px] text-amber-700">
          Som administrator kan du eksportere eller permanent slette persondata i henhold til GDPR.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-amber-400 bg-white px-3 py-1.5 text-[12px] font-medium text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? 'Forbereder...' : 'Eksportér persondata (GDPR)'}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmName('')
              setDeleteOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-red-400 bg-white px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-50"
          >
            Slet persondata permanent
          </button>
        </div>
      </div>

      {/* Bekræftelsesdialog — kræver navn-indskrivning */}
      <AccessibleDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Slet persondata permanent"
        titleId="gdpr-delete-dialog-title"
        className="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div
            role="alert"
            className="rounded-[4px] border border-red-200 bg-red-50 p-3 text-[12px] text-red-700"
          >
            <strong>Advarsel: Denne handling kan ikke fortrydes.</strong> Al persondata
            pseudonymiseres og alle relationer afregistreres permanent (GDPR Art. 17). Audit-loggen
            bevares af juridiske hensyn.
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="gdpr-confirm-name"
              className="text-[11px] font-semibold uppercase text-gray-500"
              style={{ letterSpacing: '0.4px' }}
            >
              Bekræft ved at skrive personens fulde navn
            </label>
            <input
              id="gdpr-confirm-name"
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={personFullName}
              className="rounded-[4px] border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline focus:outline-2 focus:outline-red-500 focus:outline-offset-[-1px]"
            />
            {confirmName.length > 0 && !nameMatches && (
              <p className="text-[11px] text-red-600">
                Navnet matcher ikke — skriv nøjagtigt: {personFullName}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="rounded-[4px] border border-gray-300 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Annuller
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={!nameMatches || deleting}
              className="rounded-[4px] border border-red-600 bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:border-red-300 disabled:bg-red-300"
            >
              {deleting ? 'Sletter...' : 'Slet permanent'}
            </button>
          </div>
        </div>
      </AccessibleDialog>
    </>
  )
}
