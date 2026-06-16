import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { CreateCaseForm } from '@/components/cases/CreateCaseForm'
import { auth } from '@/lib/auth'

export const metadata: Metadata = { title: 'Ny sag' }

export default async function NewCasePage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Indlæser...</div>}>
      <CreateCaseForm />
    </Suspense>
  )
}
