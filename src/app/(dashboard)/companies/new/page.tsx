import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { CreateCompanyForm } from '@/components/companies/CreateCompanyForm'

export const metadata = {
  title: 'Opret selskab — ChainHub',
}

export default async function NewCompanyPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Opret selskab</h1>
        <p className="mt-1 text-sm text-gray-500">
          Udfyld stamdata for det nye selskab
        </p>
      </div>
      <CreateCompanyForm />
    </div>
  )
}