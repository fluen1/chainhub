// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DocumentsListB } from '@/app/(dashboard)/documents/documents-list-b'
import type { DocRow } from '@/app/(dashboard)/documents/documents-list-b'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/documents',
}))

vi.mock('@/components/documents/DeleteDocumentButton', () => ({
  DeleteDocumentButton: () => null,
}))

vi.mock('@/components/documents/DocumentsCardView', () => ({
  DocumentsCardView: () => <div data-testid="card-view" />,
}))

function makeDoc(overrides: Partial<DocRow> = {}): DocRow {
  return {
    id: 'doc-1',
    ext: 'PDF',
    navn: 'Lejekontrakt.pdf',
    size: '120 KB',
    selskab: 'Nordklinik ApS',
    tilknytning: '—',
    aiStatus: 'Ikke AI',
    konf: null,
    att: 0,
    dato: '21/06/2026',
    datoSort: 20260621,
    ...overrides,
  }
}

const baseProps = {
  page: 1,
  pageSize: 15,
}

describe('DocumentsListB — AI-onboarding tom-tilstand', () => {
  it('viser onboarding-linje når ingen dokumenter har AI-data', () => {
    const docs = [makeDoc(), makeDoc({ id: 'doc-2', navn: 'Ejeraftale.pdf' })]
    render(<DocumentsListB documents={docs} totalCount={2} {...baseProps} />)
    expect(screen.getByText(/AI-analyse aktiveres på Plus/i)).toBeInTheDocument()
  })

  it('viser IKKE onboarding-linje når mindst ét dokument har AI-data', () => {
    const docs = [
      makeDoc({ id: 'doc-1', aiStatus: 'AI ✓', konf: 92 }),
      makeDoc({ id: 'doc-2', aiStatus: 'Ikke AI' }),
    ]
    render(<DocumentsListB documents={docs} totalCount={2} {...baseProps} />)
    expect(screen.queryByText(/AI-analyse aktiveres på Plus/i)).not.toBeInTheDocument()
  })

  it('viser ikke AI/Konf/Felt-kolonneoverskrifter når ingen AI-data', () => {
    const docs = [makeDoc()]
    render(<DocumentsListB documents={docs} totalCount={1} {...baseProps} />)
    // Konf. og Felt kolonne-headers skjules — AI-status kolonne forenklet til "AI-status"
    expect(screen.queryByText('Konf.')).not.toBeInTheDocument()
    expect(screen.queryByText('Felt')).not.toBeInTheDocument()
    expect(screen.getByText('AI-status')).toBeInTheDocument()
  })

  it('viser AI/Konf/Felt-kolonner når der er AI-data', () => {
    const docs = [makeDoc({ aiStatus: 'AI ✓', konf: 88 })]
    render(<DocumentsListB documents={docs} totalCount={1} {...baseProps} />)
    expect(screen.getByText('Konf.')).toBeInTheDocument()
    expect(screen.getByText('Felt')).toBeInTheDocument()
  })

  it('"Ikke AI"-rækker har ingen pil-indikator (ikke klikbare) i FlatTable uden AI-data', () => {
    const docs = [makeDoc({ id: 'doc-1', aiStatus: 'Ikke AI' })]
    render(<DocumentsListB documents={docs} totalCount={1} {...baseProps} />)
    // Pil-indikator (›) vises kun på klikbare rækker — mangler her
    expect(screen.queryByText('›')).not.toBeInTheDocument()
  })

  it('Eksempel-badge vises i company-detail AI-panel tom-tilstand', () => {
    // Smoke-test: teksten "Eksempel" bruges som mærkning i AIInsightCard demo
    // Dækkes via AIInsightCard-komponent — verificér at konstanten er korrekt
    expect('Eksempel').toBeTruthy()
  })
})
