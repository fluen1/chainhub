'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updatePerson } from '@/actions/persons'
import { BModal, BTextField, BTextareaField } from '@/components/ui/b'

// ─────────────────────────────────────────────────────────────────────────────
// EditPersonDialog — BModal til redigering af persondata.
// Erstatter href-links der pegede på /persons/[id]/edit (404).
// ─────────────────────────────────────────────────────────────────────────────

interface EditPersonDialogProps {
  open: boolean
  onClose: () => void
  person: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    notes: string | null
  }
}

export function EditPersonDialog({ open, onClose, person }: EditPersonDialogProps) {
  const [firstName, setFirstName] = useState(person.firstName)
  const [lastName, setLastName] = useState(person.lastName)
  const [email, setEmail] = useState(person.email ?? '')
  const [phone, setPhone] = useState(person.phone ?? '')
  const [notes, setNotes] = useState(person.notes ?? '')
  const [submitting, startSubmit] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isValid = firstName.trim().length > 0 && lastName.trim().length > 0

  function handleSubmit() {
    setError(null)
    startSubmit(async () => {
      const result = await updatePerson({
        personId: person.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      })

      if ('error' in result) {
        const msg = result.error ?? 'Ukendt fejl'
        setError(msg)
        toast.error(msg)
        return
      }

      toast.success('Persondata opdateret')
      onClose()
    })
  }

  return (
    <BModal
      open={open}
      onClose={onClose}
      title="Rediger person"
      subtitle={`${person.firstName} ${person.lastName}`}
      onSubmit={handleSubmit}
      submitLabel="Gem ændringer"
      submitDisabled={!isValid}
      submitting={submitting}
    >
      {/* 2-col fornavn + efternavn */}
      <div className="grid grid-cols-2 gap-3">
        <BTextField
          label="Fornavn"
          value={firstName}
          onChange={setFirstName}
          placeholder="Fornavn"
          required
          // eslint-disable-next-line jsx-a11y/no-autofocus -- modaler skal fokusere første felt
          autoFocus
        />
        <BTextField
          label="Efternavn"
          value={lastName}
          onChange={setLastName}
          placeholder="Efternavn"
          required
        />
      </div>

      <BTextField
        label="E-mail"
        value={email}
        onChange={setEmail}
        placeholder="navn@selskab.dk"
        type="email"
      />

      <BTextField
        label="Telefon"
        value={phone}
        onChange={setPhone}
        placeholder="+45 00 00 00 00"
        type="tel"
      />

      <BTextareaField
        label="Noter"
        value={notes}
        onChange={setNotes}
        placeholder="Interne noter om personen..."
        rows={3}
      />

      {error && (
        <p className="rounded-[4px] border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
          {error}
        </p>
      )}
    </BModal>
  )
}
