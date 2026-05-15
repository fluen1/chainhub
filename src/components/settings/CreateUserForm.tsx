'use client'

import { useState } from 'react'
import { createUser } from '@/actions/users'
import { toast } from 'sonner'
import { USER_ROLE_LABELS } from '@/lib/labels'
import { BButton, BTextField, BFieldWrap, Panel } from '@/components/ui/b'

const ROLES = [
  'GROUP_OWNER',
  'GROUP_ADMIN',
  'GROUP_LEGAL',
  'GROUP_FINANCE',
  'GROUP_READONLY',
  'COMPANY_MANAGER',
  'COMPANY_LEGAL',
  'COMPANY_READONLY',
] as const

const ROLE_HINTS: Record<string, string> = {
  GROUP_OWNER: 'Fuld adgang til alle moduler og indstillinger',
  GROUP_ADMIN: 'Administrer brugere + alle moduler',
  GROUP_LEGAL: 'Kontrakter + sager + dokumenter',
  GROUP_FINANCE: 'Finansdata + eksport',
  GROUP_READONLY: 'Læs-adgang til alle moduler',
  COMPANY_MANAGER: 'Fuld adgang til tildelt selskab',
  COMPANY_LEGAL: 'Kontrakter + sager for tildelt selskab',
  COMPANY_READONLY: 'Læs-adgang til tildelt selskab',
}

const selectBase =
  'rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60'

interface Company {
  id: string
  name: string
}

interface CreateUserFormProps {
  companies: Company[]
}

export function CreateUserForm({ companies }: CreateUserFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>('GROUP_READONLY')
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])

  const isCompanyRole = role.startsWith('COMPANY_')

  function reset() {
    setName('')
    setEmail('')
    setPassword('')
    setRole('GROUP_READONLY')
    setSelectedCompanyIds([])
  }

  function toggleCompany(companyId: string) {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const result = await createUser({
      email,
      name,
      password,
      role: role as (typeof ROLES)[number],
      companyIds: isCompanyRole ? selectedCompanyIds : [],
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Bruger oprettet')
    setOpen(false)
    reset()
  }

  if (!open) {
    return (
      <BButton primary onClick={() => setOpen(true)}>
        Opret bruger
      </BButton>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[16px] font-semibold text-b-1">Opret ny bruger</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-3.5 px-4 py-4">
            <p
              className="text-[10px] font-semibold uppercase text-b-2"
              style={{ letterSpacing: '0.4px' }}
            >
              Brugerinformation
            </p>

            <BTextField
              label="Navn"
              value={name}
              onChange={setName}
              required
              placeholder="Fulde navn"
              disabled={loading}
              autoFocus
            />

            <BTextField
              label="E-mail"
              value={email}
              onChange={setEmail}
              required
              type="email"
              placeholder="bruger@virksomhed.dk"
              disabled={loading}
            />

            <BTextField
              label="Adgangskode"
              value={password}
              onChange={setPassword}
              required
              type="password"
              placeholder="Mindst 8 tegn"
              hint="Mindst 8 tegn"
              disabled={loading}
            />

            <BFieldWrap label="Rolle" required hint={role ? ROLE_HINTS[role] : undefined}>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value)
                  if (!e.target.value.startsWith('COMPANY_')) {
                    setSelectedCompanyIds([])
                  }
                }}
                disabled={loading}
                className={selectBase}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {USER_ROLE_LABELS[r] ?? r}
                  </option>
                ))}
              </select>
            </BFieldWrap>
          </div>
        </Panel>

        {isCompanyRole && (
          <Panel>
            <div className="flex flex-col gap-2 px-4 py-4">
              <p
                className="text-[10px] font-semibold uppercase text-b-2"
                style={{ letterSpacing: '0.4px' }}
              >
                Tildelte selskaber
              </p>
              {companies.length === 0 ? (
                <p className="text-[13px] text-b-2">Ingen selskaber fundet</p>
              ) : (
                <div
                  role="group"
                  aria-label="Tildelte selskaber"
                  className="flex max-h-48 flex-col gap-1 overflow-y-auto"
                >
                  {companies.map((company) => (
                    <label
                      key={company.id}
                      className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-[13px] text-b-1 hover:bg-b-row-hover"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompanyIds.includes(company.id)}
                        onChange={() => toggleCompany(company.id)}
                        className="rounded border-b-border-strong"
                      />
                      {company.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        )}

        <div className="flex items-center justify-end gap-2">
          <BButton
            onClick={() => {
              setOpen(false)
              reset()
            }}
            disabled={loading}
          >
            Annuller
          </BButton>
          <BButton
            type="submit"
            primary
            disabled={loading || !name.trim() || !email.trim() || !password}
          >
            {loading ? 'Opretter...' : 'Opret bruger'}
          </BButton>
        </div>
      </form>
    </div>
  )
}
