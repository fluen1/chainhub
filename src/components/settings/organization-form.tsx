'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateOrganization } from '@/actions/organizations'

interface OrganizationFormProps {
  initialName: string
  initialCvr: string | null
  initialChainStructure: boolean
}

export function OrganizationForm({
  initialName,
  initialCvr,
  initialChainStructure,
}: OrganizationFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(initialName)
  const [cvr, setCvr] = useState(initialCvr ?? '')
  const [chainStructure, setChainStructure] = useState(initialChainStructure)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const result = await updateOrganization({
      name: name.trim(),
      cvr: cvr.trim(),
      chain_structure: chainStructure,
    })

    setSaving(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Organisation opdateret')
    router.refresh()
  }

  const isDirty =
    name.trim() !== initialName ||
    cvr.trim() !== (initialCvr ?? '') ||
    chainStructure !== initialChainStructure

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Navn</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            CVR <span className="text-slate-400">(8 cifre, valgfri)</span>
          </span>
          <input
            type="text"
            value={cvr}
            onChange={(e) => setCvr(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
            inputMode="numeric"
            pattern="\d{8}"
            placeholder="12345678"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={chainStructure}
          onChange={(e) => setChainStructure(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-700">Kædestruktur (aktiverer Lag 2-kontrakttyper)</span>
      </label>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={!isDirty || saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Gemmer…' : 'Gem ændringer'}
        </button>
      </div>
    </form>
  )
}
