import { redirect } from 'next/navigation'

// Selskabsprofil starter nu med overbliksfanen
// Redirect fra /companies/[id] → /companies/[id]/overview
interface CompanyPageProps {
  params: { id: string }
}

export default function CompanyRootPage({ params }: CompanyPageProps) {
  redirect(`/companies/${params.id}/overview`)
}
