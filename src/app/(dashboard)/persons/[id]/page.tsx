import { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PersonDetail } from '@/components/persons/PersonDetail'
import { PersonDetailSkeleton } from '@/components/persons/PersonDetailSkeleton'
import { getPerson } from '@/actions/persons'

interface PersonPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
  const { id } = await params
  const result = await getPerson({ personId: id })

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

export default async function PersonPage({ params }: PersonPageProps) {
  const { id } = await params
  return (
    <Suspense fallback={<PersonDetailSkeleton />}>
      <PersonDetailWrapper id={id} />
    </Suspense>
  )
}

async function PersonDetailWrapper({ id }: { id: string }) {
  const result = await getPerson({ personId: id })

  if (result.error || !result.data) {
    notFound()
  }

  return <PersonDetail person={result.data!} />
}