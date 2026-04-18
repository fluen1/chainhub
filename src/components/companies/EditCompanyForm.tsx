'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCompany } from '@/actions/companies'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import type { Company } from '@prisma/client'
import { getCompanyStatusLabel, COMPANY_TYPE_OPTIONS } from '@/lib/labels'

interface EditCompanyFormProps {
  company: Company
}

export function EditCompanyForm({ company }: EditCompanyFormProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const result = await updateCompany({
        companyId: company.id,
        name: formData.get('name') as string,
        cvr: formData.get('cvr') as string,
        companyType: formData.get('companyType') as string,
        address: formData.get('address') as string,
        city: formData.get('city') as string,
        postalCode: formData.get('postalCode') as string,
        foundedDate: formData.get('foundedDate') as string,
        notes: formData.get('notes') as string,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Ændringer gemt')
      setEditing(false)
      router.refresh()
    } catch {
      toast.error('Noget gik galt — prøv igen')
    } finally {
      setLoading(false)
    }
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500">Grundoplysninger og adresse</p>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rediger
          </button>
        </div>

        {/* Selskabsinformation */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 mb-4">
          <p className="text-xs font-medium text-gray-500 tracking-wide mb-4">
            Selskabsinformation
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Selskabsnavn" value={company.name} />
            <Field label="CVR-nummer" value={company.cvr} mono />
            <Field label="Selskabsform" value={company.company_type} />
            <Field label="Status" value={getCompanyStatusLabel(company.status ?? '')} />
            <Field
              label="Stiftelsesdato"
              value={
                company.founded_date
                  ? new Date(company.founded_date).toLocaleDateString('da-DK')
                  : null
              }
            />
          </div>
        </div>

        {/* Adresse */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 mb-4">
          <p className="text-xs font-medium text-gray-500 tracking-wide mb-4">Adresse</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vejnavn og nummer" value={company.address} span2 />
            <Field label="Postnummer" value={company.postal_code} mono />
            <Field label="By" value={company.city} />
          </div>
        </div>

        {/* Interne noter */}
        {company.notes && (
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium text-gray-500 tracking-wide mb-2">Interne noter</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{company.notes}</p>
          </div>
        )}
      </div>
    )
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-gray-500 mb-5">Rediger grundoplysninger og adresse</p>

      <form onSubmit={handleSubmit}>
        {/* Selskabsinformation */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4 mb-4">
          <p className="text-xs font-medium text-gray-500 tracking-wide">Selskabsinformation</p>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Selskabsnavn <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={200}
              defaultValue={company.name}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cvr" className="block text-sm font-medium text-gray-700">
                CVR-nummer
              </label>
              <input
                id="cvr"
                name="cvr"
                type="text"
                inputMode="numeric"
                pattern="\d{8}"
                maxLength={8}
                defaultValue={company.cvr ?? ''}
                className={inputClass}
                placeholder="12345678"
              />
              <p className="mt-1 text-xs text-gray-500">8 cifre</p>
            </div>

            <div>
              <label htmlFor="companyType" className="block text-sm font-medium text-gray-700">
                Selskabsform
              </label>
              <select
                id="companyType"
                name="companyType"
                defaultValue={company.company_type ?? ''}
                className={inputClass}
              >
                <option value="">Vælg...</option>
                {COMPANY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="foundedDate" className="block text-sm font-medium text-gray-700">
                Stiftelsesdato
              </label>
              <input
                id="foundedDate"
                name="foundedDate"
                type="date"
                defaultValue={
                  company.founded_date
                    ? new Date(company.founded_date).toISOString().split('T')[0]
                    : ''
                }
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Adresse */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4 mb-4">
          <p className="text-xs font-medium text-gray-500 tracking-wide">Adresse</p>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Vejnavn og nummer
            </label>
            <input
              id="address"
              name="address"
              type="text"
              defaultValue={company.address ?? ''}
              className={inputClass}
              placeholder="Østerbrogade 123"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">
                Postnummer
              </label>
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                defaultValue={company.postal_code ?? ''}
                className={inputClass}
                placeholder="2100"
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
                className={inputClass}
                placeholder="København Ø"
              />
            </div>
          </div>
        </div>

        {/* Interne noter */}
        <div className="mb-6">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Interne noter
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={company.notes ?? ''}
            className={`${inputClass} mt-1`}
            placeholder="Valgfrie noter om selskabet..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            Annullér
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Gemmer...' : 'Gem ændringer'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  mono,
  span2,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  span2?: boolean
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`mt-0.5 text-sm ${value ? 'text-gray-900' : 'text-gray-300'} ${mono ? 'tabular-nums' : ''}`}
      >
        {value || '—'}
      </p>
    </div>
  )
}
