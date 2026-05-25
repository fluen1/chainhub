# Goal 3: Feature Completion — Feature-komplethed → 10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Løft Feature-komplethed (7.5→10) med 3 manglende features: kalender-redigering, dokument-godkendelsesworkflow, export-preview.

**Architecture:** Kalender-redigering åbner en edit-modal for besøg direkte fra kalender-viewet (besøg er den eneste entitet der giver mening at redigere inline — kontrakter/opgaver/sager har egne detaljesider). Dokument-godkendelse tilføjer DocumentStatus enum + reviewDocument action. Export-preview viser data i en modal før download (ingen PDF-generation — for tungt en dependency for nuværende scope).

**Tech Stack:** React, Server Actions, Prisma migration, Zod, shadcn-inspireret modal-pattern

**BEMÆRK:** Task 2 kræver `npx prisma migrate dev` mod en kørende database. Hvis OneDrive låser `.prisma/client`, stop OneDrive sync midlertidigt.

---

### Task 1: Kalender-redigering — Visit edit-modal

**Files:**

- Create: `src/components/calendar/edit-visit-modal.tsx`
- Modify: `src/app/(dashboard)/calendar/calendar-b.tsx`
- Modify: `src/actions/calendar.ts` (tilføj visit_type til CalendarEvent)

- [ ] **Step 1: Udvid CalendarEvent med sourceId og sourceType**

I `src/types/ui.ts`, tilføj felter til CalendarEvent:

```typescript
export interface CalendarEvent {
  id: string
  date: string
  title: string
  subtitle: string
  type: CalendarEventType
  aiExtracted?: boolean
  href: string
  sourceType?: 'contract' | 'task' | 'visit' | 'case'
  sourceId?: string
}
```

I `src/actions/calendar.ts`, tilføj `sourceType` og `sourceId` til visit-events:

Find visit-mapping (where visits are mapped to CalendarEvent[]) og tilføj:

```typescript
sourceType: 'visit' as const,
sourceId: v.id,
```

- [ ] **Step 2: Opret EditVisitModal**

```typescript
// src/components/calendar/edit-visit-modal.tsx
'use client'

import { useState, useTransition } from 'react'
import { X, Calendar, FileText, Check, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { updateVisit, deleteVisit } from '@/actions/visits'
import { getVisitStatusLabel, getVisitTypeLabel } from '@/lib/labels'

interface EditVisitModalProps {
  open: boolean
  onClose: () => void
  visit: {
    id: string
    title: string
    date: string
    status?: string
    notes?: string
    summary?: string
  }
}

export function EditVisitModal({ open, onClose, visit }: EditVisitModalProps) {
  const [notes, setNotes] = useState(visit.notes ?? '')
  const [summary, setSummary] = useState(visit.summary ?? '')
  const [status, setStatus] = useState(visit.status ?? 'PLANLAGT')
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  function handleSave() {
    startTransition(async () => {
      const result = await updateVisit({
        visitId: visit.id,
        status,
        notes,
        summary,
      })
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Besøg opdateret')
        onClose()
      }
    })
  }

  function handleDelete() {
    if (!confirm('Er du sikker på at du vil slette dette besøg?')) return
    startTransition(async () => {
      const result = await deleteVisit(visit.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Besøg slettet')
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rediger besøg"
        className="relative z-10 w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Rediger besøg</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-zinc-100" aria-label="Luk">
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium text-zinc-500">Besøg</p>
            <p className="text-sm text-zinc-900">{visit.title}</p>
            <p className="text-xs text-zinc-500">{visit.date}</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="PLANLAGT">Planlagt</option>
              <option value="GENNEMFOERT">Gennemført</option>
              <option value="AFLYST">Aflyst</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Noter</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              placeholder="Skriv noter..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Opsummering</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              placeholder="Kort opsummering af besøget..."
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Slet besøg
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              Annuller
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Gem
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Integrér i calendar-b.tsx**

I `calendar-b.tsx`:

1. Tilføj import øverst:

```typescript
import { EditVisitModal } from '@/components/calendar/edit-visit-modal'
```

2. Tilføj state i `CalendarPageB`:

```typescript
const [editVisit, setEditVisit] = useState<CalendarEvent | null>(null)
```

3. I event-pill renderings (både grid og agenda), tilføj onClick handler for visit-events:

```typescript
onClick={(e) => {
  if (ev.sourceType === 'visit') {
    e.preventDefault()
    setEditVisit(ev)
  }
}}
className={`... ${ev.sourceType === 'visit' ? 'cursor-pointer' : ''}`}
```

4. Tilføj modal før slut af return:

```typescript
{editVisit && editVisit.sourceType === 'visit' && (
  <EditVisitModal
    open={true}
    onClose={() => setEditVisit(null)}
    visit={{
      id: editVisit.sourceId!,
      title: editVisit.title,
      date: editVisit.date,
    }}
  />
)}
```

- [ ] **Step 4: Kør tests + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/ui.ts src/actions/calendar.ts src/components/calendar/ src/app/(dashboard)/calendar/calendar-b.tsx
git commit -m "feat: redigér besøg direkte fra kalender via edit-modal"
```

---

### Task 2: Dokument-godkendelsesworkflow — Schema + Actions

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `src/lib/validations/document-review.ts`
- Modify: `src/actions/documents.ts`
- Modify: `src/lib/labels.ts`

- [ ] **Step 1: Tilføj DocumentStatus enum og felt**

I `prisma/schema.prisma`:

```prisma
enum DocumentStatus {
  KLADDE     @map("draft")
  TIL_REVIEW @map("pending_review")
  GODKENDT   @map("approved")
  AFVIST     @map("rejected")

  @@map("document_status")
}
```

Tilføj felt til Document model:

```prisma
model Document {
  // ... eksisterende felter ...
  status         DocumentStatus  @default(KLADDE)
  reviewed_at    DateTime?
  reviewed_by    String?
  review_comment String?
  reviewer       User?           @relation("document_reviewer", fields: [reviewed_by], references: [id])
}
```

Tilføj relation i User model:

```prisma
// I User model:
documentReviews  Document[] @relation("document_reviewer")
```

- [ ] **Step 2: Kør Prisma generate (kræver database)**

Run: `npx prisma generate`
Derefter: `npx prisma migrate dev --name add-document-status`

- [ ] **Step 3: Tilføj labels**

I `src/lib/labels.ts`:

```typescript
export function getDocumentStatusLabel(status: string): string {
  switch (status) {
    case 'KLADDE':
      return 'Kladde'
    case 'TIL_REVIEW':
      return 'Til godkendelse'
    case 'GODKENDT':
      return 'Godkendt'
    case 'AFVIST':
      return 'Afvist'
    default:
      return status
  }
}

export function getDocumentStatusColor(status: string): string {
  switch (status) {
    case 'KLADDE':
      return 'bg-zinc-100 text-zinc-600'
    case 'TIL_REVIEW':
      return 'bg-amber-50 text-amber-700'
    case 'GODKENDT':
      return 'bg-green-50 text-green-700'
    case 'AFVIST':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-zinc-100 text-zinc-600'
  }
}
```

- [ ] **Step 4: Tilføj Zod schemas**

```typescript
// src/lib/validations/document-review.ts
import { z } from 'zod'

export const submitForReviewSchema = z.object({
  documentId: z.string().min(1),
})

export const reviewDocumentSchema = z.object({
  documentId: z.string().min(1),
  decision: z.enum(['GODKENDT', 'AFVIST']),
  comment: z.string().optional(),
})
```

- [ ] **Step 5: Tilføj review-actions**

I `src/actions/documents.ts`, tilføj:

```typescript
import { submitForReviewSchema, reviewDocumentSchema } from '@/lib/validations/document-review'

export async function submitDocumentForReview(input: unknown): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = submitForReviewSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const doc = await prisma.document.findFirst({
    where: {
      id: parsed.data.documentId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true, status: true, company_id: true },
  })
  if (!doc) return { error: 'Dokument ikke fundet' }

  if (doc.status !== 'KLADDE') {
    return { error: 'Kun kladde-dokumenter kan sendes til godkendelse' }
  }

  if (doc.company_id) {
    const hasAccess = await canAccessCompany(
      session.user.id,
      doc.company_id,
      session.user.organizationId
    )
    if (!hasAccess) return { error: 'Ingen adgang til dette dokument' }
  }

  await prisma.document.update({
    where: { id: parsed.data.documentId },
    data: { status: 'TIL_REVIEW' },
  })

  revalidatePath('/documents')
  return { data: undefined }
}

export async function reviewDocument(input: unknown): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = reviewDocumentSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const doc = await prisma.document.findFirst({
    where: {
      id: parsed.data.documentId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true, status: true, company_id: true },
  })
  if (!doc) return { error: 'Dokument ikke fundet' }

  if (doc.status !== 'TIL_REVIEW') {
    return { error: 'Kun dokumenter til godkendelse kan reviewes' }
  }

  if (doc.company_id) {
    const hasAccess = await canAccessCompany(
      session.user.id,
      doc.company_id,
      session.user.organizationId
    )
    if (!hasAccess) return { error: 'Ingen adgang til dette dokument' }
  }

  await prisma.document.update({
    where: { id: parsed.data.documentId },
    data: {
      status: parsed.data.decision,
      reviewed_at: new Date(),
      reviewed_by: session.user.id,
      review_comment: parsed.data.comment || null,
    },
  })

  revalidatePath('/documents')
  revalidatePath(`/documents/${parsed.data.documentId}`)
  return { data: undefined }
}
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/validations/document-review.ts src/actions/documents.ts src/lib/labels.ts
git commit -m "feat: dokument-godkendelsesworkflow — schema, actions, labels"
```

---

### Task 3: Dokument-godkendelses-UI

**Files:**

- Modify: `src/app/(dashboard)/documents/page.tsx` eller dokument-list komponent (vis status-badge)
- Create: `src/components/documents/document-review-actions.tsx`

- [ ] **Step 1: Opret ReviewActions komponent**

```typescript
// src/components/documents/document-review-actions.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { submitDocumentForReview, reviewDocument } from '@/actions/documents'
import { getDocumentStatusLabel, getDocumentStatusColor } from '@/lib/labels'

interface DocumentReviewActionsProps {
  documentId: string
  status: string
  canReview: boolean
}

export function DocumentReviewActions({ documentId, status, canReview }: DocumentReviewActionsProps) {
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmitForReview() {
    startTransition(async () => {
      const result = await submitDocumentForReview({ documentId })
      if ('error' in result) toast.error(result.error)
      else toast.success('Dokument sendt til godkendelse')
    })
  }

  function handleReview(decision: 'GODKENDT' | 'AFVIST') {
    startTransition(async () => {
      const result = await reviewDocument({ documentId, decision, comment })
      if ('error' in result) toast.error(result.error)
      else toast.success(decision === 'GODKENDT' ? 'Dokument godkendt' : 'Dokument afvist')
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getDocumentStatusColor(status)}`}>
          {getDocumentStatusLabel(status)}
        </span>
      </div>

      {status === 'KLADDE' && (
        <button
          onClick={handleSubmitForReview}
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          Send til godkendelse
        </button>
      )}

      {status === 'TIL_REVIEW' && canReview && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Kommentar (valgfri)..."
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm min-h-[40px] resize-y focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleReview('GODKENDT')}
              disabled={isPending}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Godkend
            </button>
            <button
              onClick={() => handleReview('AFVIST')}
              disabled={isPending}
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Afvis
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrér status-badge i dokument-liste**

I den komponent der renderer dokument-rækker, tilføj status-badge med `getDocumentStatusLabel` og `getDocumentStatusColor`. Tilføj `status` til DocRow-typen og inkludér det i getDocumentsPageData.

- [ ] **Step 3: Commit**

```bash
git add src/components/documents/ src/app/(dashboard)/documents/
git commit -m "feat: dokument-godkendelses UI — status-badge + review-actions"
```

---

### Task 4: Export preview-modal

**Files:**

- Create: `src/components/export/export-preview-modal.tsx`
- Modify: Eksport-knapper i relevante sider

- [ ] **Step 1: Opret ExportPreviewModal**

```typescript
// src/components/export/export-preview-modal.tsx
'use client'

import { useState, useTransition } from 'react'
import { X, Download, Eye } from 'lucide-react'

interface ExportPreviewModalProps {
  open: boolean
  onClose: () => void
  entity: string
  columns: string[]
  rows: Array<Record<string, string | number | null>>
  downloadUrl: string
}

export function ExportPreviewModal({
  open,
  onClose,
  entity,
  columns,
  rows,
  downloadUrl,
}: ExportPreviewModalProps) {
  if (!open) return null

  const previewRows = rows.slice(0, 20)
  const hasMore = rows.length > 20

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview af ${entity}-export`}
        className="relative z-10 w-full max-w-4xl max-h-[80vh] rounded-lg border border-zinc-200 bg-white shadow-lg flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-zinc-400" />
            <h2 className="text-base font-semibold text-zinc-900">
              Preview — {entity} ({rows.length} rækker)
            </h2>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-zinc-100" aria-label="Luk">
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                {columns.map((col) => (
                  <th key={col} className="px-2 py-1.5 text-left text-xs font-medium text-zinc-500">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b border-zinc-50">
                  {columns.map((col) => (
                    <td key={col} className="px-2 py-1.5 text-zinc-700">
                      {row[col] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <p className="mt-2 text-xs text-zinc-400">
              Viser {previewRows.length} af {rows.length} rækker
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Luk
          </button>
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Tilføj preview-data action**

I `src/actions/export.ts`, tilføj en action der returnerer preview-data (første 50 rækker):

```typescript
export async function getExportPreview(entity: string): Promise<
  ActionResult<{
    columns: string[]
    rows: Array<Record<string, string | number | null>>
    totalCount: number
    downloadUrl: string
  }>
> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  // Genbrug eksisterende export-logik men med take: 50 og return som data
  // i stedet for at skrive til fil
  // ... implementér baseret på eksisterende prepareExport-logik
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/export/ src/actions/export.ts
git commit -m "feat: export preview-modal med data-tabel og download"
```

---

### Task 5: Tests for nye features

**Files:**

- Create: `src/__tests__/actions/document-review.test.ts`
- Modify: `src/__tests__/actions/calendar.test.ts` (tilføj sourceType test)

- [ ] **Step 1: Tests for dokument-review actions**

```typescript
// src/__tests__/actions/document-review.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    document: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}))
vi.mock('@/lib/permissions', () => ({ canAccessCompany: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'

const mockSession = {
  user: { id: 'u1', email: 'test@test.dk', name: 'Test', organizationId: 'org-1' },
  expires: '',
}

describe('document review actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('submitDocumentForReview', () => {
    it('returnerer fejl uden session', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const { submitDocumentForReview } = await import('@/actions/documents')
      const result = await submitDocumentForReview({ documentId: 'd1' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('returnerer fejl hvis dokument ikke er KLADDE', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(prisma.document.findFirst).mockResolvedValue({
        id: 'd1',
        status: 'GODKENDT',
        company_id: null,
      } as never)
      const { submitDocumentForReview } = await import('@/actions/documents')
      const result = await submitDocumentForReview({ documentId: 'd1' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('sender kladde til review', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(prisma.document.findFirst).mockResolvedValue({
        id: 'd1',
        status: 'KLADDE',
        company_id: null,
      } as never)
      vi.mocked(prisma.document.update).mockResolvedValue({} as never)
      const { submitDocumentForReview } = await import('@/actions/documents')
      const result = await submitDocumentForReview({ documentId: 'd1' })
      expect(result).toMatchObject({ data: undefined })
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'TIL_REVIEW' } })
      )
    })
  })

  describe('reviewDocument', () => {
    it('returnerer fejl uden session', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const { reviewDocument } = await import('@/actions/documents')
      const result = await reviewDocument({ documentId: 'd1', decision: 'GODKENDT' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('godkender dokument til review', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(prisma.document.findFirst).mockResolvedValue({
        id: 'd1',
        status: 'TIL_REVIEW',
        company_id: 'c1',
      } as never)
      vi.mocked(canAccessCompany).mockResolvedValue(true)
      vi.mocked(prisma.document.update).mockResolvedValue({} as never)
      const { reviewDocument } = await import('@/actions/documents')
      const result = await reviewDocument({
        documentId: 'd1',
        decision: 'GODKENDT',
        comment: 'Ser fint ud',
      })
      expect(result).toMatchObject({ data: undefined })
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'GODKENDT',
            reviewed_by: 'u1',
            review_comment: 'Ser fint ud',
          }),
        })
      )
    })

    it('afviser dokument uden adgang', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never)
      vi.mocked(prisma.document.findFirst).mockResolvedValue({
        id: 'd1',
        status: 'TIL_REVIEW',
        company_id: 'c1',
      } as never)
      vi.mocked(canAccessCompany).mockResolvedValue(false)
      const { reviewDocument } = await import('@/actions/documents')
      const result = await reviewDocument({ documentId: 'd1', decision: 'AFVIST' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })
})
```

- [ ] **Step 2: Kør tests**

Run: `npx vitest run src/__tests__/actions/document-review.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/actions/document-review.test.ts
git commit -m "test: dokument-review actions — auth, status-flow, adgangskontrol"
```

---

### Task 6: Final verificering

- [ ] **Step 1:** `npx vitest run` — PASS
- [ ] **Step 2:** `npx tsc --noEmit` — SUCCESS
- [ ] **Step 3:** `git log --oneline -8` — verificér alle commits
