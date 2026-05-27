import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BModal } from '@/components/ui/b/BModal'

function renderModal(overrides: Partial<Parameters<typeof BModal>[0]> = {}) {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    title: 'Test modal',
    submitLabel: 'Gem',
    children: <div>Modal indhold</div>,
  }
  return render(<BModal {...defaults} {...overrides} />)
}

describe('BModal', () => {
  it('renders nothing when open=false', () => {
    renderModal({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when open=true', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders the title', () => {
    renderModal({ title: 'Opret ejer' })
    expect(screen.getByText('Opret ejer')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    renderModal({ subtitle: 'Nuværende status: Aktiv' })
    expect(screen.getByText('Nuværende status: Aktiv')).toBeInTheDocument()
  })

  it('renders children inside dialog', () => {
    renderModal({ children: <input placeholder="Navn" /> })
    expect(screen.getByPlaceholderText('Navn')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByLabelText('Luk dialog'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Annuller button clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByText('Annuller'))
    expect(onClose).toHaveBeenCalled()
  })

  it('uses custom cancelLabel', () => {
    renderModal({ cancelLabel: 'Fortryd' })
    expect(screen.getByText('Fortryd')).toBeInTheDocument()
  })

  it('renders submit button with submitLabel', () => {
    renderModal({ submitLabel: 'Bekræft' })
    expect(screen.getByRole('button', { name: 'Bekræft' })).toBeInTheDocument()
  })

  it('disables submit button when submitDisabled=true', () => {
    renderModal({ submitDisabled: true })
    expect(screen.getByRole('button', { name: 'Gem' })).toBeDisabled()
  })

  it('shows "Gemmer..." when submitting=true', () => {
    renderModal({ submitting: true })
    expect(screen.getByText('Gemmer...')).toBeInTheDocument()
  })

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSubmit when Ctrl+Enter pressed', () => {
    const onSubmit = vi.fn()
    renderModal({ onSubmit })
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true })
    expect(onSubmit).toHaveBeenCalled()
  })

  it('has aria-modal=true', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('closes when backdrop clicked directly', () => {
    const onClose = vi.fn()
    const { container } = renderModal({ onClose })
    const backdrop = container.querySelector('.fixed.inset-0.z-50')!
    fireEvent.mouseDown(backdrop, { target: backdrop })
    expect(onClose).toHaveBeenCalled()
  })
})
