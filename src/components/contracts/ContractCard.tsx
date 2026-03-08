'use client'

import Link from 'next/link'
import { Contract, Company, ContractSystemType, ContractStatus, SensitivityLevel } from '@prisma/client'
import { ContractStatusBadge } from './ContractStatusBadge'
import { ContractSensitivityBadge } from './ContractSensitivityBadge'
import { ContractTypeBadge } from './ContractTypeBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Calendar, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

interface ContractCardProps {
  contract: Contract & {
    company: Company
    _count?: {
      parties: number
      versions: number
      attachments: number
    }
  }
}

export function ContractCard({ contract }: ContractCardProps) {
  return (
    <Link href={`/contracts/${contract.id}`}>
      <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-medium line-clamp-1">
              {contract.displayName}
            </CardTitle>
            <ContractStatusBadge status={contract.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <ContractTypeBadge systemType={contract.systemType} />
            <ContractSensitivityBadge sensitivity={contract.sensitivity} showIcon={false} />
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="line-clamp-1">{contract.company.name}</span>
          </div>

          {(contract.effectiveDate || contract.expiryDate) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {contract.effectiveDate 
                  ? format(new Date(contract.effectiveDate), 'dd. MMM yyyy', { locale: da })
                  : '–'
                }
                {' → '}
                {contract.expiryDate 
                  ? format(new Date(contract.expiryDate), 'dd. MMM yyyy', { locale: da })
                  : 'Løbende'
                }
              </span>
            </div>
          )}

          {contract._count && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {contract._count.versions} version{contract._count.versions !== 1 ? 'er' : ''}
              </span>
              <span>
                {contract._count.parties} part{contract._count.parties !== 1 ? 'er' : ''}
              </span>
              <span>
                {contract._count.attachments} bilag
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export function ContractCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="h-5 bg-gray-200 rounded w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <div className="h-5 bg-gray-200 rounded w-24" />
          <div className="h-5 bg-gray-200 rounded w-20" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </CardContent>
    </Card>
  )
}