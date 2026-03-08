'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, useCallback } from 'react'
import { deletePerson } from '@/actions/persons'
import { toast } from 'sonner'
import type { PersonSummary } from '@/types/person'

interface PersonListProps {
  persons: PersonSummary[]
  total: number
  currentPage: number
  pageSize: number
  search: string
}

const COMMON_ROLES: Record<string, string> = {
  direktør: 'Direktør',
  bestyrelsesmedlem: 'Bestyrelsesmedlem',
  ansat: 'Ansat',
  revisor: 'Revisor',
  ejer: 'Ejer',
}

export default function PersonList({
  persons,
  total,
  currentPage,
  pageSize,
  search,
}: PersonListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [localSearch, setLocalSearch] = useState(search)

  const totalPages = Math.ceil(total / pageSize)

  const handleSearch = useCallback(
    (value: string) => {
      setLocalSearch(value)
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('search', value)
      } else {
        params.delete('search')
      }
      params.set('page', '1')
      router.push(`/persons?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`/persons?${params.toString()}`)
  }

  const handleDelete = async (personId: string, name: string) => {
    if (!confirm(`Er du sikker på, at du vil slette ${name}? Denne handling kan ikke fortrydes.`)) {
      return
    }

    setDeletingId(personId)
    startTransition(async () => {
      const result = await deletePerson({ personId })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${name} er slettet`)
        router.refresh()
      }
      setDeletingId(null)
    })
  }

  if (persons.length === 0 && !search) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
        <div className="mb-4 text-4xl">👥</div>
        <h3 className="text-lg font-medium text-gray-900">Ingen personer endnu</h3>
        <p className="mt-1 text-sm text-gray-500">
          Opret den første person i din kontaktbog eller importer fra Outlook.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Søgefelt */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="search"
            placeholder="Søg på navn eller e-mail..."
            value={localSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <p className="shrink-0 text-sm text-gray-500">
          {total} {total === 1 ? 'person' : 'personer'}
        </p>
      </div>

      {/* Ingen resultater ved søgning */}
      {persons.length === 0 && search && (
        <div className="rounded-lg border border-gray-200 py-12 text-center">
          <p className="text-gray-500">Ingen personer matcher &quot;{search}&quot;</p>
          <button
            onClick={() => handleSearch('')}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Ryd søgning
          </button>
        </div>
      )}

      {/* Personliste */}
      {persons.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Navn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  E-mail
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Telefon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Roller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Selskaber
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Handlinger</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {persons.map((person) => (
                <tr
                  key={person.id}
                  className="transition-colors hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link
                      href={`/persons/${person.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {person.firstName} {person.lastName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {person.email ? (
                      <a
                        href={`mailto:${person.email}`}
                        className="hover:text-blue-600"
                      >
                        {person.email}
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {person.phone ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {person.roles.slice(0, 3).map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                        >
                          {COMMON_ROLES[role] ?? role}
                        </span>
                      ))}
                      {person.roles.length > 3 && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          +{person.roles.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {person.companyCount}{' '}
                    {person.companyCount === 1 ? 'selskab' : 'selskaber'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/persons/${person.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Se profil
                      </Link>
                      <button
                        onClick={() =>
                          handleDelete(
                            person.id,
                            `${person.firstName} ${person.lastName}`
                          )
                        }
                        disabled={deletingId === person.id || isPending}
                        className="text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === person.id ? 'Sletter...' : 'Slet'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Side {currentPage} af {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Forrige
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum =
                Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`rounded-lg border px-3 py-1 text-sm ${
                    pageNum === currentPage
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Næste
            </button>
          </div>
        </div>
      )}
    </div>
  )
}