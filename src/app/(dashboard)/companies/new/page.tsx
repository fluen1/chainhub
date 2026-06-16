import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CreateCompanyForm } from '@/components/companies/CreateCompanyForm'
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Nyt selskab' }

export default async function NewCompanyPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'companies', session.user.organizationId)
  if (!hasAccess) redirect('/companies')

  return <CreateCompanyForm />
}
