'use client'

import { useState } from 'react'
import { addCompanyPerson } from '@/actions/governance'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'

interface RoleOption {
  value: string
  label: string
}

interface AddCompanyPersonFormProps {
  companyId: string
  roleOptions: RoleOption[]
  formTitle: string
  showEmploymentType?: boolean
}

export function AddCompanyPersonForm({
  companyId,
  roleOptions,
  formTitle,
  showEmploymentType = false,
}: AddCompanyPersonFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await addCompanyPerson({
      companyId,
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      personEmail: formData.get('personEmail') as string,
      role: formData.get('role') as string,
      employmentType: showEmploymentType ? (formData.get('employmentType') as string) : undefined,
      startDate: formData.get('startDate') as string,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Tilknytning oprettet')
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
        {formTitle}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="fixed inset-0 bg-black/20" onClick={() => setOpen(false)} />
      <div className="relative z-50 h-full w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{formTitle}</h2>
          <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Fornavn *</label>
              <input
                name="firstName"
                type="text"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Efternavn *</label>
              <input
                name="lastName"
                type="text"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              name="personEmail"
              type="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Rolle *</label>
            <select
              name="role"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Vælg rolle...</option>
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {showEmploymentType && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Ansættelsestype</label>
              <select
                name="employmentType"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Vælg...</option>
                <option value="Fuldtid">Fuldtid</option>
                <option value="Deltid">Deltid</option>
                <option value="Vikar">Vikar</option>
                <option value="Freelance">Freelance</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Startdato</label>
            <input
              name="startDate"
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
              {loading ? 'Gemmer...' : 'Gem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
