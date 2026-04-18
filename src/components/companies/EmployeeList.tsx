'use client'

import { useState } from 'react'
import { Users, Search, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { endCompanyPerson } from '@/actions/governance'
import { toast } from 'sonner'
import { getCompanyPersonRoleLabel, formatDate } from '@/lib/labels'

interface PersonItem {
  id: string
  role: string
  employment_type: string | null
  start_date: Date | null
  end_date?: Date | null
  person: {
    id: string
    first_name: string
    last_name: string
    email: string | null
  }
}

interface EmployeeListProps {
  activePersons: PersonItem[]
  historicPersons: PersonItem[]
  addButton?: React.ReactNode
  warningBanner?: React.ReactNode
  activeLabel?: string
  historicLabel?: string
  emptyMessage?: string
  emptySubMessage?: string
  entityName?: { singular: string; plural: string }
}

function EmployeeRow({ cp, showActions }: { cp: PersonItem; showActions: boolean }) {
  const [endingId, setEndingId] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEndRole() {
    if (!endDate) {
      toast.error('Angiv en slutdato')
      return
    }
    setLoading(true)
    const result = await endCompanyPerson({ companyPersonId: cp.id, endDate })
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Rolle afregistreret')
    setEndingId(false)
    setEndDate('')
  }

  const startDateLabel = cp.start_date ? `Siden ${formatDate(cp.start_date)}` : ''
  const endDateLabel = cp.end_date ? `Fratrådt ${formatDate(cp.end_date)}` : ''

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <div className="min-w-0 flex-1">
        <Link
          href={`/persons/${cp.person.id}`}
          className="text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors"
        >
          {cp.person.first_name} {cp.person.last_name}
        </Link>
        <p className="text-xs text-gray-500 mt-0.5">
          {getCompanyPersonRoleLabel(cp.role)}
          {cp.employment_type && <span> · {cp.employment_type}</span>}
          {cp.person.email && <span> · {cp.person.email}</span>}
          {startDateLabel && <span> · {startDateLabel}</span>}
          {endDateLabel && <span> · {endDateLabel}</span>}
        </p>
      </div>
      {showActions && (
        <div className="shrink-0 ml-4">
          {endingId ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded border border-gray-200 px-2 py-1 text-xs focus:border-gray-300 focus:outline-none"
              />
              <button
                onClick={handleEndRole}
                disabled={loading}
                className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Bekræft
              </button>
              <button
                onClick={() => setEndingId(false)}
                className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
              >
                Annullér
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEndingId(true)}
              className="text-xs text-gray-500 hover:text-gray-600 transition-colors"
            >
              Afregistrér
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function CollapsibleGroup({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string
  count: number
  defaultOpen: boolean
  children: React.ReactNode
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
          {title}
        </span>
        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </button>
      {isOpen && <div className="border-l border-gray-200">{children}</div>}
    </div>
  )
}

export function EmployeeList({
  activePersons,
  historicPersons,
  addButton,
  warningBanner,
  activeLabel = 'Aktive',
  historicLabel = 'Fratrådte',
  emptyMessage = 'Ingen ansatte endnu',
  emptySubMessage = 'Tilføj den første medarbejder for dette selskab.',
  entityName = { singular: 'ansat', plural: 'ansatte' },
}: EmployeeListProps) {
  const [search, setSearch] = useState('')
  const total = activePersons.length + historicPersons.length

  const filterPersons = (persons: PersonItem[]) =>
    search
      ? persons.filter((cp) =>
          `${cp.person.first_name} ${cp.person.last_name}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      : persons

  const filteredActive = filterPersons(activePersons)
  const filteredHistoric = filterPersons(historicPersons)

  return (
    <div className="space-y-4">
      {/* Summary + søgning */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>
            {total} {total !== 1 ? entityName.plural : entityName.singular}
          </span>
          {activePersons.length > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-green-700 font-medium">
                {activePersons.length} aktiv{activePersons.length !== 1 ? 'e' : ''}
              </span>
            </>
          )}
          {historicPersons.length > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span>
                {historicPersons.length} fratrådt{historicPersons.length !== 1 ? 'e' : ''}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {total > 3 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Søg ansatte..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-44 rounded-md border border-gray-200 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
            </div>
          )}
          {addButton}
        </div>
      </div>

      {/* Advarsel (vakante roller, etc.) */}
      {warningBanner}

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <Users className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">{emptyMessage}</p>
          <p className="mt-1 text-sm text-gray-500">{emptySubMessage}</p>
        </div>
      ) : filteredActive.length === 0 && filteredHistoric.length === 0 && search ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center">
          <Search className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">Ingen resultater</p>
          <p className="mt-1 text-sm text-gray-500">Ingen ansatte matcher &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredActive.length > 0 && (
            <CollapsibleGroup title={activeLabel} count={filteredActive.length} defaultOpen={true}>
              {filteredActive.map((cp) => (
                <EmployeeRow key={cp.id} cp={cp} showActions={true} />
              ))}
            </CollapsibleGroup>
          )}
          {filteredHistoric.length > 0 && (
            <CollapsibleGroup
              title={historicLabel}
              count={filteredHistoric.length}
              defaultOpen={false}
            >
              {filteredHistoric.map((cp) => (
                <EmployeeRow key={cp.id} cp={cp} showActions={false} />
              ))}
            </CollapsibleGroup>
          )}
        </div>
      )}
    </div>
  )
}
