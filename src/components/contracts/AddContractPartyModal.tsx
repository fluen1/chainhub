'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BModal, BTextField, BFieldWrap, BSegmentedField, BFieldRow } from '@/components/ui/b'
import { addContractParty } from '@/actions/contracts'

// ─────────────────────────────────────────────────────────────────────────────
// AddContractPartyModal — BModal til tilføjelse af part på kontrakt.
// Erstatter href-links der pegede på /contracts/[id]/parties/new (404).
//
// Brug:
//   <AddContractPartyModal
//     open={open}
//     onClose={() => setOpen(false)}
//     contractId={contract.id}
//     contractName={contract.display_name}
//     persons={[{ id, firstName, lastName, email }]}
//   />
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonOption {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

type PartyType = 'PERSON' | 'EKSTERN'

const PARTY_TYPE_OPTS: Array<{ value: PartyType; label: string }> = [
  { value: 'PERSON', label: 'Person i systemet' },
  { value: 'EKSTERN', label: 'Ekstern part' },
]

// Typiske rolle-options afhængigt af kontrakttype (generisk liste)
const ROLE_OPTIONS = [
  'Lejer',
  'Udlejer',
  'Leasingtager',
  'Leasinggiver',
  'Leverandør',
  'Køber',
  'Sælger',
  'Forsikret',
  'Forsikringsgiver',
  'Arbejdsgiver',
  'Medarbejder',
  'Part',
  'Underskriver',
  'Garant',
]

interface AddContractPartyModalProps {
  open: boolean
  onClose: () => void
  contractId: string
  contractName: string
  persons: PersonOption[]
}

export function AddContractPartyModal({
  open,
  onClose,
  contractId,
  contractName,
  persons,
}: AddContractPartyModalProps) {
  const router = useRouter()
  const [partyType, setPartyType] = useState<PartyType>('PERSON')
  const [personId, setPersonId] = useState('')
  const [counterpartyName, setCounterpartyName] = useState('')
  const [roleInContract, setRoleInContract] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [isSigner, setIsSigner] = useState(false)
  const [submitting, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const effectiveRole = roleInContract === '__custom__' ? customRole : roleInContract

  const isValid = partyType === 'PERSON' ? personId.length > 0 : counterpartyName.trim().length > 0

  function handleClose() {
    setPartyType('PERSON')
    setPersonId('')
    setCounterpartyName('')
    setRoleInContract('')
    setCustomRole('')
    setIsSigner(false)
    setError(null)
    onClose()
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await addContractParty({
        contractId,
        personId: partyType === 'PERSON' ? personId : undefined,
        counterpartyName: partyType === 'EKSTERN' ? counterpartyName.trim() : undefined,
        roleInContract: effectiveRole.trim() || undefined,
        isSigner,
      })

      if ('error' in result && result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      const selectedPerson = persons.find((p) => p.id === personId)
      const name =
        partyType === 'PERSON'
          ? selectedPerson
            ? `${selectedPerson.firstName} ${selectedPerson.lastName}`
            : 'Person'
          : counterpartyName

      toast.success(`Part tilføjet · ${name}`)
      handleClose()
      router.refresh()
    })
  }

  const selectCls =
    'rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]'

  return (
    <BModal
      open={open}
      onClose={handleClose}
      title="Tilføj part"
      subtitle={contractName}
      onSubmit={handleSubmit}
      submitLabel="Tilføj part"
      submitDisabled={!isValid}
      submitting={submitting}
    >
      <BSegmentedField
        label="Part-type"
        options={PARTY_TYPE_OPTS}
        value={partyType}
        onChange={setPartyType}
        required
      />

      {partyType === 'PERSON' ? (
        <BFieldWrap
          label="Person"
          required
          hint={persons.length === 0 ? 'Ingen personer i systemet endnu' : undefined}
        >
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className={selectCls}
            disabled={persons.length === 0}
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
      ) : (
        <BTextField
          label="Ekstern parts navn"
          value={counterpartyName}
          onChange={setCounterpartyName}
          placeholder="Fx Udlejningsselskabet A/S"
          required
        />
      )}

      <BFieldRow>
        <BFieldWrap label="Rolle">
          <select
            value={roleInContract}
            onChange={(e) => setRoleInContract(e.target.value)}
            className={selectCls}
          >
            <option value="">— Vælg rolle —</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="__custom__">Anden rolle...</option>
          </select>
        </BFieldWrap>

        <BFieldWrap label="Underskriver">
          <div className="flex items-center gap-2 py-1.5">
            <input
              type="checkbox"
              id="is-signer"
              checked={isSigner}
              onChange={(e) => setIsSigner(e.target.checked)}
              className="h-4 w-4 rounded border-b-border-strong text-b-blue-fg focus:ring-b-blue-fg"
            />
            <label htmlFor="is-signer" className="text-[13px] text-b-1">
              Er underskriver
            </label>
          </div>
        </BFieldWrap>
      </BFieldRow>

      {roleInContract === '__custom__' && (
        <BTextField
          label="Anden rolle"
          value={customRole}
          onChange={setCustomRole}
          placeholder="Fx Mægler, Rådgiver..."
        />
      )}

      {error && (
        <p className="rounded-[4px] border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
          {error}
        </p>
      )}
    </BModal>
  )
}
