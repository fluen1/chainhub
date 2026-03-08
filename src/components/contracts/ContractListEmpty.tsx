'use client'

import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ContractListEmptyProps {
  companyId?: string
}

export function ContractListEmpty({ companyId }: ContractListEmptyProps) {
  const href = companyId 
    ? `/contracts/new?companyId=${companyId}`
    : '/contracts/new'

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Ingen kontrakter endnu</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Opret din første kontrakt for at holde styr på aftaler, deadlines og dokumenter.
      </p>
      <Button asChild>
        <Link href={href}>
          <Plus className="mr-2 h-4 w-4" />
          Opret kontrakt
        </Link>
      </Button>
    </div>
  )
}