'use client'

import { useState } from 'react'
import { ContractStatus } from '@prisma/client'
import { updateContractStatus } from '@/actions/contracts'
import { VALID_STATUS_TRANSITIONS } from '@/lib/validations/contract'
import { ContractStatusBadge } from './ContractStatusBadge'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Loader2 } from 'lucide-react'

interface ContractStatusSelectProps {
  contractId: string
  currentStatus: ContractStatus
  canEdit: boolean
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  UDKAST: 'Udkast',
  TIL_REVIEW: 'Til review',
  TIL_UNDERSKRIFT: 'Til underskrift',
  AKTIV: 'Aktiv',
  UDLOEBET: 'Udløbet',
  OPSAGT: 'Opsagt',
  FORNYET: 'Fornyet',
  ARKIVERET: 'Arkiveret',
}

export function ContractStatusSelect({
  contractId,
  currentStatus,
  canEdit,
}: ContractStatusSelectProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] ?? []

  const handleStatusChange = async (newStatus: ContractStatus) => {
    setIsUpdating(true)

    try {
      const result = await updateContractStatus({
        id: contractId,
        status: newStatus,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(`Status ændret til ${STATUS_LABELS[newStatus]}`)
    } catch {
      toast.error('Status kunne ikke ændres — prøv igen')
    } finally {
      setIsUpdating(false)
    }
  }

  if (!canEdit || validTransitions.length === 0) {
    return <ContractStatusBadge status={currentStatus} />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isUpdating}>
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ContractStatusBadge status={currentStatus} className="mr-2" />
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {validTransitions.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleStatusChange(status)}
          >
            <ContractStatusBadge status={status} className="mr-2" />
            {STATUS_LABELS[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}