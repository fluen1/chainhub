'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { createOwnership, getPersonsForOrganization } from '@/actions/companies'

interface AddOwnershipDialogProps {
  companyId: string
  onClose: () => void
}

export function AddOwnershipDialog({ companyId, onClose }: AddOwnershipDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [persons, setPersons] = useState<
    { id: string; firstName: string; lastName: string; email: string | null }[]
  >([])

  const [form, setForm] = useState({
    ownerType: 'person' as 'person' | 'company',
    ownerPersonId: '',
    ownerCompanyId: '',
    ownershipPct: '',
    shareClass: '',
    effectiveDate: '',
  })

  useEffect(() => {
    getPersonsForOrganization().then((result) => {
      if (result.data) setPersons(result.data)
    })
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const pct = parseFloat(form.ownershipPct)
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast.error('Ejerandel skal være et tal mellem 0 og 100')
      setIsSubmitting(false)
      return
    }

    const result = await createOwnership({
      companyId,
      ownerType: form.ownerType,
      ownerPersonId: form.ownerType === 'person' ? form.ownerPersonId : undefined,
      ownerCompanyId: form.ownerType === 'company' ? form.ownerCompanyId : undefined,
      ownershipPct: pct,
      shareClass: form.shareClass || undefined,
      effectiveDate: form.effectiveDate || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Ejerskab tilføjet')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Tilføj ejer</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Ejertype</label>
              <select
                name="ownerType"
                value={form.ownerType}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="person">Person</option>
                <option value="company">Selskab</option>
              </select>
            </div>

            {form.ownerType === 'person' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Person</label>
                <select
                  name="ownerPersonId"
                  value={form.ownerPersonId}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Vælg person...</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                      {p.email ? ` (${p.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.ownerType === 'company' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Ejerselskab ID
                </label>
                <input
                  type="text"
                  name="ownerCompanyId"
                  value={form.ownerCompanyId}
                  onChange={handleChange}
                  required
                  placeholder="Selskabets ID"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Ejerandel (%)
              </label>
              <input
                type="number"
                name="ownershipPct"
                value={form.ownershipPct}
                onChange={handleChange}
                required
                min="0.01"
                max="100"
                step="0.01"
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Aktieklasse (valgfri)
              </label>
              <input
                type="text"
                name="shareClass"
                value={form.shareClass}
                onChange={handleChange}
                placeholder="f.eks. A-aktier"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Ikrafttrædelsesdato (valgfri)
              </label>
              <input
                type="date"
                name="effectiveDate"
                value={form.effectiveDate}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuller
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Gemmer...' : 'Tilføj ejer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}