import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { CreateTaskForm } from '@/components/tasks/CreateTaskForm'
import { auth } from '@/lib/auth'

export const metadata: Metadata = { title: 'Ny opgave' }

export default async function NewTaskPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Indlæser...</div>}>
      <CreateTaskForm />
    </Suspense>
  )
}
