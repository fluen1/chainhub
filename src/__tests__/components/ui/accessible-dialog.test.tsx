import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AccessibleDialog } from '@/components/ui/accessible-dialog'

// ── helpers ───────────────────────────────────────────────────────────────────

function renderDialog(props: Partial<Parameters<typeof AccessibleDialog>[0]> = {}) {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    title: 'Bekræft sletning',
    children: <p>Er du sikker?</p>,
    ...props,
  }
  return render(<AccessibleDialog {...defaults} />)
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AccessibleDialog', () => {
  it('renderer dialog når open=true', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renderer ikke når open=false', () => {
    const { container } = renderDialog({ open: false })
    expect(container.firstChild).toBeNull()
  })

  it('viser titlen', () => {
    renderDialog()
    expect(screen.getByText('Bekræft sletning')).toBeInTheDocument()
  })

  it('renderer children', () => {
    renderDialog()
    expect(screen.getByText('Er du sikker?')).toBeInTheDocument()
  })

  it('har aria-modal="true"', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('har aria-labelledby der peger på titel-id', () => {
    renderDialog({ titleId: 'my-dialog-title' })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 'my-dialog-title')
    expect(screen.getByText('Bekræft sletning')).toHaveAttribute('id', 'my-dialog-title')
  })

  it('bruger default titleId="dialog-title"', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title')
  })

  it('kalder onClose ved Escape-tast', () => {
    const onClose = vi.fn()
    renderDialog({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('kalder ikke onClose på andre taster', () => {
    const onClose = vi.fn()
    renderDialog({ onClose })
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('kalder onClose ved klik på backdrop', () => {
    const onClose = vi.fn()
    const { container } = renderDialog({ onClose })
    // Backdrop er container.firstChild
    const backdrop = container.firstChild as HTMLElement
    fireEvent.mouseDown(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('kalder ikke onClose ved klik inde i dialog-boksen', () => {
    const onClose = vi.fn()
    renderDialog({ onClose })
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('accepterer custom className på dialog-boksen', () => {
    renderDialog({ className: 'max-w-2xl' })
    expect(screen.getByRole('dialog').className).toContain('max-w-2xl')
  })

  it('lytter ikke på Escape når open=false', () => {
    const onClose = vi.fn()
    renderDialog({ open: false, onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
