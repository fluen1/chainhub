// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const saveFieldDecisionMock = vi.fn()
const approveDocumentReviewMock = vi.fn()
const rejectDocumentExtractionMock = vi.fn()

vi.mock('@/actions/document-review', () => ({
  saveFieldDecision: (...args: unknown[]) => saveFieldDecisionMock(...args),
  approveDocumentReview: (...args: unknown[]) => approveDocumentReviewMock(...args),
  rejectDocumentExtraction: (...args: unknown[]) => rejectDocumentExtractionMock(...args),
}))

import ReviewClient from '@/app/(dashboard)/documents/review/[id]/review-client'
import type {
  ReviewDocument,
  ReviewField,
} from '@/app/(dashboard)/documents/review/[id]/review-client'
import type { SourceBlock } from '@/app/(dashboard)/documents/review/[id]/page'

function buildField(overrides: Partial<ReviewField> = {}): ReviewField {
  return {
    id: 'f1',
    fieldName: 'effective_date',
    fieldLabel: 'Ikrafttrædelsesdato',
    extractedValue: '2026-03-15',
    existingValue: '2026-01-01',
    confidence: 0.6,
    confidenceLevel: 'medium',
    sourcePageNumber: 1,
    sourceParagraph: '§ 1',
    sourceText: 'Aftalen træder i kraft den 15. marts 2026',
    hasDiscrepancy: false,
    category: 'general',
    legalCritical: false,
    isAttention: true,
    autoAcceptThreshold: 0.9,
    ...overrides,
  }
}

function buildDoc(fields: ReviewField[]): ReviewDocument {
  return {
    id: 'd1',
    fileName: 'ejeraftale.pdf',
    companyName: 'Test Klinik ApS',
    extractionId: 'ext-1',
    hasExtraction: true,
    isReviewed: false,
    reviewedBy: null,
    schemaVersion: 'v1.0.0',
    promptVersion: 'v1',
    fields,
    decidedFieldNames: [],
  }
}

const emptyBlocks: SourceBlock[] = []
const emptyQueue = [{ id: 'd1', fileName: 'ejeraftale.pdf' }]

describe('ReviewClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveFieldDecisionMock.mockResolvedValue({ data: { correctionId: 'c1' } })
  })

  it('renderer attention-sektion med feltet', () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    expect(screen.getByText('Ikrafttrædelsesdato')).toBeTruthy()
    expect(screen.getByText('Kræver opmærksomhed')).toBeTruthy()
  })

  it('viser "Juridisk"-badge for legalCritical-felter', () => {
    const field = buildField({ legalCritical: true })
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    expect(screen.getByText('Juridisk')).toBeTruthy()
  })

  it('klik "Ret manuelt" åbner inline input pre-udfyldt med AI-værdi', () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /ret manuelt/i }))
    const input = screen.getByPlaceholderText(/indtast korrekt værdi/i) as HTMLInputElement
    expect(input.value).toBe('2026-03-15')
  })

  it('Enter gemmer via saveFieldDecision med manualValue', async () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /ret manuelt/i }))
    const input = screen.getByPlaceholderText(/indtast korrekt værdi/i)
    fireEvent.change(input, { target: { value: '2026-04-01' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(saveFieldDecisionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: 'manual',
          manualValue: '2026-04-01',
          fieldName: 'effective_date',
        })
      )
    })
  })

  it('Escape annullerer uden at kalde saveFieldDecision', () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /ret manuelt/i }))
    const input = screen.getByPlaceholderText(/indtast korrekt værdi/i)
    fireEvent.change(input, { target: { value: 'nyværdi' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(saveFieldDecisionMock).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText(/indtast korrekt værdi/i)).toBeNull()
  })

  it('Godkend-knap disabled når attention-felter ikke er besluttet', () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    const approve = screen.getByRole('button', { name: /godkend/i })
    expect(approve.hasAttribute('disabled')).toBe(true)
  })

  it('"Afvis"-knap åbner rejection-dialog', () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^afvis$/i }))
    expect(screen.getByText('Afvis extraction')).toBeTruthy()
    expect(screen.getByPlaceholderText(/årsag/i)).toBeTruthy()
  })

  it('"Afvis dokumentet" i dialogen kalder rejectDocumentExtraction', async () => {
    rejectDocumentExtractionMock.mockResolvedValue({ data: undefined })
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^afvis$/i }))
    const textarea = screen.getByPlaceholderText(/årsag/i)
    fireEvent.change(textarea, { target: { value: 'Forkert dokumenttype' } })

    // Scope til dialogen for at ramme "Afvis dokumentet"-knappen (ikke den ydre "Afvis")
    const dialogHeading = screen.getByText('Afvis extraction')
    const dialog = dialogHeading.closest('div.bg-white') as HTMLElement
    fireEvent.click(within(dialog).getByRole('button', { name: /afvis dokumentet/i }))

    await waitFor(() => {
      expect(rejectDocumentExtractionMock).toHaveBeenCalledWith({
        extractionId: 'ext-1',
        reason: 'Forkert dokumenttype',
      })
    })
  })

  it('renderer sourceBlocks i venstre panel i stedet for mockPdfBlocks', () => {
    const field = buildField()
    const blocks: SourceBlock[] = [
      { id: 'b1', page: 1, paragraph: '§ 3', text: 'Ejerandele: 60% / 40%.' },
    ]
    render(
      <ReviewClient document={buildDoc([field])} reviewQueue={emptyQueue} sourceBlocks={blocks} />
    )
    expect(screen.getByText('§ 3')).toBeTruthy()
    expect(screen.getByText(/Ejerandele: 60%/)).toBeTruthy()
  })

  it('fallback-tekst når sourceBlocks er tom', () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    expect(screen.getByText(/har ikke registreret source-blokke/)).toBeTruthy()
  })

  it('rejection-dialog har role="dialog" og aria-modal', async () => {
    const field = buildField()
    const { container } = render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    // Open the dialog
    const afvisButtons = container.querySelectorAll('button')
    const outerAfvis = Array.from(afvisButtons).find(
      (b) => b.textContent?.trim().toLowerCase() === 'afvis'
    )
    if (!outerAfvis) throw new Error('Afvis-knap ikke fundet')
    fireEvent.click(outerAfvis)

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('reject-dialog-title')
  })

  it('Escape i textarea lukker rejection-dialog', async () => {
    const field = buildField()
    const { container } = render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    const afvisButtons = container.querySelectorAll('button')
    const outerAfvis = Array.from(afvisButtons).find(
      (b) => b.textContent?.trim().toLowerCase() === 'afvis'
    )
    if (!outerAfvis) throw new Error('Afvis-knap ikke fundet')
    fireEvent.click(outerAfvis)

    const textarea = screen.getByPlaceholderText(/årsag/i)
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
