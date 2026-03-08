'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { listCases } from '@/actions/cases'
import { CaseStatusBadge } from './CaseStatusBadge'
import { CaseTypeBadge } from './CaseTypeBadge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { SearchIcon, BuildingIcon, ClockIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { da } from 'date-fns/locale'
import type { CaseWithCounts } from '@/types/case'
import { CASE_TYPE_LABELS, CASE_STATUS_LABELS } from '@/types/case'
import type { CaseStatus, SagsType } from '@prisma/client'

interface CaseListClientProps {
  initialCases: CaseWithCounts[]
  totalCount: number
}

export function CaseListClient({ initialCases, totalCount }: CaseListClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [cases, setCases] = useState(initialCases)
  const [total, setTotal] = useState(totalCount)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'ALL'>('ALL')
  const [typeFilter, setTypeFilter] = useState<SagsType | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 25

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
    startTransition(async () => {
      const result = await listCases({
        search: value || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        caseType: typeFilter !== 'ALL' ? typeFilter : undefined,
        page: 1,
        pageSize,
        sortBy: 'updatedAt',
        sortDir: 'desc',
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCases(result.data.cases)
      setTotal(result.data.total)
    })
  }

  function handleStatusFilter(value: string) {
    const status = value as CaseStatus | 'ALL'
    setStatusFilter(status)
    setPage(1)
    startTransition(async () => {
      const result = await listCases({
        search: search || undefined,
        status: status !== 'ALL' ? status : undefined,
        caseType: typeFilter !== 'ALL' ? typeFilter : undefined,
        page: 1,
        pageSize,
        sortBy: 'updatedAt',
        sortDir: 'desc',
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCases(result.data.cases)
      setTotal(result.data.total)
    })
  }

  function handleTypeFilter(value: string) {
    const type = value as SagsType | 'ALL'
    setTypeFilter(type)
    setPage(1)
    startTransition(async () => {
      const result = await listCases({
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        caseType: type !== 'ALL' ? type : undefined,
        page: 1,
        pageSize,
        sortBy: 'updatedAt',
        sortDir: 'desc',
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCases(result.data.cases)
      setTotal(result.data.total)
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  if (cases.length === 0 && !search && statusFilter === 'ALL' && typeFilter === 'ALL') {
    return <CaseListEmpty />
  }

  return (
    <div className="space-y-4">
      {/* Filtre */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Søg i sager..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle statusser" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle statusser</SelectItem>
            {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {CASE_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={handleTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle sagstyper" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle sagstyper</SelectItem>
            {(Object.keys(CASE_TYPE_LABELS) as SagsType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {CASE_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resultatantal */}
      <p className="text-sm text-gray-500">
        {isPending ? 'Søger...' : `${total} sag${total !== 1 ? 'er' : ''}`}
      </p>

      {/* Tom tilstand ved filter */}
      {cases.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500">Ingen sager matcher dit filter</p>
          <p className="mt-1 text-sm text-gray-400">Prøv at ændre dine søgekriterier</p>
        </div>
      )}

      {/* Liste */}
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {cases.map((caseItem) => (
          <div
            key={caseItem.id}
            className="flex cursor-pointer items-start justify-between p-4 hover:bg-gray-50 transition-colors"
            onClick={() => router.push(`/cases/${caseItem.id}`)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-gray-900">{caseItem.title}</span>
                <CaseStatusBadge status={caseItem.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <CaseTypeBadge caseType={caseItem.caseType} />
                {caseItem.caseCompanies.length > 0 && (
                  <span className="flex items-center gap-1">
                    <BuildingIcon className="h-3.5 w-3.5" />
                    {caseItem.caseCompanies
                      .slice(0, 2)
                      .map((cc) => cc.company.name)
                      .join(', ')}
                    {caseItem.caseCompanies.length > 2 && (
                      <span>+{caseItem.caseCompanies.length - 2}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {caseItem._count.tasks > 0 && (
                  <span>{caseItem._count.tasks} opgave{caseItem._count.tasks !== 1 ? 'r' : ''}</span>
                )}
                {caseItem._count.deadlines > 0 && (
                  <span>{caseItem._count.deadlines} frist{caseItem._count.deadlines !== 1 ? 'er' : ''}</span>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <ClockIcon className="h-3 w-3" />
                {formatDistanceToNow(new Date(caseItem.updatedAt), {
                  addSuffix: true,
                  locale: da,
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Side {page} af {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => setPage((p) => p - 1)}
            >
              Forrige
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => setPage((p) => p + 1)}
            >
              Næste
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function CaseListEmpty() {
  const router = useRouter()
  return (
    <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
      <p className="text-gray-500">Du har ingen sager endnu</p>
      <p className="mt-1 text-sm text-gray-400">
        Opret din første sag for at komme i gang
      </p>
      <Button className="mt-4" onClick={() => router.push('/cases/new')}>
        Opret sag
      </Button>
    </div>
  )
}