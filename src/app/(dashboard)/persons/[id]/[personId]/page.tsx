import { notFound } from 'next/navigation'
import { getPerson } from '@/actions/persons'
import PersonProfile from '@/components/persons/PersonProfile'
import PersonCompanyList from '@/components/persons/PersonCompanyList'
import AddPersonToCompanyForm from '@/components/persons/AddPersonToCompanyForm'
import { auth } from '@/lib/auth'

export const metadata = {
  title: 'Personprofil — ChainHub',
}

interface PageProps {
  params: Promise<{ personId: string }>
}

export default async function PersonDetailPage({ params }: PageProps) {
  const { personId } = await params
  const session = await auth()

  if (!session?.user) {
    return null
  }

  const result = await getPerson({ personId })

  if (result.error) {
    if (result.error === 'Personen blev ikke fundet') {
      notFound()
    }
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{result.error}</p>
      </div>
    )
  }

  const person = result.data!

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {person.firstName} {person.lastName}
          </h1>
          <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
            {person.email && (
              <span>{person.email}</span>
            )}
            {person.phone && (
              <span>{person.phone}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {person._count.companyPersons}{' '}
            {person._count.companyPersons === 1 ? 'selskab' : 'selskaber'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Venstre: Profil */}
        <div className="lg:col-span-1">
          <PersonProfile person={person} />
        </div>

        {/* Højre: Selskaber og roller */}
        <div className="space-y-6 lg:col-span-2">
          <PersonCompanyList
            companyPersons={person.companyPersons}
            personId={person.id}
          />
          <AddPersonToCompanyForm personId={person.id} />
        </div>
      </div>
    </div>
  )
}