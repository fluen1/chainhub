'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { endOwnership } from '@/actions/ownership'
import { toast } from 'sonner'
import { formatDate } from '@/lib/labels'
import type { Decimal } from '@prisma/client/runtime/library'

interface OwnershipItem {
  id: string
  ownership_pct: Decimal | number | string
  effective_date: Date | null
  end_date?: Date | null
  owner_person: {
    id: string
    first_name: string
    last_name: string
    email: string | null
  } | null
}

interface OwnershipListNewProps {
  activeOwnerships: OwnershipItem[]
  historicOwnerships: OwnershipItem[]
  totalPct: number
  pctWarning: boolean
  addButton?: React.ReactNode
}

function OwnershipRow({
  ownership,
  showActions,
}: {
  ownership: OwnershipItem
  showActions: boolean
}) {
  const [ending, setEnding] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEnd() {
    if (!endDate) {
      toast.error('Angiv en slutdato')
      return
    }
    setLoading(true)
    const result = await endOwnership({ ownershipId: ownership.id, endDate })
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Ejerskab afregistreret')
    setEnding(false)
    setEndDate('')
  }

  const name = ownership.owner_person
    ? `${ownership.owner_person.first_name} ${ownership.owner_person.last_name}`
    : 'Selskab'
  const dateLabel = ownership.effective_date ? `Siden ${formatDate(ownership.effective_date)}` : ''
  const endDateLabel = ownership.end_date ? `Ophørt ${formatDate(ownership.end_date)}` : ''

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <div className="min-w-0 flex-1">
        {ownership.owner_person ? (
          <Link
            href={`/persons/${ownership.owner_person.id}`}
            className="text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors"
          >
            {name}
          </Link>
        ) : (
          <span className="text-sm font-medium text-gray-900">{name}</span>
        )}
        <p className="text-xs text-gray-500 mt-0.5">
          {ownership.owner_person ? 'Person' : 'Selskab'}
          {ownership.owner_person?.email && <span> · {ownership.owner_person.email}</span>}
          {dateLabel && <span> · {dateLabel}</span>}
          {endDateLabel && <span> · {endDateLabel}</span>}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {Number(ownership.ownership_pct).toFixed(2)}%
        </span>
        {showActions && (
          <div>
            {ending ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded border border-gray-200 px-2 py-1 text-xs focus:border-gray-300 focus:outline-none"
                />
                <button
                  onClick={handleEnd}
                  disabled={loading}
                  className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  Bekræft
                </button>
                <button
                  onClick={() => setEnding(false)}
                  className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                >
                  Annullér
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEnding(true)}
                className="text-xs text-gray-500 hover:text-gray-600 transition-colors"
              >
                Afregistrér
              </button>
            )}
          </div>
        )}
      </div>
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

export function OwnershipListNew({
  activeOwnerships,
  historicOwnerships,
  totalPct,
  pctWarning,
  addButton,
}: OwnershipListNewProps) {
  const total = activeOwnerships.length + historicOwnerships.length

  return (
    <div className="space-y-4">
      {/* Summary + tilføj ejer */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>
            {total} ejer{total !== 1 ? 'e' : ''}
          </span>
          {activeOwnerships.length > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span
                className={pctWarning ? 'text-amber-600 font-medium' : 'text-green-700 font-medium'}
              >
                {totalPct.toFixed(0)}% af 100%
              </span>
            </>
          )}
          {historicOwnerships.length > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span>{historicOwnerships.length} tidligere</span>
            </>
          )}
        </div>
        {addButton}
      </div>

      {/* %-advarsel */}
      {pctWarning && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Samlet ejerandel er {totalPct.toFixed(2)}% — forventet 100%</span>
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <Users className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">Ingen ejere registreret endnu</p>
          <p className="mt-1 text-sm text-gray-500">Tilføj den første ejer for dette selskab.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeOwnerships.length > 0 && (
            <CollapsibleGroup
              title="Aktive ejere"
              count={activeOwnerships.length}
              defaultOpen={true}
            >
              {activeOwnerships.map((o) => (
                <OwnershipRow key={o.id} ownership={o} showActions={true} />
              ))}
            </CollapsibleGroup>
          )}
          {historicOwnerships.length > 0 && (
            <CollapsibleGroup
              title="Tidligere ejere"
              count={historicOwnerships.length}
              defaultOpen={false}
            >
              {historicOwnerships.map((o) => (
                <OwnershipRow key={o.id} ownership={o} showActions={false} />
              ))}
            </CollapsibleGroup>
          )}
        </div>
      )}
    </div>
  )
}
