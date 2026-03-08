import { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PersonDetail } from '@/components/persons/PersonDetail'
import { PersonDetailSkeleton } from '@/components/persons/PersonDetailSkeleton'
import { getPerson } from '@/actions/persons'

interface PersonPageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
  const result = await getPerson(params.id)
  
  if (result.error || !result.data) {
    return {
      title: 'Person ikke fundet | ChainHub',
    }
  }

  const person = result.data
  return {
    title: `${person.firstName} ${person.lastName} | ChainHub`,
    description: `Personprofil for ${person.firstName} ${person.lastName}`,
  }
}

export default function PersonPage({ params }: PersonPageProps) {
  return (
    <Suspense fallback={<PersonDetailSkeleton />}>
      <PersonDetailWrapper personId={params.id} />
    </Suspense>
  )
}

async function PersonDetailWrapper({ personId }: { personId: string }) {
  const result = await getPerson(personId)

  if (result.error || !result.data) {
    notFound()
  }

  return <PersonDetail person={result.data} />
}