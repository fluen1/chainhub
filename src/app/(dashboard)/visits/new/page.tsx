import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CreateVisitForm } from '@/components/visits/CreateVisitForm'
import { Suspense } from 'react'
import { getVisitNewPageCompanies } from '@/actions/visits'

export const metadata: Metadata = { title: 'Planlæg besøg' }

export default async function NewVisitPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const companies = await getVisitNewPageCompanies()

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Indlæser...</div>}>
      <CreateVisitForm companies={companies} />
    </Suspense>
  )
}
