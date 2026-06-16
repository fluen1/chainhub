'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { updateVisit } from '@/actions/visits'
import { Panel, PanelHeader, BButton, AlertBar } from '@/components/ui/b'
import { VISIT_STATUS_LABELS } from '@/lib/labels'

// ─────────────────────────────────────────────────────────────────────────────
// VisitStatusForm — B-stil port.
// - PLANLAGT: vis knapper til GENNEMFOERT / AFLYST
// - GENNEMFOERT / AFLYST: vis info-tekst + "Genåbn besøg"-knap (kun owners)
// ─────────────────────────────────────────────────────────────────────────────

interface VisitStatusFormProps {
  visitId: string
  currentStatus: string
  /** Kun GROUP_OWNER / GROUP_ADMIN kan genåbne afsluttede besøg */
  canReopen?: boolean
}

export function VisitStatusForm({
  visitId,
  currentStatus,
  canReopen = false,
}: VisitStatusFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleUpdate(newStatus: string) {
    setLoading(true)

    const result = await updateVisit({
      visitId,
      status: newStatus as 'PLANLAGT' | 'GENNEMFOERT' | 'AFLYST',
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(`Status ændret til ${VISIT_STATUS_LABELS[newStatus] ?? newStatus}`)
    router.refresh()
  }

  if (currentStatus === 'PLANLAGT') {
    return (
      <Panel>
        <PanelHeader title="Opdatér status" />
        <div className="flex flex-col gap-2 px-4 py-3">
          <p className="text-[12px] text-b-2">
            Nuværende:{' '}
            <span className="font-medium text-b-1">
              {VISIT_STATUS_LABELS[currentStatus] ?? currentStatus}
            </span>
          </p>
          <div className="flex flex-col gap-1.5">
            <BButton primary onClick={() => handleUpdate('GENNEMFOERT')} disabled={loading}>
              {loading ? 'Opdaterer...' : 'Markér som gennemført'}
            </BButton>
            <BButton onClick={() => handleUpdate('AFLYST')} disabled={loading}>
              {loading ? 'Opdaterer...' : 'Aflys besøg'}
            </BButton>
          </div>
        </div>
      </Panel>
    )
  }

  // GENNEMFOERT eller AFLYST
  return (
    <Panel>
      <PanelHeader title="Status" />
      <div className="flex flex-col gap-2 px-4 py-3">
        <AlertBar tone={currentStatus === 'GENNEMFOERT' ? 'blue' : 'amber'}>
          {currentStatus === 'GENNEMFOERT'
            ? 'Besøget er gennemført og lukket.'
            : 'Besøget er aflyst.'}
        </AlertBar>
        {canReopen && (
          <BButton onClick={() => handleUpdate('PLANLAGT')} disabled={loading}>
            {loading ? 'Opdaterer...' : 'Genåbn besøg'}
          </BButton>
        )}
      </div>
    </Panel>
  )
}
