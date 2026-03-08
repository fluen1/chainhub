import { Suspense } from 'react'
import { listCompanies } from '@/actions/companies'
import { CompanyList } from '@/components/companies/CompanyList'
import { CompanyCardSkeleton } from '@/components/companies/CompanyCard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Selskaber | ChainHub',
}

async function CompaniesContent() {
  const result = await listCompanies()

  if (result.error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{result.error}</p>
      </div>
    )
  }

  return <CompanyList companies={result.data} />
}

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Selskaber</h1>
          <p className="text-gray-500">
            Oversigt over alle selskaber i din portefølje
          </p>
        </div>
        <Link href="/companies/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Opret selskab
          </Button>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CompanyCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <CompaniesContent />
      </Suspense>
    </div>
  )
}