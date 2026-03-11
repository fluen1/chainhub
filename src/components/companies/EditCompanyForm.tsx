'use client'

import { useState } from 'react'
import { updateCompany } from '@/actions/companies'
import { toast } from 'sonner'
import type { Company } from '@prisma/client'

interface EditCompanyFormProps {
  company: Company
}

export function EditCompanyForm({ company }: EditCompanyFormProps) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await updateCompany({
      companyId: company.id,
      name: formData.get('name') as string,
      cvr: formData.get('cvr') as string,
      companyType: formData.get('companyType') as string,
      address: formData.get('address') as string,
      city: formData.get('city') as string,
      postalCode: formData.get('postalCode') as string,
      notes: formData.get('notes') as string,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Ændringer gemt')
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Stamdata</h2>
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Rediger
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Selskabsnavn</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">CVR-nummer</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.cvr || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Selskabsform</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.company_type || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.status}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Adresse</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.address || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">By</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {company.postal_code && company.city
                ? `${company.postal_code} ${company.city}`
                : company.city || company.postal_code || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Stiftelsesdato</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {company.founded_date
                ? new Date(company.founded_date).toLocaleDateString('da-DK')
                : '—'}
            </dd>
          </div>
          {company.notes && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Interne noter</dt>
              <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{company.notes}</dd>
            </div>
          )}
        </dl>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Rediger stamdata</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Selskabsnavn *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={company.name}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="cvr" className="block text-sm font-medium text-gray-700">
              CVR-nummer
            </label>
            <input
              id="cvr"
              name="cvr"
              type="text"
              pattern="\d{8}"
              maxLength={8}
              defaultValue={company.cvr ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="12345678"
            />
          </div>

          <div>
            <label htmlFor="companyType" className="block text-sm font-medium text-gray-700">
              Selskabsform
            </label>
            <select
              id="companyType"
              name="companyType"
              defaultValue={company.company_type ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Vælg...</option>
              <option value="ApS">ApS</option>
              <option value="A/S">A/S</option>
              <option value="I/S">I/S</option>
              <option value="Holding ApS">Holding ApS</option>
              <option value="Andet">Andet</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Adresse
            </label>
            <input
              id="address"
              name="address"
              type="text"
              defaultValue={company.address ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">
              Postnummer
            </label>
            <input
              id="postalCode"
              name="postalCode"
              type="text"
              maxLength={4}
              defaultValue={company.postal_code ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700">
              By
            </label>
            <input
              id="city"
              name="city"
              type="text"
              defaultValue={company.city ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Interne noter
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={company.notes ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annullér
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Gemmer...' : 'Gem ændringer'}
          </button>
        </div>
      </form>
    </div>
  )
}
