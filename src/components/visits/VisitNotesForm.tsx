'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { updateVisit } from '@/actions/visits'
import { Panel, PanelHeader, BButton, BTextareaField } from '@/components/ui/b'

// ─────────────────────────────────────────────────────────────────────────────
// VisitNotesForm — B-stil port. Inline noter + opsummering (hvis GENNEMFOERT).
// ─────────────────────────────────────────────────────────────────────────────

interface VisitNotesFormProps {
  visitId: string
  initialNotes: string
  initialSummary: string
  showSummary: boolean
}

export function VisitNotesForm({
  visitId,
  initialNotes,
  initialSummary,
  showSummary,
}: VisitNotesFormProps) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes)
  const [summary, setSummary] = useState(initialSummary)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)

    const result = await updateVisit({
      visitId,
      notes,
      ...(showSummary ? { summary } : {}),
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Besøg opdateret')
    router.refresh()
  }

  return (
    <Panel>
      <PanelHeader title="Noter" />
      <div className="flex flex-col gap-3.5 px-4 py-4">
        <BTextareaField
          label="Feltnoter"
          value={notes}
          onChange={setNotes}
          placeholder="Tilføj noter..."
          rows={4}
          disabled={loading}
        />

        {showSummary && (
          <BTextareaField
            label="Opsummering"
            value={summary}
            onChange={setSummary}
            placeholder="Opsummering af besøget..."
            rows={4}
            disabled={loading}
          />
        )}

        <div className="flex justify-end">
          <BButton primary onClick={handleSave} disabled={loading}>
            {loading ? 'Gemmer...' : 'Gem noter'}
          </BButton>
        </div>
      </div>
    </Panel>
  )
}
