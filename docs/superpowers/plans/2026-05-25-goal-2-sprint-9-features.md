# Goal 2: Sprint 9 Features — Company Notes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg Company Notes-modul (Modul F fra SPEC-TILLAEG-v2) som greenfield feature. Stripe webhooks er allerede implementeret. Search udvides til at inkludere notes.

**Architecture:** Ny `CompanyNote` Prisma-model, ny action-fil `company-notes.ts`, ny UI-sektion i company detail. Kronologisk feed med pin-funktion og inline textarea. Søgning udvides i `search.ts`.

**Tech Stack:** Prisma migration, Server Actions, React components (B-stil), Zod validation

**Revideret scope:** Stripe webhooks er allerede fuldt implementeret (`src/app/api/webhooks/stripe/route.ts`). Search-forbedringer er en minor tilføjelse efter notes er bygget.

---

### Task 1: Prisma model + migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: migration via `prisma migrate dev`

- [ ] **Step 1: Tilføj CompanyNote model**

I `prisma/schema.prisma`, tilføj efter Company-modellen:

```prisma
model CompanyNote {
  id              String       @id @default(cuid())
  organization_id String
  company_id      String
  content         String
  pinned          Boolean      @default(false)
  created_by      String
  created_at      DateTime     @default(now())
  updated_at      DateTime     @updatedAt
  deleted_at      DateTime?

  organization    Organization @relation(fields: [organization_id], references: [id])
  company         Company      @relation(fields: [company_id], references: [id])
  author          User         @relation(fields: [created_by], references: [id])

  @@index([company_id, deleted_at])
  @@index([organization_id])
  @@map("company_notes")
}
```

Tilføj relationer på Company, Organization og User:

```prisma
// I Company model:
notes CompanyNote[]

// I Organization model:
companyNotes CompanyNote[]

// I User model:
companyNotes CompanyNote[]
```

- [ ] **Step 2: Generér Prisma client**

Run: `npx prisma generate`
Expected: Success

- [ ] **Step 3: Kør migration**

Run: `npx prisma migrate dev --name add-company-notes`
Expected: Migration applied

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: CompanyNote model + migration"
```

---

### Task 2: Zod validation schemas

**Files:**

- Create: `src/lib/validations/company-notes.ts`

- [ ] **Step 1: Opret validation schemas**

```typescript
// src/lib/validations/company-notes.ts
import { z } from 'zod'

export const createCompanyNoteSchema = z.object({
  company_id: z.string().cuid(),
  content: z
    .string()
    .min(1, 'Notat må ikke være tomt')
    .max(5000, 'Notat er for langt (max 5000 tegn)'),
})

export const updateCompanyNoteSchema = z.object({
  id: z.string().cuid(),
  content: z
    .string()
    .min(1, 'Notat må ikke være tomt')
    .max(5000, 'Notat er for langt (max 5000 tegn)'),
})

export const togglePinSchema = z.object({
  id: z.string().cuid(),
})

export type CreateCompanyNoteInput = z.infer<typeof createCompanyNoteSchema>
export type UpdateCompanyNoteInput = z.infer<typeof updateCompanyNoteSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validations/company-notes.ts
git commit -m "feat: Zod schemas for company notes"
```

---

### Task 3: Server Actions

**Files:**

- Create: `src/actions/company-notes.ts`

- [ ] **Step 1: Implementér CRUD actions**

```typescript
// src/actions/company-notes.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import {
  createCompanyNoteSchema,
  updateCompanyNoteSchema,
  togglePinSchema,
} from '@/lib/validations/company-notes'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

export async function getCompanyNotes(companyId: string): Promise<ActionResult<any[]>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const orgId = session.user.organizationId
  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  const notes = await prisma.companyNote.findMany({
    where: {
      organization_id: orgId,
      company_id: companyId,
      deleted_at: null,
    },
    orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }],
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  })

  return { success: true, data: notes }
}

export async function createCompanyNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = createCompanyNoteSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const hasAccess = await canAccessCompany(session.user.id, parsed.data.company_id)
  if (!hasAccess) return { error: 'Ingen adgang til dette selskab' }

  const note = await prisma.companyNote.create({
    data: {
      organization_id: session.user.organizationId,
      company_id: parsed.data.company_id,
      content: parsed.data.content,
      created_by: session.user.id,
    },
  })

  revalidatePath(`/companies/${parsed.data.company_id}`)
  return { success: true, data: { id: note.id } }
}

export async function updateCompanyNote(input: unknown): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateCompanyNoteSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const existing = await prisma.companyNote.findFirst({
    where: { id: parsed.data.id, organization_id: session.user.organizationId, deleted_at: null },
  })
  if (!existing) return { error: 'Notat ikke fundet' }

  await prisma.companyNote.update({
    where: { id: parsed.data.id },
    data: { content: parsed.data.content },
  })

  revalidatePath(`/companies/${existing.company_id}`)
  return { success: true }
}

export async function toggleNotePin(input: unknown): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = togglePinSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const existing = await prisma.companyNote.findFirst({
    where: { id: parsed.data.id, organization_id: session.user.organizationId, deleted_at: null },
  })
  if (!existing) return { error: 'Notat ikke fundet' }

  await prisma.companyNote.update({
    where: { id: parsed.data.id },
    data: { pinned: !existing.pinned },
  })

  revalidatePath(`/companies/${existing.company_id}`)
  return { success: true }
}

export async function deleteCompanyNote(noteId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const existing = await prisma.companyNote.findFirst({
    where: { id: noteId, organization_id: session.user.organizationId, deleted_at: null },
  })
  if (!existing) return { error: 'Notat ikke fundet' }

  await prisma.companyNote.update({
    where: { id: noteId },
    data: { deleted_at: new Date() },
  })

  revalidatePath(`/companies/${existing.company_id}`)
  return { success: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/company-notes.ts
git commit -m "feat: company notes CRUD actions"
```

---

### Task 4: Tests for company-notes actions

**Files:**

- Create: `src/__tests__/actions/company-notes.test.ts`

- [ ] **Step 1: Skriv tests**

Test alle 5 actions: getCompanyNotes, createCompanyNote, updateCompanyNote, toggleNotePin, deleteCompanyNote.
For hver: no-session, no-access (canAccessCompany false), org_id filter, happy path.

- [ ] **Step 2: Kør tests**

Run: `npx vitest run src/__tests__/actions/company-notes.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/actions/company-notes.test.ts
git commit -m "test: company notes action coverage"
```

---

### Task 5: UI — NotesSection komponent

**Files:**

- Create: `src/components/companies/notes-section-b.tsx`

- [ ] **Step 1: Byg notes UI**

Komponent-krav (fra spec):

- Kronologisk feed, pinned noter øverst (gul baggrund `bg-amber-50 border-amber-200`)
- Inline textarea til nyt notat med BButton "Tilføj notat"
- Hver note viser: forfatter, dato (relativ), indhold, pin-knap, slet-knap
- Søgefelt øverst der filtrerer lokalt i noter
- Brug B-stil patterns: `Panel`, `BButton`, `BField`

```typescript
// src/components/companies/notes-section-b.tsx
'use client'

import { useState, useTransition } from 'react'
import { Pin, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { createCompanyNote, toggleNotePin, deleteCompanyNote } from '@/actions/company-notes'
import { formatDistanceToNow } from '@/lib/utils'

interface CompanyNote {
  id: string
  content: string
  pinned: boolean
  created_at: string
  author: { id: string; name: string | null; email: string }
}

interface NotesSectionProps {
  companyId: string
  notes: CompanyNote[]
}

export function NotesSection({ companyId, notes: initialNotes }: NotesSectionProps) {
  const [content, setContent] = useState('')
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  const filteredNotes = initialNotes.filter((n) =>
    search === '' || n.content.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate() {
    if (!content.trim()) return
    startTransition(async () => {
      const result = await createCompanyNote({ company_id: companyId, content })
      if ('error' in result) {
        toast.error(result.error)
      } else {
        setContent('')
        toast.success('Notat tilføjet')
      }
    })
  }

  async function handlePin(noteId: string) {
    startTransition(async () => {
      const result = await toggleNotePin({ id: noteId })
      if ('error' in result) toast.error(result.error)
    })
  }

  async function handleDelete(noteId: string) {
    startTransition(async () => {
      const result = await deleteCompanyNote(noteId)
      if ('error' in result) toast.error(result.error)
      else toast.success('Notat slettet')
    })
  }

  return (
    <section className="space-y-4">
      {/* Nyt notat */}
      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Skriv et notat..."
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          maxLength={5000}
        />
        <button
          onClick={handleCreate}
          disabled={isPending || !content.trim()}
          className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          Tilføj notat
        </button>
      </div>

      {/* Søgning */}
      {initialNotes.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg i noter..."
            className="w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>
      )}

      {/* Notes feed */}
      {filteredNotes.length === 0 ? (
        <p className="text-sm text-zinc-500">Ingen noter endnu</p>
      ) : (
        <div className="space-y-2">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`rounded-md border p-3 text-sm ${
                note.pinned
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-zinc-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap flex-1">{note.content}</p>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handlePin(note.id)}
                    className={`rounded p-1 hover:bg-zinc-100 ${note.pinned ? 'text-amber-600' : 'text-zinc-400'}`}
                    title={note.pinned ? 'Frigør' : 'Fastgør'}
                  >
                    <Pin className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    title="Slet"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                {note.author.name ?? note.author.email} · {formatDistanceToNow(new Date(note.created_at))}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/companies/notes-section-b.tsx
git commit -m "feat: NotesSection UI komponent"
```

---

### Task 6: Integrér i company detail page

**Files:**

- Modify: `src/app/(dashboard)/companies/[id]/page.tsx` eller `company-detail-b.tsx`

- [ ] **Step 1: Tilføj notes-sektion til company detail**

Tilføj `NotesSection` som ny sektion efter "Dokumenter" i company detail. Hent notes via `getCompanyNotes(companyId)` i server component og send som prop.

- [ ] **Step 2: Test i browser**

Start dev server, naviger til et selskab, verificér:

- Notat-textarea vises
- Kan oprette, pinne, slette noter
- Pinned noter har gul baggrund og vises øverst
- Søgning filtrerer noter

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/companies/[id]/ src/components/companies/
git commit -m "feat: company notes integreret i selskabsdetalje"
```

---

### Task 7: Udvid search med company notes

**Files:**

- Modify: `src/actions/search.ts`

- [ ] **Step 1: Tilføj companyNote til runSearch**

I `search.ts`, tilføj en ny sektion der søger i `companyNote.content`:

```typescript
const companyNotes = await prisma.companyNote.findMany({
  where: {
    organization_id: orgId,
    deleted_at: null,
    content: { contains: query, mode: 'insensitive' },
  },
  take: 8,
  include: { company: { select: { id: true, name: true } } },
})
```

Map resultaterne til det eksisterende search-result format med type `'note'` og link til selskabets detail-side.

- [ ] **Step 2: Test søgning**

Opret et notat med unik tekst, søg efter det i global search, verificér det vises.

- [ ] **Step 3: Commit**

```bash
git add src/actions/search.ts
git commit -m "feat: company notes i global søgning"
```
