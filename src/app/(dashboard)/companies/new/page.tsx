import { CompanyForm } from '@/components/companies/CompanyForm'

export const metadata = {
  title: 'Opret selskab | ChainHub',
}

export default function NewCompanyPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <CompanyForm mode="create" />
    </div>
  )
}