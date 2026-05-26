# Feature 2: Formular-Autofill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Præ-udfyld opret-formularer automatisk fra CVR API, interne relationer, og AI-ekstraherede dokumenter.

**Architecture:** Ny CVR API adapter (`src/lib/integrations/cvr/`), ny `getAutofillSuggestions` action der samler forslag fra alle kilder, ny `AutofillField` UI-komponent med "AI-forslag" badge.

**Tech Stack:** CVR API v3 (Virk.dk), Prisma, Server Actions, React (B-stil), Zod

---

### Task 1: CVR API adapter

**Files:**

- Create: `src/lib/integrations/cvr/types.ts`
- Create: `src/lib/integrations/cvr/client.ts`
- Create: `src/__tests__/lib/integrations/cvr/client.test.ts`

- [ ] **Step 1: Skriv types**

```typescript
// src/lib/integrations/cvr/types.ts
export interface CvrCompanyData {
  cvr: string
  name: string
  address: string | null
  city: string | null
  postalCode: string | null
  companyType: string | null
  foundedDate: string | null
  capital: number | null
  status: string | null
  signingRule: string | null
}

export interface CvrLookupResult {
  found: boolean
  data: CvrCompanyData | null
  source: 'cvr_api'
}
```

- [ ] **Step 2: Skriv tests for CVR client**

```typescript
// src/__tests__/lib/integrations/cvr/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('CVR client - lookupByCvr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns company data for valid CVR', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          vlesnitnummer: '12345678',
          virksomhedMetadata: {
            nyesteNavn: { navn: 'Test ApS' },
            nyesteBeliggenhedsadresse: {
              vejnavn: 'Testvej',
              husnummerFra: '1',
              postnummer: 2100,
              postdistrikt: 'København Ø',
            },
            nyesteVirksomhedsform: { langBeskrivelse: 'Anpartsselskab' },
            stiftelsesDato: '2020-01-15',
          },
        }),
    })

    const { lookupByCvr } = await import('@/lib/integrations/cvr/client')
    const result = await lookupByCvr('12345678')

    expect(result.found).toBe(true)
    expect(result.data?.name).toBe('Test ApS')
    expect(result.data?.cvr).toBe('12345678')
  })

  it('returns not found for invalid CVR', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    })

    const { lookupByCvr } = await import('@/lib/integrations/cvr/client')
    const result = await lookupByCvr('00000000')

    expect(result.found).toBe(false)
    expect(result.data).toBeNull()
  })

  it('validates CVR format (8 digits)', async () => {
    const { lookupByCvr } = await import('@/lib/integrations/cvr/client')
    const result = await lookupByCvr('123')

    expect(result.found).toBe(false)
    expect(result.data).toBeNull()
  })
})
```

- [ ] **Step 3: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/lib/integrations/cvr/client.test.ts`
Expected: FAIL — modul eksisterer ikke

- [ ] **Step 4: Implementér CVR client**

```typescript
// src/lib/integrations/cvr/client.ts
import type { CvrCompanyData, CvrLookupResult } from './types'

const CVR_API_BASE = 'https://cvrapi.dk/api'

export async function lookupByCvr(cvr: string): Promise<CvrLookupResult> {
  if (!/^\d{8}$/.test(cvr)) {
    return { found: false, data: null, source: 'cvr_api' }
  }

  try {
    const response = await fetch(`${CVR_API_BASE}?search=${cvr}&country=dk`, {
      headers: {
        'User-Agent': 'ChainHub/1.0 (contact@chainhub.dk)',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return { found: false, data: null, source: 'cvr_api' }
    }

    const raw = await response.json()

    const data: CvrCompanyData = {
      cvr: String(raw.vat ?? cvr),
      name: raw.name ?? null,
      address: raw.address ?? null,
      city: raw.city ?? null,
      postalCode: raw.zipcode ? String(raw.zipcode) : null,
      companyType: raw.companydesc ?? null,
      foundedDate: raw.startdate ?? null,
      capital: null,
      status: raw.status === 'NORMAL' ? 'aktiv' : (raw.status ?? null),
      signingRule: null,
    }

    return { found: true, data, source: 'cvr_api' }
  } catch {
    return { found: false, data: null, source: 'cvr_api' }
  }
}
```

- [ ] **Step 5: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/lib/integrations/cvr/client.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/integrations/cvr/types.ts src/lib/integrations/cvr/client.ts src/__tests__/lib/integrations/cvr/client.test.ts
git commit -m "feat: tilføj CVR API adapter for Virk.dk opslag"
```

---

### Task 2: Autofill action

**Files:**

- Create: `src/actions/autofill.ts`
- Create: `src/__tests__/actions/autofill.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
// src/__tests__/actions/autofill.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    company: { findFirst: vi.fn() },
    person: { findMany: vi.fn() },
    documentExtraction: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/integrations/cvr/client', () => ({
  lookupByCvr: vi.fn(),
}))

describe('getAutofillSuggestions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null)

    const { getAutofillSuggestions } = await import('@/actions/autofill')
    const result = await getAutofillSuggestions({ entityType: 'company', cvr: '12345678' })

    expect(result.error).toBe('Din session er udløbet — log ind igen.')
  })

  it('returns CVR suggestions when CVR is provided', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)

    const { lookupByCvr } = await import('@/lib/integrations/cvr/client')
    vi.mocked(lookupByCvr).mockResolvedValue({
      found: true,
      data: {
        cvr: '12345678',
        name: 'Test ApS',
        address: 'Testvej 1',
        city: 'København',
        postalCode: '2100',
        companyType: 'ApS',
        foundedDate: '2020-01-15',
        capital: 500000,
        status: 'aktiv',
        signingRule: null,
      },
      source: 'cvr_api',
    })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.documentExtraction.findMany).mockResolvedValue([])

    const { getAutofillSuggestions } = await import('@/actions/autofill')
    const result = await getAutofillSuggestions({ entityType: 'company', cvr: '12345678' })

    expect(result.data).toBeDefined()
    expect(result.data!.suggestions).toContainEqual(
      expect.objectContaining({ field: 'name', value: 'Test ApS', source: 'cvr_api' })
    )
  })

  it('returns internal suggestions from existing data', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)

    const { lookupByCvr } = await import('@/lib/integrations/cvr/client')
    vi.mocked(lookupByCvr).mockResolvedValue({ found: false, data: null, source: 'cvr_api' })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.company.findFirst).mockResolvedValue({
      id: 'comp-1',
      name: 'Existing ApS',
      cvr: '12345678',
      address: 'Gammel vej 5',
    } as never)
    vi.mocked(prisma.documentExtraction.findMany).mockResolvedValue([])

    const { getAutofillSuggestions } = await import('@/actions/autofill')
    const result = await getAutofillSuggestions({ entityType: 'company', cvr: '12345678' })

    expect(result.data!.suggestions).toContainEqual(
      expect.objectContaining({ field: 'name', value: 'Existing ApS', source: 'internal' })
    )
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/actions/autofill.test.ts`
Expected: FAIL — modul eksisterer ikke

- [ ] **Step 3: Implementér action**

```typescript
// src/actions/autofill.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { lookupByCvr } from '@/lib/integrations/cvr/client'
import type { ActionResult } from '@/types/actions'

export interface AutofillSuggestion {
  field: string
  value: string | number | null
  source: 'cvr_api' | 'internal' | 'document_extraction'
  confidence: number
}

export interface AutofillInput {
  entityType: 'company' | 'contract' | 'person'
  cvr?: string
  personName?: string
  companyId?: string
}

export interface AutofillResult {
  suggestions: AutofillSuggestion[]
  existingEntityId?: string
}

export async function getAutofillSuggestions(
  input: AutofillInput
): Promise<ActionResult<AutofillResult>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const orgId = session.user.organizationId
  const suggestions: AutofillSuggestion[] = []
  let existingEntityId: string | undefined

  // Source 1: CVR API
  if (input.cvr && input.entityType === 'company') {
    const cvrResult = await lookupByCvr(input.cvr)
    if (cvrResult.found && cvrResult.data) {
      const d = cvrResult.data
      if (d.name)
        suggestions.push({ field: 'name', value: d.name, source: 'cvr_api', confidence: 0.99 })
      if (d.address)
        suggestions.push({
          field: 'address',
          value: d.address,
          source: 'cvr_api',
          confidence: 0.99,
        })
      if (d.city)
        suggestions.push({ field: 'city', value: d.city, source: 'cvr_api', confidence: 0.99 })
      if (d.postalCode)
        suggestions.push({
          field: 'postal_code',
          value: d.postalCode,
          source: 'cvr_api',
          confidence: 0.99,
        })
      if (d.companyType)
        suggestions.push({
          field: 'company_type',
          value: d.companyType,
          source: 'cvr_api',
          confidence: 0.95,
        })
      if (d.foundedDate)
        suggestions.push({
          field: 'founded_date',
          value: d.foundedDate,
          source: 'cvr_api',
          confidence: 0.99,
        })
    }
  }

  // Source 2: Internal data (check if entity already exists)
  if (input.cvr && input.entityType === 'company') {
    const existing = await prisma.company.findFirst({
      where: { organization_id: orgId, cvr: input.cvr, deleted_at: null },
      select: { id: true, name: true, address: true, city: true, postal_code: true },
    })
    if (existing) {
      existingEntityId = existing.id
      if (existing.name)
        suggestions.push({
          field: 'name',
          value: existing.name,
          source: 'internal',
          confidence: 1.0,
        })
      if (existing.address)
        suggestions.push({
          field: 'address',
          value: existing.address,
          source: 'internal',
          confidence: 1.0,
        })
      if (existing.city)
        suggestions.push({
          field: 'city',
          value: existing.city,
          source: 'internal',
          confidence: 1.0,
        })
      if (existing.postal_code)
        suggestions.push({
          field: 'postal_code',
          value: existing.postal_code,
          source: 'internal',
          confidence: 1.0,
        })
    }
  }

  // Source 3: Document extractions with matching CVR
  if (input.cvr) {
    const extractions = await prisma.documentExtraction.findMany({
      where: {
        organization_id: orgId,
        extraction_status: 'completed',
      },
      select: { extracted_fields: true },
      take: 5,
      orderBy: { created_at: 'desc' },
    })

    for (const ext of extractions) {
      const fields = ext.extracted_fields as Record<string, unknown>
      if (fields.cvr_nummer === input.cvr || fields.cvr === input.cvr) {
        for (const [key, value] of Object.entries(fields)) {
          if (value && key !== 'cvr_nummer' && key !== 'cvr' && typeof value === 'string') {
            const existing = suggestions.find((s) => s.field === key)
            if (!existing) {
              suggestions.push({
                field: key,
                value,
                source: 'document_extraction',
                confidence: 0.8,
              })
            }
          }
        }
        break
      }
    }
  }

  // Deduplicate: keep highest confidence per field
  const deduped = new Map<string, AutofillSuggestion>()
  for (const s of suggestions) {
    const existing = deduped.get(s.field)
    if (!existing || s.confidence > existing.confidence) {
      deduped.set(s.field, s)
    }
  }

  return {
    data: {
      suggestions: Array.from(deduped.values()),
      existingEntityId,
    },
  }
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/actions/autofill.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/autofill.ts src/__tests__/actions/autofill.test.ts
git commit -m "feat: tilføj getAutofillSuggestions action med CVR + intern + dokument data"
```

---

### Task 3: AutofillField UI-komponent

**Files:**

- Create: `src/components/ui/AutofillField.tsx`
- Create: `src/__tests__/components/ui/AutofillField.test.tsx`

- [ ] **Step 1: Skriv tests**

```typescript
// src/__tests__/components/ui/AutofillField.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AutofillField } from '@/components/ui/AutofillField'

describe('AutofillField', () => {
  it('renders as normal BTextField when no suggestion', () => {
    render(
      <AutofillField label="Firmanavn" value="" onChange={vi.fn()} suggestion={null} />
    )
    expect(screen.getByLabelText('Firmanavn')).toBeDefined()
    expect(screen.queryByText('Forslag')).toBeNull()
  })

  it('shows suggestion badge when suggestion is provided', () => {
    render(
      <AutofillField
        label="Firmanavn"
        value=""
        onChange={vi.fn()}
        suggestion={{ value: 'Test ApS', source: 'cvr_api', confidence: 0.99 }}
      />
    )
    expect(screen.getByText('Forslag fra CVR')).toBeDefined()
    expect(screen.getByText('Test ApS')).toBeDefined()
  })

  it('calls onChange with suggestion value when accepted', () => {
    const onChange = vi.fn()
    render(
      <AutofillField
        label="Firmanavn"
        value=""
        onChange={onChange}
        suggestion={{ value: 'Test ApS', source: 'cvr_api', confidence: 0.99 }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /acceptér/i }))
    expect(onChange).toHaveBeenCalledWith('Test ApS')
  })

  it('hides suggestion after dismissal', () => {
    render(
      <AutofillField
        label="Firmanavn"
        value=""
        onChange={vi.fn()}
        suggestion={{ value: 'Test ApS', source: 'cvr_api', confidence: 0.99 }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /afvis/i }))
    expect(screen.queryByText('Test ApS')).toBeNull()
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/components/ui/AutofillField.test.tsx`
Expected: FAIL — komponent eksisterer ikke

- [ ] **Step 3: Implementér AutofillField**

```typescript
// src/components/ui/AutofillField.tsx
'use client'

import { useState } from 'react'
import { BTextField } from '@/components/ui/b'
import { Sparkles, Check, X } from 'lucide-react'

interface AutofillSuggestionProp {
  value: string | number
  source: 'cvr_api' | 'internal' | 'document_extraction'
  confidence: number
}

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  suggestion: AutofillSuggestionProp | null
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string | null
}

const sourceLabels: Record<string, string> = {
  cvr_api: 'Forslag fra CVR',
  internal: 'Forslag fra intern data',
  document_extraction: 'Forslag fra dokument',
}

export function AutofillField({
  label,
  value,
  onChange,
  suggestion,
  placeholder,
  required,
  disabled,
  error,
}: Props) {
  const [dismissed, setDismissed] = useState(false)

  const showSuggestion = suggestion && !dismissed && !value

  return (
    <div className="relative">
      <BTextField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        error={error}
      />
      {showSuggestion && (
        <div className="mt-1 flex items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-purple-500 shrink-0" />
          <span className="text-[11px] font-medium text-purple-700">
            {sourceLabels[suggestion.source]}
          </span>
          <span className="text-[12px] text-purple-900 font-medium truncate">
            {String(suggestion.value)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => { onChange(String(suggestion.value)); setDismissed(true) }}
              className="rounded p-0.5 hover:bg-purple-100 text-purple-700"
              aria-label="Acceptér"
              title="Brug forslag"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded p-0.5 hover:bg-purple-100 text-purple-700"
              aria-label="Afvis"
              title="Ignorer forslag"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/components/ui/AutofillField.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/AutofillField.tsx src/__tests__/components/ui/AutofillField.test.tsx
git commit -m "feat: tilføj AutofillField komponent med AI-forslag badge"
```

---

### Task 4: Integrér autofill i CreateCompanyForm

**Files:**

- Modify: `src/components/companies/CreateCompanyForm.tsx`

- [ ] **Step 1: Tilføj autofill-hook til formen**

I `src/components/companies/CreateCompanyForm.tsx`, tilføj:

```typescript
import { useState, useCallback } from 'react'
import { getAutofillSuggestions, type AutofillSuggestion } from '@/actions/autofill'
import { AutofillField } from '@/components/ui/AutofillField'

// I komponentens body:
const [suggestions, setSuggestions] = useState<Map<string, AutofillSuggestion>>(new Map())
const [autofillLoading, setAutofillLoading] = useState(false)

const handleCvrBlur = useCallback(async () => {
  if (!cvr || cvr.length !== 8) return
  setAutofillLoading(true)
  try {
    const result = await getAutofillSuggestions({ entityType: 'company', cvr })
    if (result.data) {
      const map = new Map<string, AutofillSuggestion>()
      for (const s of result.data.suggestions) {
        map.set(s.field, s)
      }
      setSuggestions(map)
    }
  } finally {
    setAutofillLoading(false)
  }
}, [cvr])
```

- [ ] **Step 2: Erstat BTextField med AutofillField for relevante felter**

Erstat felterne name, address, city, postal_code med AutofillField:

```tsx
<AutofillField
  label="Selskabsnavn"
  value={name}
  onChange={setName}
  suggestion={suggestions.get('name') ?? null}
  required
  disabled={loading}
/>
```

Tilføj `onBlur={handleCvrBlur}` på CVR-feltet.

- [ ] **Step 3: Verificér build**

Run: `npx next build`
Expected: Build successful

- [ ] **Step 4: Commit**

```bash
git add src/components/companies/CreateCompanyForm.tsx
git commit -m "feat: integrér autofill med CVR-opslag i CreateCompanyForm"
```
