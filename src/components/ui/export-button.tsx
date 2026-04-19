'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { prepareExport } from '@/actions/export'
import type { ExportableEntity } from '@/lib/export/entities'

interface Props {
  entity: ExportableEntity
  label?: string
}

/**
 * Genbrugelig CSV-eksport-knap.
 *
 * Flow:
 * 1. Bruger klikker
 * 2. `prepareExport` action kaldes — validerer session + admin + skriver audit-log
 * 3. Ved success: browser navigerer til download-URL (fil-download starter)
 * 4. Ved fejl: toast med handlingsanvisende dansk besked
 */
export function ExportButton({ entity, label = 'Eksportér CSV' }: Props) {
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)
    try {
      const res = await prepareExport({ entity })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      // Naviger til download-URL — browseren håndterer Content-Disposition: attachment
      window.location.href = res.data.downloadUrl
    } catch {
      toast.error('Eksport kunne ikke forberedes')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-slate-700 text-[12px] font-medium ring-1 ring-slate-900/[0.08] hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)] disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Download className="w-3.5 h-3.5" />
      {isPending ? 'Forbereder...' : label}
    </button>
  )
}
