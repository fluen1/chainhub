import { notFound } from 'next/navigation'
import { getCompany } from '@/actions/companies'
import { CompanyForm } from '@/components/companies/CompanyForm'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const result = await getCompany(params.id)
  if (result.error) {
    return { title: 'Selskab ikke fundet | ChainHub' }
  }
  return { title: `Rediger ${result.data.name} | ChainHub` }
}

export default async function EditCompanyPage({ params }: PageProps) {
  const result = await getCompany(params.id)

  if (result.error) {
    return notFound()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <CompanyForm company={result.data} mode="edit" />
    </div>
  )
}