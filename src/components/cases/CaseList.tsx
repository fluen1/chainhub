'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Briefcase, Plus, Search, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getCaseTypeLabel,
  getCaseStatusLabel,
  CASE_TYPE_LABELS,
} from '@/lib/labels'

interface CaseData {
  id: string
  title: string
  case_type: string
  status: string
  created_at: Date | string
  due_date: Date | string | null
  _count: {
    tasks: number
  }
}

interface CaseListProps {
  cases: CaseData[]
  companyId: string
}

const CASE_TYPE_ORDER = [
  'TRANSAKTION',
  'TVIST',
  'COMPLIANCE',
  'KONTRAKT',
  'GOVERNANCE',
  'ANDET',
] as const

function getStatusColor(status: string): string {
  switch (status) {
    case 'NY': return 'text-gray-600'
    case 'AKTIV': return 'text-blue-700'
    case 'AFVENTER_EKSTERN':
    case 'AFVENTER_KLIENT': return 'text-amber-600'
    case 'LUKKET': return 'text-green-700'
    case 'ARKIVERET': return 'text-gray-400'
    default: return 'text-gray-600'
  }
}

function getDueDateInfo(dueDate: Date | string | null): { label: string; colorClass: string } | null {
  if (!dueDate) return null
  const d = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (days < 0) return { label: `${Math.abs(days)} dag${Math.abs(days) !== 1 ? 'e' : ''} forsinket`, colorClass: 'text-red-600 font-medium' }
  if (days === 0) return { label: 'Frist i dag', colorClass: 'text-red-600 font-medium' }
  if (days <= 14) return { label: `${days} dage tilbage`, colorClass: 'text-red-600 font-medium' }
  if (days <= 90) return { label: d.toLocaleDateString('da-DK'), colorClass: 'text-amber-600' }
  return { label: d.toLocaleDateString('da-DK'), colorClass: 'text-gray-500' }
}

function CollapsibleCaseGroup({
  caseType,
  cases,
}: {
  caseType: string
  cases: CaseData[]
}) {
  const [isOpen, setIsOpen] = useState(true)

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
          {getCaseTypeLabel(caseType)}
        </span>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
          {cases.length}
        </span>
      </button>
      {isOpen && (
        <div className="border-l border-gray-200">
          {cases.map((caseItem) => {
            const dueDateInfo = getDueDateInfo(caseItem.due_date)
            const hasOverdueBorder = caseItem.due_date && new Date(caseItem.due_date) < new Date()
            const accentClass = hasOverdueBorder
              ? 'border-l-[3px] border-l-red-400 -ml-px'
              : ''

            return (
              <Link
                key={caseItem.id}
                href={`/cases/${caseItem.id}`}
                className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${accentClass}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {caseItem.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {getCaseTypeLabel(caseItem.case_type)}
                    {' · '}
                    <span className={getStatusColor(caseItem.status)}>
                      {getCaseStatusLabel(caseItem.status)}
                    </span>
                    {caseItem._count.tasks > 0 && (
                      <>
                        {' · '}
                        <span className="text-gray-500">
                          {caseItem._count.tasks} {caseItem._count.tasks !== 1 ? 'åbne opgaver' : 'åben opgave'}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className={`text-sm tabular-nums shrink-0 ml-4 ${dueDateInfo ? dueDateInfo.colorClass : 'text-gray-300'}`}>
                  {dueDateInfo ? dueDateInfo.label : '—'}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CaseList({ cases, companyId }: CaseListProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? cases.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : cases

  // Grupper sager efter sagstype
  const grouped = CASE_TYPE_ORDER.reduce<Partial<Record<string, CaseData[]>>>(
    (acc, caseType) => {
      const typeCases = filtered.filter((c) => c.case_type === caseType)
      if (typeCases.length > 0) {
        // Sortér: sager med frist først (tidligst), derefter oprettelsesdato
        typeCases.sort((a, b) => {
          const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity
          const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity
          if (aDue !== bDue) return aDue - bDue
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        acc[caseType] = typeCases
      }
      return acc
    },
    {}
  )

  const uniqueTypes = Object.keys(grouped).length
  const activeCases = cases.filter((c) => c.status === 'AKTIV' || c.status === 'NY').length

  if (cases.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Link
            href={`/cases/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Ny sag
          </Link>
        </div>
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">Ingen sager endnu</p>
          <p className="mt-1 text-sm text-gray-400">
            Opret den første sag for dette selskab.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary + søgning + ny sag */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>
            {cases.length} sag{cases.length !== 1 ? 'er' : ''}
          </span>
          <span className="text-gray-300">·</span>
          <span>
            {uniqueTypes} type{uniqueTypes !== 1 ? 'r' : ''}
          </span>
          {activeCases > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-blue-600 font-medium">
                {activeCases} aktiv{activeCases !== 1 ? 'e' : ''}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Søg sager..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-44 rounded-md border border-gray-200 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>
          <Link
            href={`/cases/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Ny sag
          </Link>
        </div>
      </div>

      {/* Grupperet sagsliste */}
      {Object.keys(grouped).length === 0 && search ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center">
          <Search className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">Ingen resultater</p>
          <p className="mt-1 text-sm text-gray-400">
            Ingen sager matcher &ldquo;{search}&rdquo;
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {CASE_TYPE_ORDER.map((caseType) => {
            const typeCases = grouped[caseType]
            if (!typeCases) return null
            return (
              <CollapsibleCaseGroup
                key={caseType}
                caseType={caseType}
                cases={typeCases}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
