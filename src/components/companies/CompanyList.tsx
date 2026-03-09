'use client'

import { CompanyWithCounts } from '@/types/company'
import { CompanyCard } from './CompanyCard'
import { Building2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface CompanyListProps {
  companies: CompanyWithCounts[]
  isLoading?: boolean
}

function CompanyCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
      <div className="h-5 w-3/4 rounded bg-gray-200 mb-3" />
      <div className="h-4 w-1/2 rounded bg-gray-100 mb-2" />
      <div className="h-4 w-1/3 rounded bg-gray-100" />
    </div>
  )
}

export function CompanyList({ companies, isLoading }: CompanyListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CompanyCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (companies.length === 0) {
    return <CompanyListEmpty />
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <CompanyCard key={company.id} company={company} />
      ))}
    </div>
  )
}

export function CompanyListEmpty() {
  return (
    <div className="text-center py-12 border-2 border-dashed rounded-lg">
      <Building2 className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-4 text-lg font-semibold text-gray-900">
        Ingen selskaber endnu
      </h3>
      <p className="mt-2 text-sm text-gray-500">
        Kom i gang ved at oprette dit første selskab
      </p>
      <div className="mt-6">
        <Link href="/companies/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Opret selskab
          </Button>
        </Link>
      </div>
    </div>
  )
}