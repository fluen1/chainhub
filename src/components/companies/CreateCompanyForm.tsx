'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCompany } from '@/actions/companies'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { COMPANY_TYPE_OPTIONS } from '@/lib/labels'

export function CreateCompanyForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const result = await createCompany({
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

      if (result.data) {
        toast.success('Selskab oprettet')
        router.push(`/companies/${result.data.id}`)
      }
    } catch {
      toast.error('Noget gik galt — prøv igen')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400'

  return (
    <div className="mx-auto max-w-xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/companies"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Tilbage til selskaber"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              Opret selskab
            </h1>
            <p className="text-sm text-gray-400">
              Tilføj et nyt lokationsselskab til porteføljen
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Selskabsinformation */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <p className="text-xs font-medium text-gray-400 tracking-wide">
            Selskabsinformation
          </p>

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
              className={inputClass}
              placeholder="Tandlæge Østerbro ApS"
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
                className={inputClass}
                placeholder="12345678"
              />
              <p className="mt-1 text-xs text-gray-400">8 cifre</p>
            </div>

            <div>
              <label htmlFor="companyType" className="block text-sm font-medium text-gray-700">
                Selskabsform
              </label>
              <select
                id="companyType"
                name="companyType"
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
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Adresse */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <p className="text-xs font-medium text-gray-400 tracking-wide">
            Adresse
          </p>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Vejnavn og nummer
            </label>
            <input
              id="address"
              name="address"
              type="text"
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
                className={inputClass}
                placeholder="København Ø"
              />
            </div>
          </div>
        </div>

        {/* Interne noter — direkte, ingen sektion-wrapper */}
        <div className="mt-4">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Interne noter
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className={`${inputClass} mt-1`}
            placeholder="Valgfrie noter om selskabet..."
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/companies"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            Annullér
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Opretter...' : 'Opret selskab'}
          </button>
        </div>
      </form>
    </div>
  )
}
