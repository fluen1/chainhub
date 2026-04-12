import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DocumentsSection, type DocumentRow } from '@/components/company-detail/documents-section'

const rows: DocumentRow[] = [
  { id: '1', isAiExtracted: true, fileName: 'Ejeraftale v3.pdf', meta: 'Uploadet i dag · AI-behandlet', badge: { label: 'Til review', tone: 'purple' } },
  { id: '2', isAiExtracted: false, fileName: 'Aarsregnskab 2025.pdf', meta: 'Uploadet 20. mar 2026', badge: { label: 'Arkiveret', tone: 'green' } },
]

describe('DocumentsSection', () => {
  it('viser tom-state ved 0 dokumenter', () => {
    render(<DocumentsSection documents={[]} awaitingReviewCount={0} />)
    expect(screen.getByText('Ingen dokumenter uploadet')).toBeInTheDocument()
  })

  it('viser AI-ikon for extracted dokumenter', () => {
    render(<DocumentsSection documents={rows} awaitingReviewCount={1} />)
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })

  it('viser badge med antal til review', () => {
    render(<DocumentsSection documents={rows} awaitingReviewCount={1} />)
    expect(screen.getByText('1 til review')).toBeInTheDocument()
  })

  it('linker til /documents/review/<id>', () => {
    render(<DocumentsSection documents={rows} awaitingReviewCount={0} />)
    const link = screen.getByRole('link', { name: /Ejeraftale v3.pdf/ })
    expect(link).toHaveAttribute('href', '/documents/review/1')
  })
})
