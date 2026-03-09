'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { updateCompany } from '@/actions/companies'
import type { CompanyWithRelations } from '@/types/company'

interface EditCompanyDialogProps {
  company: CompanyWithRelations
  onClose: () => void
}

const COMPANY_TYPES = ['ApS', 'A/S', 'I/S', 'enkeltmandsvirksomhed', 'P/S', 'K/S', 'Andet'] as const
type CompanyType = typeof COMPANY_TYPES[number]

const STATUS_OPTIONS = [
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'inaktiv', label: 'Inaktiv' },
  { value: 'under_stiftelse', label: 'Under stiftelse' },
  { value: 'opløst', label: 'Opløst' },
]

export function EditCompanyDialog({ company, onClose }: EditCompanyDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: company.name,
    cvr: company.cvr ?? '',
    companyType: company.companyType ?? '' as CompanyType | '',
    address: company.address ?? '',
    city: company.city ?? '',
    postalCode: company.postalCode ?? '',
    foundedDate: company.foundedDate
      ? new Date(company.foundedDate).toISOString().split('T')[0]
      : '',
    status: company.status,
    notes: company.notes ?? '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const companyType = COMPANY_TYPES.includes(form.companyType as CompanyType)
      ? (form.companyType as CompanyType)
      : undefined

    const result = await updateCompany({
      companyId: company.id,
      name: form.name,
      cvr: form.cvr || '',
      companyType,
      address: form.address,
      city: form.city,
      postalCode: form.postalCode,
      foundedDate: form.foundedDate,
      status: form.status as 'aktiv' | 'inaktiv' | 'under_stiftelse' | 'opløst',
      notes: form.notes,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Selskab opdateret')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Rediger selskab</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-4 px-6 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Selskabsnavn <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">CVR-nummer</label>
                <input
                  name="cvr"
                  type="text"
                  value={form.cvr}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Selskabstype</label>
                <select
                  name="companyType"
                  value={form.companyType}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Vælg type</option>
                  {COMPANY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Adresse</label>
              <input
                name="address"
                type="text"
                value={form.address}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Postnummer</label>
                <input
                  name="postalCode"
                  type="text"
                  value={form.postalCode}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">By</label>
                <input
                  name="city"
                  type="text"
                  value={form.city}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Stiftelsesdato</label>
              <input
                name="foundedDate"
                type="date"
                value={form.foundedDate}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Noter</label>
              <textarea
                name="notes"
                rows={3}
                value={form.notes}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              {isSubmitting ? 'Gemmer...' : 'Gem ændringer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}