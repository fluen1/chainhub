import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CreateCaseForm } from '@/components/cases/CreateCaseForm'
import { Suspense } from 'react'

export default async function NewCasePage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-gray-500">
          Indlæser...
        </div>
      }
    >
      <CreateCaseForm />
    </Suspense>
  )
}
