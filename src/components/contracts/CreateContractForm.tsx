'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createContract } from '@/actions/contracts'
import {
  CONTRACT_TYPE_LABELS,
  CONTRACT_SYSTEM_TYPES,
  SENSITIVITY_MINIMUM,
  type ContractSystemTypeKey,
  type SensitivityLevelValue,
} from '@/lib/validations/contract'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const SENSITIVITY_OPTIONS: { value: SensitivityLevelValue; label: string }[] = [
  { value: 'PUBLIC', label: 'Offentlig' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'FORTROLIG', label: 'Fortrolig' },
  { value: 'STRENGT_FORTROLIG', label: 'Strengt fortrolig' },
]

const SENSITIVITY_ORDER: SensitivityLevelValue[] = [
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]

export function CreateContractForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCompanyId = searchParams.get('companyId') ?? ''

  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<ContractSystemTypeKey | ''>('')
  const [minSensitivity, setMinSensitivity] = useState<SensitivityLevelValue>('STANDARD')
  const [companyId, setCompanyId] = useState(preselectedCompanyId)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  // Hent selskaber
  useEffect(() => {
    fetch('/api/companies-list')
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => {})
  }, [])

  // Opdater minimum-sensitivitet når type ændres
  useEffect(() => {
    if (selectedType && SENSITIVITY_MINIMUM[selectedType as ContractSystemTypeKey]) {
      setMinSensitivity(
        SENSITIVITY_MINIMUM[selectedType as ContractSystemTypeKey] as SensitivityLevelValue
      )
    } else {
      setMinSensitivity('STANDARD')
    }
  }, [selectedType])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await createContract({
      companyId: formData.get('companyId') as string,
      systemType: formData.get('systemType') as string,
      displayName: formData.get('displayName') as string,
      sensitivity: formData.get('sensitivity') as SensitivityLevelValue,
      effectiveDate: formData.get('effectiveDate') as string,
      expiryDate: formData.get('expiryDate') as string,
      noticePeriodDays: formData.get('noticePeriodDays')
        ? Number(formData.get('noticePeriodDays'))
        : undefined,
      notes: formData.get('notes') as string,
      reminder90Days: formData.get('reminder90Days') === 'on',
      reminder30Days: formData.get('reminder30Days') === 'on',
      reminder7Days: formData.get('reminder7Days') === 'on',
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.data) {
      toast.success('Kontrakt oprettet')
      router.push(`/contracts/${result.data.id}`)
    }
  }

  // Filtrer sensitivity-options til kun dem >= minimum
  const availableSensitivityOptions = SENSITIVITY_OPTIONS.filter(
    (opt) => SENSITIVITY_ORDER.indexOf(opt.value) >= SENSITIVITY_ORDER.indexOf(minSensitivity)
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contracts" className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Opret kontrakt</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
        {/* Grunddata */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Grunddata</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tilknyttet selskab *</label>
            <select
              name="companyId"
              required
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Vælg selskab...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Kontrakttype *</label>
            <select
              name="systemType"
              required
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ContractSystemTypeKey)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Vælg type...</option>
              {CONTRACT_SYSTEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CONTRACT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {selectedType && (
              <p className="mt-1 text-xs text-gray-500">
                Minimum sensitivitet:{' '}
                <span className="font-medium">
                  {SENSITIVITY_MINIMUM[selectedType as ContractSystemTypeKey] ?? 'STANDARD'}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Kontraktens navn *</label>
            <input
              name="displayName"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="fx Ejeraftale Tandlæge Østerbro ApS 2024"
            />
            <p className="mt-1 text-xs text-gray-500">
              Dit eget navn til kontrakten — vises i oversigten
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Sensitivitetsniveau *</label>
            <select
              name="sensitivity"
              required
              defaultValue={minSensitivity}
              key={minSensitivity}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {availableSensitivityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Datoer */}
        <div className="space-y-4 border-t pt-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Datoer og vilkår
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Startdato</label>
              <input
                name="effectiveDate"
                type="date"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Udløbsdato
                <span className="ml-1 text-xs text-gray-400">(blank = løbende)</span>
              </label>
              <input
                name="expiryDate"
                type="date"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Opsigelsesvarsel (dage)
              <span className="ml-1 text-xs text-gray-400">(løbende kontrakter)</span>
            </label>
            <input
              name="noticePeriodDays"
              type="number"
              min="0"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="30"
            />
          </div>
        </div>

        {/* Advisering */}
        <div className="space-y-3 border-t pt-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Advisering
          </h2>
          <p className="text-xs text-gray-500">Hvornår skal du adviseres om udløb?</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="reminder90Days" defaultChecked className="rounded" />
              <span className="text-sm text-gray-700">90 dage før udløb</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="reminder30Days" defaultChecked className="rounded" />
              <span className="text-sm text-gray-700">30 dage før udløb</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="reminder7Days" defaultChecked className="rounded" />
              <span className="text-sm text-gray-700">7 dage før udløb</span>
            </label>
          </div>
        </div>

        {/* Noter */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700">Interne noter</label>
          <textarea
            name="notes"
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Interne noter..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/contracts"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annullér
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Opretter...' : 'Opret kontrakt'}
          </button>
        </div>
      </form>
    </div>
  )
}
