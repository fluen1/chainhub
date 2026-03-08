'use client'

import Link from 'next/link'
import { Building2, FileText, Briefcase, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CompanyWithCounts } from '@/types/company'

interface CompanyCardProps {
  company: CompanyWithCounts
}

const statusLabels: Record<string, string> = {
  aktiv: 'Aktiv',
  inaktiv: 'Inaktiv',
  under_stiftelse: 'Under stiftelse',
  opløst: 'Opløst',
}

const statusColors: Record<string, string> = {
  aktiv: 'bg-green-100 text-green-800',
  inaktiv: 'bg-gray-100 text-gray-800',
  under_stiftelse: 'bg-yellow-100 text-yellow-800',
  opløst: 'bg-red-100 text-red-800',
}

export function CompanyCard({ company }: CompanyCardProps) {
  return (
    <Link href={`/companies/${company.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-500" />
              <CardTitle className="text-lg">{company.name}</CardTitle>
            </div>
            <Badge className={statusColors[company.status] || 'bg-gray-100'}>
              {statusLabels[company.status] || company.status}
            </Badge>
          </div>
          {company.cvr && (
            <p className="text-sm text-gray-500">CVR: {company.cvr}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{company._count.contracts} kontrakter</span>
            </div>
            <div className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              <span>{company._count.caseCompanies} sager</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{company._count.companyPersons} personer</span>
            </div>
          </div>
          {company.city && (
            <p className="text-sm text-gray-500 mt-2">
              {company.postalCode} {company.city}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export function CompanyCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}