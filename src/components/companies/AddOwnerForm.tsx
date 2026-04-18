'use client'

import { useState } from 'react'
import { addOwner } from '@/actions/ownership'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'

interface AddOwnerFormProps {
  companyId: string
}

export function AddOwnerForm({ companyId }: AddOwnerFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await addOwner({
      companyId,
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      personEmail: formData.get('personEmail') as string,
      ownershipPct: Number(formData.get('ownershipPct')),
      ownerType: formData.get('ownerType') as 'PERSON' | 'HOLDINGSELSKAB' | 'ANDET_SELSKAB',
      acquiredAt: formData.get('acquiredAt') as string,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Ejer tilføjet')
    setOpen(false)
    ;(e.target as HTMLFormElement).reset()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
      >
        <Plus className="h-4 w-4" />
        Tilføj ejer
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="fixed inset-0 bg-black/20" onClick={() => setOpen(false)} />
      <div className="relative z-50 h-full w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Tilføj ejer</h2>
          <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="owner-firstName" className="block text-sm font-medium text-gray-700">
                Fornavn *
              </label>
              <input
                id="owner-firstName"
                name="firstName"
                type="text"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="owner-lastName" className="block text-sm font-medium text-gray-700">
                Efternavn *
              </label>
              <input
                id="owner-lastName"
                name="lastName"
                type="text"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="owner-personEmail" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="owner-personEmail"
              name="personEmail"
              type="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-ownershipPct" className="block text-sm font-medium text-gray-700">
              Ejerandel % *
            </label>
            <input
              id="owner-ownershipPct"
              name="ownershipPct"
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="50.00"
            />
          </div>

          <div>
            <label htmlFor="owner-ownerType" className="block text-sm font-medium text-gray-700">
              Ejertype *
            </label>
            <select
              id="owner-ownerType"
              name="ownerType"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="PERSON">Person</option>
              <option value="HOLDINGSELSKAB">Holdingselskab</option>
              <option value="ANDET_SELSKAB">Andet selskab</option>
            </select>
          </div>

          <div>
            <label htmlFor="owner-acquiredAt" className="block text-sm font-medium text-gray-700">
              Dato for erhvervelse
            </label>
            <input
              id="owner-acquiredAt"
              name="acquiredAt"
              type="date"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annullér
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Tilføjer...' : 'Tilføj ejer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
