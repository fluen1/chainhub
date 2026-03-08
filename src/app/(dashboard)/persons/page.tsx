import { Suspense } from 'react'
import { Metadata } from 'next'
import { PersonList } from '@/components/persons/PersonList'
import { PersonListSkeleton } from '@/components/persons/PersonListSkeleton'
import { PersonListHeader } from '@/components/persons/PersonListHeader'

export const metadata: Metadata = {
  title: 'Persondatabase | ChainHub',
  description: 'Global kontaktbog med personer og deres roller på tværs af selskaber',
}

interface PersonsPageProps {
  searchParams: {
    query?: string
    companyId?: string
    role?: string
  }
}

export default function PersonsPage({ searchParams }: PersonsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PersonListHeader />
      
      <Suspense fallback={<PersonListSkeleton />}>
        <PersonList searchParams={searchParams} />
      </Suspense>
    </div>
  )
}