'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPerson } from '@/actions/persons'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Panel,
  BButton,
  BTextField,
  BTextareaField,
  BFieldRow,
  Breadcrumb,
} from '@/components/ui/b'

// ─────────────────────────────────────────────────────────────────────────────
// CreatePersonForm — B-stil port. Felter: firstName, lastName, email, phone, notes.
// ─────────────────────────────────────────────────────────────────────────────

export function CreatePersonForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  const [firstNameError, setFirstNameError] = useState<string | null>(null)
  const [lastNameError, setLastNameError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    let hasError = false
    if (!firstName.trim()) {
      setFirstNameError('Fornavn er påkrævet')
      hasError = true
    }
    if (!lastName.trim()) {
      setLastNameError('Efternavn er påkrævet')
      hasError = true
    }
    if (hasError) return

    setLoading(true)

    const result = await createPerson({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
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
    <div className="mx-auto max-w-3xl space-y-3">
      <Breadcrumb trail={[{ label: 'Personer', href: '/persons' }]} current="Ny person" />

      <div className="flex items-center gap-2">
        <Link href="/persons" className="rounded-[4px] p-1 hover:bg-[#f6f8fa]">
          <ArrowLeft className="h-4 w-4 text-b-2" />
        </Link>
        <span className="text-[16px] font-semibold text-b-1">Opret person</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-3.5 px-4 py-4">
            <BFieldRow>
              <BTextField
                label="Fornavn"
                value={firstName}
                onChange={(v) => {
                  setFirstName(v)
                  if (v.trim()) setFirstNameError(null)
                }}
                required
                placeholder="Philip"
                error={firstNameError}
                autoFocus
                disabled={loading}
              />
              <BTextField
                label="Efternavn"
                value={lastName}
                onChange={(v) => {
                  setLastName(v)
                  if (v.trim()) setLastNameError(null)
                }}
                required
                placeholder="Larsen"
                error={lastNameError}
                disabled={loading}
              />
            </BFieldRow>

            <BFieldRow>
              <BTextField
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                placeholder="philip@eksempel.dk"
                disabled={loading}
              />
              <BTextField
                label="Telefon"
                value={phone}
                onChange={setPhone}
                type="tel"
                placeholder="+45 12 34 56 78"
                disabled={loading}
              />
            </BFieldRow>

            <BTextareaField
              label="Interne noter"
              value={notes}
              onChange={setNotes}
              placeholder="Interne noter om denne person..."
              rows={3}
              disabled={loading}
            />
          </div>
        </Panel>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Link href="/persons">
            <BButton disabled={loading}>Annuller</BButton>
          </Link>
          <BButton
            type="submit"
            primary
            disabled={loading || !firstName.trim() || !lastName.trim()}
          >
            {loading ? 'Opretter...' : 'Opret person'}
          </BButton>
        </div>
      </form>
    </div>
  )
}
