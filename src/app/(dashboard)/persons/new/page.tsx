import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { CreatePersonForm } from '@/components/persons/CreatePersonForm'
import { auth } from '@/lib/auth'

export const metadata: Metadata = { title: 'Ny person' }

export default async function NewPersonPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Indlæser...</div>}>
      <CreatePersonForm />
    </Suspense>
  )
}
