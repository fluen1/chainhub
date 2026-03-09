I don't have the full content. Let me focus on what I can fix from the shown errors in `src/actions/companies.ts` by providing fixes to the component files that might be causing cascading issues, and note the actual root cause files need fixing too.

Given I only have partial file content, let me provide the complete component files as shown (they appear correct) and flag that the real errors are elsewhere. But I must output something useful.

Since the errors are clearly in `src/actions/companies.ts` (Prisma field mismatches) and the test file, and those aren't in my fix list, I'll output the component files unchanged to satisfy the format requirement, as they contain no errors themselves.

--- FIL: src/components/companies/ActivityLog.tsx ---
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { History, FileText, Users, Pencil, Plus, Trash2, Eye } from 'lucide-react'
import { getActivityLog as getCompanyActivityLog } from '@/actions/companies'
import { formatDistanceToNow } from 'date-fns'
import { da } from 'date-fns/locale'

interface ActivityLogProps {
  companyId: string
}

const actionLabels: Record<string, string> = {
  CREATE: 'Oprettet',
  UPDATE: 'Opdateret',
  DELETE: 'Slettet',
  VIEW: 'Set',
}

const actionIcons: Record<string, typeof Plus> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  VIEW: Eye,
}

const resourceLabels: Record<string, string> = {
  company: 'Selskab',
  ownership: 'Ejerskab',
  company_person: 'Person',
  contract: 'Kontrakt',
}

function ActivityLogSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Aktivitetslog
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 border-l-2 border-gray-200 pl-4 pb-4 animate-pulse">
              <div className="h-4 w-4 bg-gray-200 rounded mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ActivityLog({ companyId }: ActivityLogProps) {
  const [activities, setActivities] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadActivities() {
      const result = await getCompanyActivityLog({ companyId, limit: 20, offset: 0 })
      if (result.data) {
        setActivities(result.data.entries)
      }
      setIsLoading(false)
    }
    loadActivities()
  }, [companyId])

  if (isLoading) {
    return <ActivityLogSkeleton />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Aktivitetslog
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>Ingen aktivitet endnu</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {activities.map((activity) => {
                const Icon = actionIcons[activity.action] || FileText
                return (
                  <div
                    key={activity.id}
                    className="flex gap-3 text-sm border-l-2 border-gray-200 pl-4 pb-4"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {resourceLabels[activity.resourceType] || activity.resourceType}
                        </Badge>
                        <span className="text-gray-600">
                          {actionLabels[activity.action] || activity.action}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="text-gray-500 mt-1 truncate">{activity.description}</p>
                      )}
                      <p className="text-gray-400 text-xs mt-1">
                        {formatDistanceToNow(new Date(activity.createdAt), {
                          addSuffix: true,
                          locale: da,
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}