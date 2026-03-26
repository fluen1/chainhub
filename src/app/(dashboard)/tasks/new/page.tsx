import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CreateTaskForm } from '@/components/tasks/CreateTaskForm'
import { Suspense } from 'react'

export default async function NewTaskPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-gray-500">
          Indlæser...
        </div>
      }
    >
      <CreateTaskForm />
    </Suspense>
  )
}
