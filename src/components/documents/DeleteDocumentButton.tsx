'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { AccessibleDialog } from '@/components/ui/accessible-dialog'
import { deleteDocument } from '@/actions/documents'

interface Props {
  documentId: string
  fileName: string
  /** Vis advarsel hvis dokumentet er tilknyttet en kontrakt */
  contractName?: string | null
  /** Vis advarsel hvis dokumentet er tilknyttet en sag */
  caseName?: string | null
  /** Css-klasse på trigger-knappen */
  className?: string
  /** Variant: 'icon' = kun trash-ikon, 'full' = ikon + tekst */
  variant?: 'icon' | 'full'
}

/**
 * DeleteDocumentButton — åbner bekræftelsesdialog og kalder deleteDocument action.
 *
 * Bruger AccessibleDialog (focus-trap, Escape-close, backdrop-close).
 * Viser ekstra advarsel hvis dokumentet er tilknyttet kontrakt/sag.
 */
export function DeleteDocumentButton({
  documentId,
  fileName,
  contractName,
  caseName,
  className,
  variant = 'icon',
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteDocument(documentId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Dokument slettet')
      setOpen(false)
      router.refresh()
    })
  }

  const hasTilknytning = Boolean(contractName || caseName)

  return (
    <>
      <button
        type="button"
        title="Slet dokument"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={
          className ??
          'flex items-center gap-1.5 rounded px-2 py-1 text-[12px] font-medium text-b-3 hover:bg-red-50 hover:text-red-600 transition-colors'
        }
      >
        <Trash2 className="h-3.5 w-3.5 shrink-0" />
        {variant === 'full' && <span>Slet</span>}
      </button>

      <AccessibleDialog
        open={open}
        onClose={() => !isPending && setOpen(false)}
        title={`Slet dokument`}
        titleId="delete-doc-dialog-title"
        className="max-w-md"
      >
        <p className="text-[13px] text-slate-700 mb-1">
          Er du sikker på, at du vil slette{' '}
          <span className="font-semibold">&ldquo;{fileName}&rdquo;</span>?
        </p>
        <p className="text-[12px] text-slate-400 mb-4">
          Dokumentet flyttes til arkiv (soft-delete) og kan ikke gendannes via UI.
        </p>

        {hasTilknytning && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
            <span className="font-semibold">OBS:</span> Dette dokument er tilknyttet{' '}
            {contractName ? (
              <>
                kontrakten <span className="font-medium">{contractName}</span>
              </>
            ) : (
              <>
                sagen <span className="font-medium">{caseName}</span>
              </>
            )}
            . Tilknytningen bevares i arkivet, men dokumentet vil ikke være synligt i listerne.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Annullér
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Sletter...' : 'Slet dokument'}
          </button>
        </div>
      </AccessibleDialog>
    </>
  )
}
