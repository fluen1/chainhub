'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPerson } from '@/actions/persons'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export function CreatePersonForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await createPerson({
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      notes: formData.get('notes') as string,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.data) {
      toast.success('Person oprettet')
      router.push(`/persons/${result.data.id}`)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/persons" className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Opret person</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
              Fornavn *
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Philip"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
              Efternavn *
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Larsen"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="philip@eksempel.dk"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Telefon
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="+45 12 34 56 78"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Interne noter
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Interne noter om denne person..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/persons"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annullér
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Opretter...' : 'Opret person'}
          </button>
        </div>
      </form>
    </div>
  )
}
