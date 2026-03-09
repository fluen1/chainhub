import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCompany } from '@/actions/companies'
import { CompanyProfileSkeleton } from '@/components/companies/CompanyProfileSkeleton'
import { CompanyProfile } from '@/components/companies/CompanyProfile'

export async function generateMetadata({ params }: { params: { id: string } }) {
  return {
    title: 'Selskabsprofil — ChainHub',
  }
}

async function CompanyProfileLoader({ id }: { id: string }) {
  const result = await getCompany({ companyId: id })

  if (result.error === 'Selskabet blev ikke fundet') {
    notFound()
  }

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {result.error}
      </div>
    )
  }

  return <CompanyProfile company={result.data!} />
}

export default async function CompanyProfilePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <Suspense fallback={<CompanyProfileSkeleton />}>
      <CompanyProfileLoader id={params.id} />
    </Suspense>
  )
}