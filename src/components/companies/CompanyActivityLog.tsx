'use client'

import { useEffect, useState } from 'react'
import { getActivityLog } from '@/actions/companies'
import { formatDate } from '@/lib/utils'
import { Activity } from 'lucide-react'

interface ActivityLogEntry {
  id: string
  action: string
  createdAt: string | Date
  resourceType?: string
  description?: string | null
}

interface CompanyActivityLogProps {
  companyId: string
}

const ACTION_LABELS: Record<string, string> = {
  VIEW: 'Åbnede selskabet',
  CREATE: 'Oprettede selskabet',
  UPDATE: 'Opdaterede selskabet',
  DELETE: 'Slettede selskabet',
  DOWNLOAD: 'Downloadede dokument',
}

function ActivityLogSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />
      ))}
    </div>
  )
}

function ActivityLogEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Activity className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Ingen aktivitet endnu</h3>
      <p className="text-xs text-gray-500">Aktivitet registreres automatisk</p>
    </div>
  )
}

export function CompanyActivityLog({ companyId }: CompanyActivityLogProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const result = await getActivityLog({ companyId, limit: 20, offset: 0 })
      setIsLoading(false)
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setEntries(result.data.entries as ActivityLogEntry[])
        setTotal(result.data.total)
      }
    }
    load()
  }, [companyId])

  if (isLoading) {
    return <ActivityLogSkeleton />
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Aktivitetslog</h2>
        {total > 0 && (
          <p className="text-sm text-gray-500">{total} hændelser</p>
        )}
      </div>

      {entries.length === 0 ? (
        <ActivityLogEmpty />
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-gray-50"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50">
                <Activity className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}