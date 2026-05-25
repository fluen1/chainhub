'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BModal, BTextField, BTextareaField, BFieldWrap } from '@/components/ui/b'
import { updateCase } from '@/actions/cases'
import { CASE_TYPE_LABELS, CASE_SUBTYPE_BY_TYPE } from '@/lib/validations/case'
import { SENSITIVITY_LABELS } from '@/lib/labels'
import type { SagsSubtype, SagsType, SensitivityLevel } from '@prisma/client'

// ────────────────────────────────────────────────────────────────────────────
// EditCaseDialog — rediger sag inkl. titel, beskrivelse, type, sensitivitet,
// og ansvarlig bruger.
// ────────────────────────────────────────────────────────────────────────────

export interface EditCaseInitial {
  id: string
  title: string
  description: string
  caseType: string
  caseSubtype: string | null
  sensitivity: string
  dueDate: string | null
  assignedTo?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  initial: EditCaseInitial
}

const SENSITIVITY_OPTIONS: Array<{ value: SensitivityLevel; label: string }> = [
  { value: 'PUBLIC', label: SENSITIVITY_LABELS['PUBLIC'] ?? 'PUBLIC' },
  { value: 'STANDARD', label: SENSITIVITY_LABELS['STANDARD'] ?? 'STANDARD' },
  { value: 'INTERN', label: SENSITIVITY_LABELS['INTERN'] ?? 'INTERN' },
  { value: 'FORTROLIG', label: SENSITIVITY_LABELS['FORTROLIG'] ?? 'FORTROLIG' },
  { value: 'STRENGT_FORTROLIG', label: SENSITIVITY_LABELS['STRENGT_FORTROLIG'] ?? 'STRENGT_FORTROLIG' },
]

interface OrgUser {
  id: string
  name: string | null
}

export function EditCaseDialog({ open, onClose, initial }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [caseType, setCaseType] = useState<string>(initial.caseType)
  const [caseSubtype, setCaseSubtype] = useState<string>(initial.caseSubtype ?? '')
  const [sensitivity, setSensitivity] = useState<string>(initial.sensitivity)
  const [dueDate, setDueDate] = useState<string>(initial.dueDate ?? '')
  const [assignedTo, setAssignedTo] = useState<string>(initial.assignedTo ?? '')
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [submitting, startTransition] = useTransition()

  // Hent org-brugere én gang når dialogen åbnes
  useEffect(() => {
    if (!open) return
    fetch('/api/users-list')
      .then((r) => r.json())
      .then((data: { users?: OrgUser[] }) => {
        if (data.users) setOrgUsers(data.users)
      })
      .catch(() => {
        // Stiltiende fejl — feltet vises stadig men tomt
      })
  }, [open])

  const subtypeOptions = CASE_SUBTYPE_BY_TYPE[caseType] ?? []

  const canSubmit = title.trim().length > 0 && !submitting

  function handleSubmit() {
    if (!canSubmit) return
    startTransition(async () => {
      const result = await updateCase({
        caseId: initial.id,
        title: title.trim(),
        description: description.trim() || undefined,
        caseType: caseType as SagsType,
        caseSubtype: (caseSubtype || undefined) as SagsSubtype | undefined,
        sensitivity: sensitivity as SensitivityLevel,
        dueDate: dueDate || null,
        assignedTo: assignedTo || null,
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Sag opdateret')
      onClose()
      router.refresh()
    })
  }

  return (
    <BModal
      open={open}
      onClose={onClose}
      title="Rediger sag"
      subtitle="Opdater sagsinformationer."
      submitLabel="Gem ændringer"
      submitDisabled={!canSubmit}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      <BTextField
        label="Titel"
        value={title}
        onChange={setTitle}
        required
        autoFocus
        placeholder="Sagstitel"
      />

      <BTextareaField
        label="Beskrivelse"
        value={description}
        onChange={setDescription}
        placeholder="Uddyb sagens baggrund og formål..."
        rows={3}
      />

      <BFieldWrap label="Sagstype" required>
        <select
          value={caseType}
          onChange={(e) => {
            setCaseType(e.target.value)
            setCaseSubtype('')
          }}
          className="w-full rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
        >
          {Object.entries(CASE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </BFieldWrap>

      {subtypeOptions.length > 0 && (
        <BFieldWrap label="Underkategori">
          <select
            value={caseSubtype}
            onChange={(e) => setCaseSubtype(e.target.value)}
            className="w-full rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
          >
            <option value="">— Ingen underkategori —</option>
            {subtypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </BFieldWrap>
      )}

      <BFieldWrap label="Sensitivitet" required>
        <select
          value={sensitivity}
          onChange={(e) => setSensitivity(e.target.value)}
          className="w-full rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
        >
          {SENSITIVITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </BFieldWrap>

      <BFieldWrap label="Ansvarlig">
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="w-full rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
        >
          <option value="">— Ingen ansvarlig —</option>
          {orgUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.id}
            </option>
          ))}
        </select>
      </BFieldWrap>

      <BTextField label="Fristdato" type="date" value={dueDate} onChange={setDueDate} />
    </BModal>
  )
}
