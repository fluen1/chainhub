'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCaseStatus, deleteCase } from '@/actions/cases'
import { CaseStatusBadge } from './CaseStatusBadge'
import { CaseTypeBadge } from './CaseTypeBadge'
import { CaseTaskList } from './CaseTaskList'
import { CaseDeadlineList } from './CaseDeadlineList'
import { CaseCompanyList } from './CaseCompanyList'
import { CaseContractList } from './CaseContractList'
import { CasePersonList } from './CasePersonList'
import { CaseEmailSync } from './CaseEmailSync'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'
import { TrashIcon, CalendarIcon, UserIcon } from 'lucide-react'
import type { CaseWithRelations } from '@/types/case'
import {
  CASE_TYPE_LABELS,
  CASE_STATUS_LABELS,
  CASE_SUBTYPE_LABELS,
  VALID_CASE_STATUS_TRANSITIONS,
} from '@/types/case'
import type { CaseStatus } from '@prisma/client'

interface CaseDetailClientProps {
  caseData: CaseWithRelations
}

export function CaseDetailClient({ caseData }: CaseDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStatus, setCurrentStatus] = useState(caseData.status)

  const validNextStatuses = VALID_CASE_STATUS_TRANSITIONS[currentStatus]

  function handleStatusChange(newStatus: string) {
    startTransition(async () => {
      const result = await updateCaseStatus({
        caseId: caseData.id,
        newStatus: newStatus as CaseStatus,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCurrentStatus(newStatus as CaseStatus)
      toast.success(`Sagsstatus ændret til ${CASE_STATUS_LABELS[newStatus as CaseStatus]}`)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCase({ caseId: caseData.id })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Sagen er slettet')
      router.push('/cases')
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{caseData.title}</h1>
            <CaseStatusBadge status={currentStatus} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <CaseTypeBadge caseType={caseData.caseType} />
            {caseData.caseSubtype && (
              <span className="text-gray-400">
                {CASE_SUBTYPE_LABELS[caseData.caseSubtype] ?? caseData.caseSubtype}
              </span>
            )}
            {caseData.dueDate && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" />
                Frist:{' '}
                {format(new Date(caseData.dueDate), 'd. MMMM yyyy', { locale: da })}
              </span>
            )}
            {caseData.responsibleId && (
              <span className="flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5" />
                Ansvarlig
              </span>
            )}
          </div>
          {caseData.description && (
            <p className="mt-3 text-sm text-gray-600">{caseData.description}</p>
          )}
        </div>

        {/* Handlinger */}
        <div className="ml-6 flex shrink-0 items-center gap-2">
          {/* Status-skift */}
          {validNextStatuses.length > 0 && (
            <Select onValueChange={handleStatusChange} disabled={isPending}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Skift status" />
              </SelectTrigger>
              <SelectContent>
                {validNextStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    → {CASE_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Slet sag */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" disabled={isPending}>
                <TrashIcon className="h-4 w-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Slet sag</AlertDialogTitle>
                <AlertDialogDescription>
                  Er du sikker på, at du vil slette sagen &quot;{caseData.title}&quot;? Denne
                  handling kan ikke fortrydes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuller</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Slet sag
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="oversigt">
        <TabsList>
          <TabsTrigger value="oversigt">Oversigt</TabsTrigger>
          <TabsTrigger value="opgaver">
            Opgaver
            {caseData._count.tasks > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                {caseData._count.tasks}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="frister">
            Frister
            {caseData._count.deadlines > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                {caseData._count.deadlines}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tilknytninger">Tilknytninger</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="oversigt" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Stats */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-700">Opgaver</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {caseData._count.tasks}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-700">Frister</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {caseData._count.deadlines}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-700">Dokumenter</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {caseData._count.documents}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="opgaver" className="mt-4">
          <CaseTaskList caseId={caseData.id} initialTasks={caseData.tasks} />
        </TabsContent>

        <TabsContent value="frister" className="mt-4">
          <CaseDeadlineList caseId={caseData.id} initialDeadlines={caseData.deadlines} />
        </TabsContent>

        <TabsContent value="tilknytninger" className="mt-4 space-y-6">
          <CaseCompanyList
            caseId={caseData.id}
            initialCompanies={caseData.caseCompanies}
          />
          <CaseContractList
            caseId={caseData.id}
            initialContracts={caseData.caseContracts}
          />
          <CasePersonList
            caseId={caseData.id}
            initialPersons={caseData.casePersons}
          />
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <CaseEmailSync caseId={caseData.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}