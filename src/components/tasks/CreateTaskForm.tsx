'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createTask } from '@/actions/tasks'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export function CreateTaskForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCaseId = searchParams.get('caseId') ?? ''

  const [loading, setLoading] = useState(false)
  const [cases, setCases] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    // Hent sager til dropdown
    fetch('/api/cases-list')
      .then((r) => r.json())
      .then((data) => setCases(data.cases ?? []))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await createTask({
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      dueDate: formData.get('dueDate') as string || undefined,
      priority: (formData.get('priority') as 'LAV' | 'MELLEM' | 'HOEJ' | 'KRITISK') ?? 'MELLEM',
      caseId: formData.get('caseId') as string || undefined,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Opgave oprettet')
    router.push('/tasks')
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tasks" className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Ny opgave</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700">Titel *</label>
          <input
            name="title"
            type="text"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="fx Gennemgå lejekontrakt inden fornyelse"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Beskrivelse</label>
          <textarea
            name="description"
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Deadline</label>
            <input
              name="dueDate"
              type="date"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Prioritet</label>
            <select
              name="priority"
              defaultValue="MELLEM"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="LAV">Lav</option>
              <option value="MELLEM">Mellem</option>
              <option value="HOEJ">Høj</option>
              <option value="KRITISK">Kritisk</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Tilknyt til sag</label>
          <select
            name="caseId"
            defaultValue={preselectedCaseId}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Ingen sag</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/tasks"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annullér
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Opretter...' : 'Opret opgave'}
          </button>
        </div>
      </form>
    </div>
  )
}
