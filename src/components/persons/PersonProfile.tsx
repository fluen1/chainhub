'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePerson } from '@/actions/persons'
import { toast } from 'sonner'
import type { PersonWithCompanies } from '@/types/person'

interface PersonProfileProps {
  person: PersonWithCompanies
}

export default function PersonProfile({ person }: PersonProfileProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email ?? '',
    phone: person.phone ?? '',
    notes: person.notes ?? '',
  })

  const handleSave = () => {
    startTransition(async () => {
      const result = await updatePerson({
        personId: person.id,
        ...form,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Personens oplysninger er opdateret')
        setIsEditing(false)
        router.refresh()
      }
    })
  }

  const handleCancel = () => {
    setForm({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email ?? '',
      phone: person.phone ?? '',
      notes: person.notes ?? '',
    })
    setIsEditing(false)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Stamoplysninger</h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Rediger
          </button>
        )}
      </div>

      <div className="space-y-4 p-4">
        {isEditing ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Fornavn
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Efternavn
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500">
                E-mail
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500">
                Telefon
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500">
                Notater
              </label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={4}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Gemmer...' : 'Gem ændringer'}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuller
              </button>
            </div>
          </>
        ) : (
          <>
            <InfoRow label="Fornavn" value={person.firstName} />
            <InfoRow label="Efternavn" value={person.lastName} />
            <InfoRow
              label="E-mail"
              value={
                person.email ? (
                  <a
                    href={`mailto:${person.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {person.email}
                  </a>
                ) : null
              }
            />
            <InfoRow label="Telefon" value={person.phone} />

            {person.microsoftContactId && (
              <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <span>🔗</span>
                <span>Synkroniseret fra Outlook</span>
              </div>
            )}

            {person.notes && (
              <div>
                <p className="text-xs font-medium text-gray-500">Notater</p>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                  {person.notes}
                </p>
              </div>
            )}

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400">
                Oprettet{' '}
                {new Date(person.createdAt).toLocaleDateString('da-DK', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode | null | undefined
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm text-gray-900">
        {value ?? <span className="text-gray-300">Ikke angivet</span>}
      </p>
    </div>
  )
}