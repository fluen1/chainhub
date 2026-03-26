import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CreateContractForm } from '@/components/contracts/CreateContractForm'
import { Suspense } from 'react'

export default async function NewContractPage() {
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
      <CreateContractForm />
    </Suspense>
  )
}
