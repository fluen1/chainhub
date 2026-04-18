'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileText,
  Plus,
  AlertTriangle,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import {
  getContractTypeLabel,
  getContractStatusLabel,
  getContractCategory,
  getContractCategoryLabel,
  CONTRACT_CATEGORIES,
  type ContractCategory,
} from '@/lib/labels'

interface ContractData {
  id: string
  display_name: string
  system_type: string
  status: string
  sensitivity: string
  expiry_date: Date | string | null
}

interface ContractListProps {
  contracts: ContractData[]
  companyId: string
}

function getUrgencyLevel(
  expiryDate: Date | string | null
): 'expired' | 'urgent' | 'warning' | 'ok' | 'none' {
  if (!expiryDate) return 'none'
  const d = new Date(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fourteenDays = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  if (d < today) return 'expired'
  if (d <= fourteenDays) return 'urgent'
  if (d <= ninetyDays) return 'warning'
  return 'ok'
}

function formatExpiryDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

function getDaysLabel(date: Date | string): string {
  const d = new Date(date)
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return `${Math.abs(days)} dage forsinket`
  if (days === 0) return 'Udløber i dag'
  if (days === 1) return 'Udløber i morgen'
  return `${days} dage tilbage`
}

function CollapsibleCategory({
  category,
  contracts,
  defaultOpen = true,
}: {
  category: ContractCategory
  contracts: ContractData[]
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 py-2 border-b border-gray-200 hover:bg-gray-50/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        )}
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {getContractCategoryLabel(category)}
        </span>
        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
          {contracts.length}
        </span>
      </button>
      {isOpen && (
        <div className="border-l border-gray-200">
          {contracts.map((contract) => {
            const urgency = getUrgencyLevel(contract.expiry_date)
            const accentClass =
              urgency === 'expired' || urgency === 'urgent'
                ? 'border-l-[3px] border-l-red-400 -ml-px'
                : urgency === 'warning'
                  ? 'border-l-[3px] border-l-amber-400 -ml-px'
                  : ''

            const dateColorClass =
              urgency === 'expired' || urgency === 'urgent'
                ? 'text-red-600 font-medium'
                : urgency === 'warning'
                  ? 'text-amber-600'
                  : urgency === 'ok'
                    ? 'text-gray-500'
                    : 'text-gray-300'

            return (
              <Link
                key={contract.id}
                href={`/contracts/${contract.id}`}
                className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${accentClass}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {contract.display_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getContractTypeLabel(contract.system_type)}
                    {' · '}
                    <span className={contract.status === 'AKTIV' ? 'text-green-700' : ''}>
                      {getContractStatusLabel(contract.status)}
                    </span>
                  </p>
                </div>
                <div className={`text-sm tabular-nums shrink-0 ml-4 ${dateColorClass}`}>
                  {contract.expiry_date ? formatExpiryDate(contract.expiry_date) : 'Løbende'}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ContractList({ contracts, companyId }: ContractListProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? contracts.filter((c) => c.display_name.toLowerCase().includes(search.toLowerCase()))
    : contracts

  // Grupper kontrakter efter kategori
  const grouped = CONTRACT_CATEGORIES.reduce<Partial<Record<ContractCategory, ContractData[]>>>(
    (acc, category) => {
      const categoryContracts = filtered.filter(
        (c) => getContractCategory(c.system_type) === category
      )
      if (categoryContracts.length > 0) {
        // Sortér: kontrakter med udløbsdato først (tidligst først), derefter løbende alfabetisk
        categoryContracts.sort((a, b) => {
          const aExpiry = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity
          const bExpiry = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity
          if (aExpiry !== bExpiry) return aExpiry - bExpiry
          return a.display_name.localeCompare(b.display_name, 'da-DK')
        })
        acc[category] = categoryContracts
      }
      return acc
    },
    {}
  )

  // Urgency alerts (udløbne + ≤14 dage)
  const urgentContracts = contracts.filter((c) => {
    const level = getUrgencyLevel(c.expiry_date)
    return level === 'expired' || level === 'urgent'
  })

  // Summary counts
  const uniqueCategories = Object.keys(grouped).length
  const needsAttention = contracts.filter((c) => {
    const level = getUrgencyLevel(c.expiry_date)
    return level === 'expired' || level === 'urgent' || level === 'warning'
  }).length

  if (contracts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Link
            href={`/contracts/new?companyId=${companyId}`}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Ny kontrakt
          </Link>
        </div>
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">Ingen kontrakter endnu</p>
          <p className="mt-1 text-sm text-gray-500">Opret den første kontrakt for dette selskab.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary + søgning + ny kontrakt */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>
            {contracts.length} kontrakt{contracts.length !== 1 ? 'er' : ''}
          </span>
          <span className="text-gray-300">·</span>
          <span>
            {uniqueCategories} kategori{uniqueCategories !== 1 ? 'er' : ''}
          </span>
          {needsAttention > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-red-600 font-medium">{needsAttention} kræver opmærksomhed</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Søg kontrakter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-44 rounded-md border border-gray-200 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>
          <Link
            href={`/contracts/new?companyId=${companyId}`}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Ny kontrakt
          </Link>
        </div>
      </div>

      {/* Urgency alerts */}
      {urgentContracts.length > 0 && (
        <div className="space-y-1.5">
          {urgentContracts.map((contract) => (
            <Link
              key={contract.id}
              href={`/contracts/${contract.id}`}
              className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{contract.display_name}</span>
              <span className="text-xs shrink-0">
                {contract.expiry_date && getDaysLabel(contract.expiry_date)}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
            </Link>
          ))}
        </div>
      )}

      {/* Grupperet kontraktliste */}
      {Object.keys(grouped).length === 0 && search ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center">
          <Search className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">Ingen resultater</p>
          <p className="mt-1 text-sm text-gray-500">
            Ingen kontrakter matcher &ldquo;{search}&rdquo;
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {CONTRACT_CATEGORIES.map((category) => {
            const categoryContracts = grouped[category]
            if (!categoryContracts) return null
            return (
              <CollapsibleCategory
                key={category}
                category={category}
                contracts={categoryContracts}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
