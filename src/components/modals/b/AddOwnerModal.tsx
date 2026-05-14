'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  BModal,
  BTextField,
  BTextareaField,
  BSegmentedField,
  BFieldWrap,
  BFieldRow,
} from '@/components/ui/b'
import { addOwner } from '@/actions/ownership'

// ────────────────────────────────────────────────────────────────────────────
// AddOwnerModal — canonical B-stil modal.
// Wired til addOwner-action. Live pct-bar viser fordeling EFTER tilføjelse.
//
// Brug:
//   <AddOwnerModal
//     open={open}
//     onClose={() => setOpen(false)}
//     companyId={company.id}
//     companyName={company.name}
//     existingOwners={[{ name: 'Lars Hansen', pct: 49, type: 'person' }, ...]}
//     persons={[{ id, firstName, lastName, email }]}
//   />
// ────────────────────────────────────────────────────────────────────────────

export interface ExistingOwner {
  name: string
  pct: number
  type: 'person' | 'holding' | 'company'
}

export interface PersonOption {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

type OwnerType = 'PERSON' | 'HOLDINGSELSKAB' | 'ANDET_SELSKAB'

const OWNER_TYPE_OPTS: Array<{ value: OwnerType; label: string }> = [
  { value: 'PERSON', label: 'Person' },
  { value: 'HOLDINGSELSKAB', label: 'Holding' },
  { value: 'ANDET_SELSKAB', label: 'Andet selskab' },
]

export function AddOwnerModal({
  open,
  onClose,
  companyId,
  companyName,
  existingOwners,
  persons,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  companyName: string
  existingOwners: ExistingOwner[]
  persons: PersonOption[]
}) {
  const router = useRouter()
  const [ownerType, setOwnerType] = useState<OwnerType>('PERSON')
  const [personId, setPersonId] = useState<string>('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [personEmail, setPersonEmail] = useState('')
  const [createNew, setCreateNew] = useState(false)
  const [pctInput, setPctInput] = useState('')
  const [acquiredAt, setAcquiredAt] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [submitting, startTransition] = useTransition()

  const pct = Number(pctInput.replace(',', '.')) || 0
  const existingTotal = existingOwners.reduce((sum, o) => sum + o.pct, 0)
  const newTotal = existingTotal + pct
  const overAllocated = newTotal > 100

  // Live preview: hvor mange % er allerede allokeret + den nye andel.
  // Visualisering ligger op til design (linje med to fyld-farver).
  const fillExisting = Math.min(100, existingTotal)
  const fillNew = Math.max(0, Math.min(100 - fillExisting, pct))

  const personLabel = useMemo(() => {
    if (createNew) return 'Opretter ny person'
    const p = persons.find((x) => x.id === personId)
    return p ? `${p.firstName} ${p.lastName}` : ''
  }, [createNew, personId, persons])

  const personFieldValid = createNew
    ? firstName.trim().length > 0 && lastName.trim().length > 0
    : personId.length > 0

  const canSubmit =
    ownerType === 'PERSON' &&
    personFieldValid &&
    pct > 0 &&
    pct <= 100 &&
    !overAllocated &&
    !submitting

  function handleSubmit() {
    if (!canSubmit) return
    startTransition(async () => {
      const result = await addOwner({
        companyId,
        ownerType,
        personId: createNew ? undefined : personId,
        firstName: createNew ? firstName.trim() : undefined,
        lastName: createNew ? lastName.trim() : undefined,
        personEmail: createNew ? personEmail.trim() || undefined : undefined,
        ownershipPct: pct,
        acquiredAt: acquiredAt || undefined,
        note: note.trim() || undefined,
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Ejer tilføjet · ${personLabel || 'ny person'} ${pct}%`)
      // Reset form og luk modal
      setPersonId('')
      setFirstName('')
      setLastName('')
      setPersonEmail('')
      setCreateNew(false)
      setPctInput('')
      setNote('')
      onClose()
      router.refresh()
    })
  }

  return (
    <BModal
      open={open}
      onClose={onClose}
      title={`Tilføj ejer · ${companyName}`}
      subtitle={
        existingOwners.length > 0
          ? `Eksisterende ejerskab: ${existingTotal.toFixed(0)}% (${existingOwners
              .map((o) => `${o.name} ${o.pct}%`)
              .join(' + ')})`
          : 'Ingen ejere registreret endnu'
      }
      submitLabel="Tilføj ejer"
      submitDisabled={!canSubmit}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      <BSegmentedField
        label="Ejer-type"
        options={OWNER_TYPE_OPTS}
        value={ownerType}
        onChange={setOwnerType}
        required
      />

      {ownerType !== 'PERSON' ? (
        <div className="rounded-[4px] border border-b-amber-fg/30 bg-b-amber-bg px-3 py-2 text-[12px] text-b-amber-fg">
          Holding/selskab-ejerskab er ikke wired endnu — brug person-typen for nu.
        </div>
      ) : createNew ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-b-2">Opretter ny person</span>
            <button
              type="button"
              onClick={() => {
                setCreateNew(false)
                setFirstName('')
                setLastName('')
                setPersonEmail('')
              }}
              className="text-[11px] text-b-blue-fg hover:underline"
            >
              ← Vælg eksisterende
            </button>
          </div>
          <BFieldRow>
            <BTextField
              label="Fornavn"
              value={firstName}
              onChange={setFirstName}
              required
              autoFocus
            />
            <BTextField label="Efternavn" value={lastName} onChange={setLastName} required />
          </BFieldRow>
          <BTextField
            label="E-mail"
            type="email"
            value={personEmail}
            onChange={setPersonEmail}
            placeholder="valgfri"
          />
        </>
      ) : (
        <>
          <BFieldWrap
            label="Person"
            required
            hint={personId ? '' : 'Vælg en eksisterende person eller opret ny'}
          >
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
            >
              <option value="">— Vælg person —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                  {p.email ? ` · ${p.email}` : ''}
                </option>
              ))}
            </select>
          </BFieldWrap>
          <button
            type="button"
            onClick={() => setCreateNew(true)}
            className="self-start text-[11px] text-b-blue-fg hover:underline"
          >
            + Opret ny person i stedet
          </button>
        </>
      )}

      <BFieldRow>
        <BFieldWrap label="Andel" required>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={pctInput}
              onChange={(e) => setPctInput(e.target.value)}
              placeholder="10"
              className="b-tnum w-[70px] rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-right text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
            />
            <span className="text-[13px] text-b-2">%</span>
          </div>
        </BFieldWrap>
        <BTextField label="Erhvervet" type="date" value={acquiredAt} onChange={setAcquiredAt} />
      </BFieldRow>

      {/* Live preview: pct-bar + fordeling efter tilføjelse */}
      <div className="rounded-[4px] border border-b-border bg-b-panel-h px-3 py-2.5">
        <div
          className="mb-2 text-[10px] font-semibold uppercase text-b-2"
          style={{ letterSpacing: '0.5px' }}
        >
          Fordeling efter tilføjelse
        </div>
        <div className="relative mb-2 h-1.5 overflow-hidden rounded-[3px] bg-b-divider">
          <div
            className="absolute left-0 top-0 h-full bg-b-border-strong"
            style={{ width: `${fillExisting}%` }}
          />
          <div
            className={`absolute top-0 h-full ${overAllocated ? 'bg-b-red-fg' : 'bg-b-blue-fg'}`}
            style={{ left: `${fillExisting}%`, width: `${fillNew}%` }}
          />
        </div>
        <div className="flex flex-col gap-0.5 text-[12px] text-b-1">
          {existingOwners.map((o, i) => (
            <div key={i} className="flex justify-between">
              <span>{o.name}</span>
              <span className="b-tnum">{o.pct}%</span>
            </div>
          ))}
          {pct > 0 && (
            <div className="flex justify-between">
              <span>
                {personLabel || 'Ny ejer'} <span className="text-b-blue-fg">(ny)</span>
              </span>
              <span className="b-tnum">{pct.toFixed(0)}%</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-b-divider pt-1 text-b-2">
            <span>Total</span>
            <span className={`b-tnum font-semibold ${overAllocated ? 'text-b-red-fg' : ''}`}>
              {newTotal.toFixed(0)}%
            </span>
          </div>
          {overAllocated && (
            <div className="mt-1 text-b-red-fg">
              ⚠ Total overstiger 100% — reducér andel eller juster eksisterende ejer.
            </div>
          )}
        </div>
      </div>

      <BTextareaField
        label="Note (valgfri)"
        value={note}
        onChange={setNote}
        placeholder="Fx baggrund for tilkøb, ejeraftale-reference..."
      />
    </BModal>
  )
}
