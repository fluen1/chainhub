// @vitest-environment jsdom

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock deleteDocument action
vi.mock('@/actions/documents', () => ({
  deleteDocument: vi.fn(),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock next/navigation
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { deleteDocument } from '@/actions/documents'
import { DeleteDocumentButton } from '@/components/documents/DeleteDocumentButton'
import { toast } from 'sonner'

describe('DeleteDocumentButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderer trash-ikon-knap uden at vise dialog', () => {
    render(<DeleteDocumentButton documentId="doc-1" fileName="kontrakt.pdf" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTitle('Slet dokument')).toBeTruthy()
  })

  it('åbner dialog ved klik og viser filnavn', () => {
    render(<DeleteDocumentButton documentId="doc-1" fileName="kontrakt.pdf" />)
    fireEvent.click(screen.getByTitle('Slet dokument'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/kontrakt\.pdf/)).toBeTruthy()
  })

  it('confirm-flow kalder deleteDocument og viser toast.success', async () => {
    ;(deleteDocument as ReturnType<typeof vi.fn>).mockResolvedValue({ data: undefined })

    render(<DeleteDocumentButton documentId="doc-42" fileName="aftale.docx" />)
    fireEvent.click(screen.getByTitle('Slet dokument'))

    // Find confirm-knap via dialog-rolle — den har rød bg-klasse
    const dialog = screen.getByRole('dialog')
    const confirmBtn = dialog.querySelector('button.bg-red-600') as HTMLButtonElement
    expect(confirmBtn).toBeTruthy()
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteDocument).toHaveBeenCalledWith('doc-42')
      expect(toast.success).toHaveBeenCalledWith('Dokument slettet')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('fejl fra deleteDocument viser toast.error og lukker IKKE dialog', async () => {
    ;(deleteDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: 'Ingen adgang til dette dokument',
    })

    render(<DeleteDocumentButton documentId="doc-99" fileName="fejl.pdf" />)
    fireEvent.click(screen.getByTitle('Slet dokument'))

    const dialog = screen.getByRole('dialog')
    const confirmBtn = dialog.querySelector('button.bg-red-600') as HTMLButtonElement
    expect(confirmBtn).toBeTruthy()
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Ingen adgang til dette dokument')
      expect(mockRefresh).not.toHaveBeenCalled()
    })
  })

  it('viser tilknytningsadvarsel når kontraktnavn er angivet', () => {
    render(
      <DeleteDocumentButton
        documentId="doc-1"
        fileName="bilag.pdf"
        contractName="Ejeraftale 2024"
      />
    )
    fireEvent.click(screen.getByTitle('Slet dokument'))
    expect(screen.getByText(/Ejeraftale 2024/)).toBeTruthy()
    expect(screen.getByText(/kontrakten/)).toBeTruthy()
  })
})
