'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createVisit } from '@/actions/visits'
import { VISIT_TYPE_LABELS } from '@/lib/labels'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Panel,
  BButton,
  BTextField,
  BTextareaField,
  BFieldRow,
  BFieldWrap,
  Breadcrumb,
} from '@/components/ui/b'

// ─────────────────────────────────────────────────────────────────────────────
// CreateVisitForm — B-stil port. Felter: companyId, visitDate, visitType, notes.
// ─────────────────────────────────────────────────────────────────────────────

interface Company {
  id: string
  name: string
}

interface CreateVisitFormProps {
  companies: Company[]
}

type VisitType =
  | 'KVARTALSBESOEG'
  | 'OPFOELGNING'
  | 'AD_HOC'
  | 'AUDIT'
  | 'ONBOARDING'
  | 'OVERDRAGELSE'

export function CreateVisitForm({ companies }: CreateVisitFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCompany = searchParams.get('company') ?? ''
  const preselectedDate = searchParams.get('visitDate') ?? ''

  const [loading, setLoading] = useState(false)
  const [companyId, setCompanyId] = useState(preselectedCompany)
  const [visitDate, setVisitDate] = useState(preselectedDate)
  const [visitType, setVisitType] = useState('')
  const [notes, setNotes] = useState('')
  const [planlaegEndnu, setPlanlaegEndnu] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!companyId) {
      toast.error('Vælg et selskab')
      return
    }
    setLoading(true)

    const result = await createVisit({
      companyId,
      visitDate,
      visitType: visitType as VisitType,
      notes: notes || undefined,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Besøg planlagt')

    if (planlaegEndnu) {
      // Nulstil form men behold selskab — klar til nyt besøg
      setVisitDate('')
      setVisitType('')
      setNotes('')
      setPlanlaegEndnu(false)
      router.push(`/visits/new?company=${companyId}`)
    } else {
      router.push('/calendar')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Breadcrumb trail={[{ label: 'Kalender', href: '/calendar' }]} current="Planlæg besøg" />

      <div className="flex items-center gap-2">
        <Link href="/calendar" className="rounded-[4px] p-1 hover:bg-[#f6f8fa]">
          <ArrowLeft className="h-4 w-4 text-b-2" />
        </Link>
        <span className="text-[16px] font-semibold text-b-1">Planlæg besøg</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-3.5 px-4 py-4">
            <BFieldWrap label="Selskab" required>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                disabled={loading}
                className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Vælg selskab...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </BFieldWrap>

            <BFieldRow>
              <BTextField
                label="Besøgsdato"
                value={visitDate}
                onChange={setVisitDate}
                type="date"
                required
                disabled={loading}
              />

              <BFieldWrap label="Besøgstype" required>
                <select
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value)}
                  required
                  disabled={loading}
                  className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Vælg type...</option>
                  {Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </BFieldWrap>
            </BFieldRow>

            <BTextareaField
              label="Noter"
              value={notes}
              onChange={setNotes}
              placeholder="Eventuelle noter til besøget..."
              rows={4}
              disabled={loading}
            />
          </div>
        </Panel>

        {/* Planlæg endnu ét */}
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-b-2">
          <input
            type="checkbox"
            checked={planlaegEndnu}
            onChange={(e) => setPlanlaegEndnu(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 rounded accent-b-blue-fg"
          />
          Planlæg endnu ét besøg for samme selskab bagefter
        </label>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Link href="/calendar">
            <BButton disabled={loading}>Annuller</BButton>
          </Link>
          <BButton type="submit" primary disabled={loading}>
            {loading ? 'Opretter...' : 'Planlæg besøg'}
          </BButton>
        </div>
      </form>
    </div>
  )
}
