import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EnrichmentPanel } from '@/components/documents/EnrichmentPanel'
import type { DocumentEnrichmentData } from '@/actions/document-enrichment'

// next/link renders as <a> in tests
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const baseData: DocumentEnrichmentData = {
  extractionId: 'ext-1',
  detectedType: 'ANSAETTELSESKONTRAKT',
  typeConfidence: 0.92,
  extractedFields: {
    effective_date: { value: '2026-01-01', claude_confidence: 0.95 },
    party_name: { value: 'Philip Birkenborg', claude_confidence: 0.88 },
  },
  entityMatches: [
    {
      entity_type: 'company',
      entity_id: 'company-1',
      entity_name: 'Tandlæge Østerbro ApS',
      confidence: 0.9,
      match_reason: 'CVR-nummer matcher',
    },
    {
      entity_type: 'person',
      entity_id: 'person-1',
      entity_name: 'Philip Birkenborg',
      confidence: 0.85,
      match_reason: 'Navn og CPR-match',
    },
  ],
  status: 'completed',
}

describe('EnrichmentPanel', () => {
  it('renderer ingenting når data er null', () => {
    const { container } = render(<EnrichmentPanel data={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('viser detekteret dokumenttype', () => {
    render(<EnrichmentPanel data={baseData} />)
    expect(screen.getByText('ANSAETTELSESKONTRAKT')).toBeInTheDocument()
  })

  it('viser confidence-procent for dokumenttype', () => {
    render(<EnrichmentPanel data={baseData} />)
    expect(screen.getByText('92 %')).toBeInTheDocument()
  })

  it('viser entity matches med links til selskaber og personer', () => {
    render(<EnrichmentPanel data={baseData} />)
    const companyLink = screen.getByRole('link', { name: /Tandlæge Østerbro/i })
    expect(companyLink).toHaveAttribute('href', '/companies/company-1')

    const personLink = screen.getByRole('link', { name: /Philip Birkenborg/i })
    expect(personLink).toHaveAttribute('href', '/persons/person-1')
  })

  it('viser match_reason for entity matches', () => {
    render(<EnrichmentPanel data={baseData} />)
    expect(screen.getByText('CVR-nummer matcher')).toBeInTheDocument()
  })

  it('viser udtrukne felter med labels', () => {
    render(<EnrichmentPanel data={baseData} />)
    // Feltnavn effective_date → "Effective date"
    expect(screen.getByText('Effective date')).toBeInTheDocument()
    // Feltværdi
    expect(screen.getByText('2026-01-01')).toBeInTheDocument()
  })

  it('viser tom-state for entity matches når listen er tom', () => {
    render(<EnrichmentPanel data={{ ...baseData, entityMatches: [] }} />)
    expect(screen.getByText('Ingen relationer fundet')).toBeInTheDocument()
  })

  it('viser tom-state for dokumenttype når detectedType er null', () => {
    render(<EnrichmentPanel data={{ ...baseData, detectedType: null, typeConfidence: null }} />)
    expect(screen.getByText('Ingen dokumenttype detekteret')).toBeInTheDocument()
  })

  it('viser ingen felter-panel når extractedFields er tomt', () => {
    render(<EnrichmentPanel data={{ ...baseData, extractedFields: {} }} />)
    expect(screen.queryByText('Udtrukne felter')).not.toBeInTheDocument()
  })

  it('viser kopier-knapper for felter', () => {
    render(<EnrichmentPanel data={baseData} />)
    const copyButtons = screen.getAllByRole('button', { name: /Kopiér/i })
    expect(copyButtons.length).toBeGreaterThan(0)
  })
})
