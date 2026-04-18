'use client'

import { useState } from 'react'
import { updateVisit } from '@/actions/visits'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

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
    <div className="rounded-lg border bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Noter</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        placeholder="Tilføj noter..."
      />

      {showSummary && (
        <>
          <h2 className="text-base font-semibold text-gray-900 pt-2">Opsummering</h2>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Opsummering af besøget..."
          />
        </>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Gemmer...' : 'Gem'}
        </button>
      </div>
    </div>
  )
}
