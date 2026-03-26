import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessModule } from '@/lib/permissions'
import { CreateCompanyForm } from '@/components/companies/CreateCompanyForm'

export default async function NewCompanyPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) redirect('/companies')

  return <CreateCompanyForm />
}
