'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateCompanyStamdata } from '@/actions/companies'

export interface EditStamdataDialogProps {
  companyId: string
  initial: {
    name: string
    cvr: string | null
    address: string | null
    city: string | null
    postal_code: string | null
    founded_date: Date | null
  }
  disabled?: boolean
}

export function EditStamdataDialog({ companyId, initial, disabled }: EditStamdataDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: initial.name,
    cvr: initial.cvr ?? '',
    address: initial.address ?? '',
    city: initial.city ?? '',
    postal_code: initial.postal_code ?? '',
    founded_date: initial.founded_date ? initial.founded_date.toISOString().slice(0, 10) : '',
  })

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await updateCompanyStamdata(companyId, {
        name: form.name,
        cvr: form.cvr || null,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        founded_date: form.founded_date || null,
      })
      if ('data' in result) {
        toast.success('Stamdata opdateret')
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Rediger stamdata
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold text-slate-900">Rediger stamdata</h2>
            <div className="space-y-3">
              <Field
                label="Navn"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Field
                label="CVR"
                value={form.cvr}
                onChange={(v) => setForm({ ...form, cvr: v })}
                placeholder="8 cifre"
              />
              <Field
                label="Adresse"
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
              />
              <Field label="By" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <Field
                label="Postnummer"
                value={form.postal_code}
                onChange={(v) => setForm({ ...form, postal_code: v })}
              />
              <Field
                label="Stiftelsesdato"
                type="date"
                value={form.founded_date}
                onChange={(v) => setForm({ ...form, founded_date: v })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isPending ? 'Gemmer...' : 'Gem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
      />
    </label>
  )
}
