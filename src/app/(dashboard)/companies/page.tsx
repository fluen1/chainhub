import { Suspense } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { listCompanies } from '@/actions/companies'
import { CompanyListSkeleton } from '@/components/companies/CompanyListSkeleton'
import { CompanyCard } from '@/components/companies/CompanyCard'
import { CompanyListEmpty } from '@/components/companies/CompanyListEmpty'
import { CreateCompanyButton } from '@/components/companies/CreateCompanyButton'

export const metadata = {
  title: 'Selskaber — ChainHub',
}

async function CompanyList() {
  const result = await listCompanies()

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {result.error}
      </div>
    )
  }

  const companies = result.data

  if (companies.length === 0) {
    return <CompanyListEmpty />
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <CompanyCard key={company.id} company={company} />
      ))}
    </div>
  )
}

export default async function CompaniesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Selskaber</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrer dine selskaber, ejerskab og governance
          </p>
        </div>
        <CreateCompanyButton />
      </div>

      <Suspense fallback={<CompanyListSkeleton />}>
        <CompanyList />
      </Suspense>
    </div>
  )
}