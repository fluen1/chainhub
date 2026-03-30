'use client'

import Link from 'next/link'
import { ArrowLeft, FileText, RefreshCw, Upload, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { getContractById } from '@/mock/contracts'
import { cn } from '@/lib/utils'

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  EJERAFTALE: 'Ejeraftale',
  LEJEKONTRAKT: 'Lejekontrakt',
  FORSIKRING: 'Erhvervsforsikring',
  ANSAETTELSESKONTRAKT: 'Ansættelseskontrakt',
  SAMARBEJDSAFTALE: 'Samarbejdsaftale',
  AKTIONAEROVERENSKOMST: 'Aktionæroverenskomst',
  KREDITAFTALE: 'Kreditaftale',
  LEVERANDOERKONTRAKT: 'Leverandørkontrakt',
  SERVICEAFTALE: 'Serviceaftale',
  TAVSHEDSAFTALE: 'Tavshedspligtaftale',
}

const SENSITIVITY_LABELS: Record<string, string> = {
  PUBLIC: 'Offentlig',
  STANDARD: 'Standard',
  INTERN: 'Intern',
  FORTROLIG: 'Fortrolig',
  STRENGT_FORTROLIG: 'Strengt fortrolig',
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'AKTIV': return 'bg-green-100 text-green-700'
    case 'UDLOEBET': return 'bg-red-100 text-red-700'
    case 'OPSAGT': return 'bg-gray-100 text-gray-600'
    case 'UDKAST': return 'bg-blue-100 text-blue-700'
    case 'FORNYET': return 'bg-teal-100 text-teal-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function urgencyTextColor(urgency: string): string {
  switch (urgency) {
    case 'critical': return 'text-red-600 font-medium'
    case 'warning': return 'text-amber-600 font-medium'
    default: return 'text-gray-700'
  }
}

function sensitivityBadgeClass(sensitivity: string): string {
  switch (sensitivity) {
    case 'STRENGT_FORTROLIG': return 'bg-red-100 text-red-700'
    case 'FORTROLIG': return 'bg-orange-100 text-orange-700'
    case 'INTERN': return 'bg-yellow-100 text-yellow-700'
    case 'STANDARD': return 'bg-gray-100 text-gray-600'
    case 'PUBLIC': return 'bg-green-100 text-green-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function expiryLabel(days: number | null): string {
  if (days === null) return 'Ingen udløbsdato'
  if (days < 0) return `Udløbet for ${Math.abs(days)} dage siden`
  if (days === 0) return 'Udløber i dag'
  return `Udløber om ${days} dage`
}

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  // usePrototype for context — ikke brugt direkte, men sikrer vi er inden for provideren
  usePrototype()

  const contract = getContractById(params.id)

  if (!contract) {
    return (
      <div className="space-y-4">
        <Link
          href="/proto/contracts"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kontrakter
        </Link>
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <p className="text-gray-500 text-sm">Kontrakt ikke fundet</p>
          <Link
            href="/proto/contracts"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            Tilbage til kontraktoversigt
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Brødkrumme */}
      <Link
        href="/proto/contracts"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Kontrakter
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900">{contract.displayName}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                {SYSTEM_TYPE_LABELS[contract.systemType] ?? contract.systemType}
              </span>
              <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', statusBadgeClass(contract.status))}>
                {contract.statusLabel}
              </span>
              <span className="text-xs text-gray-500">{contract.categoryLabel}</span>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium shrink-0',
              sensitivityBadgeClass(contract.sensitivity),
            )}
          >
            {SENSITIVITY_LABELS[contract.sensitivity] ?? contract.sensitivity}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
          {/* Selskab */}
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Selskab</span>
            <div className="mt-1">
              <Link
                href={`/proto/portfolio/${contract.companyId}`}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {contract.companyName}
              </Link>
            </div>
          </div>

          {/* Udløbsdato */}
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Udløbsdato</span>
            <div className="mt-1">
              {contract.expiryDate ? (
                <div>
                  <span className="text-sm text-gray-900">{contract.expiryDate}</span>
                  <span className={cn('ml-2 text-xs', urgencyTextColor(contract.urgency))}>
                    ({expiryLabel(contract.daysUntilExpiry)})
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-400">Ingen udløbsdato</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Handlingsknapper */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => toast.success('Handling simuleret i prototype')}
          className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Forny kontrakt
        </button>
        <button
          onClick={() => toast.success('Handling simuleret i prototype')}
          className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Upload ny version
        </button>
        <button
          onClick={() => toast.success('Handling simuleret i prototype')}
          className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
        >
          <ClipboardList className="h-4 w-4" />
          Opret opgave
        </button>
      </div>

      {/* Versionshistorik */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Versionshistorik</h2>
        </div>
        <p className="text-sm text-gray-400 italic">Ingen versioner registreret</p>
      </div>

      {/* Tilknyttede sager */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Tilknyttede sager</h2>
        <p className="text-sm text-gray-400 italic">Ingen sager tilknyttet denne kontrakt</p>
      </div>

      {/* Dokumenter */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Dokumenter</h2>
        <p className="text-sm text-gray-400 italic">Ingen dokumenter uploadet endnu</p>
      </div>
    </div>
  )
}
