import { listPersons } from '@/actions/persons'
import { PersonCard } from './PersonCard'
import { PersonListEmpty } from './PersonListEmpty'
import { PersonSearch } from './PersonSearch'

interface PersonListProps {
  searchParams: {
    query?: string
    companyId?: string
    role?: string
  }
}

export async function PersonList({ searchParams }: PersonListProps) {
  const result = await listPersons({
    query: searchParams.query,
    companyId: searchParams.companyId,
    role: searchParams.role,
    limit: 50,
    offset: 0,
  })

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{result.error}</p>
      </div>
    )
  }

  const persons = result.data || []

  return (
    <div className="flex flex-col gap-4">
      <PersonSearch
        initialQuery={searchParams.query}
        initialRole={searchParams.role}
      />

      {persons.length === 0 ? (
        <PersonListEmpty hasFilters={!!(searchParams.query || searchParams.role)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {persons.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}

      {persons.length > 0 && (
        <p className="text-sm text-gray-500 text-center">
          Viser {persons.length} {persons.length === 1 ? 'person' : 'personer'}
        </p>
      )}
    </div>
  )
}