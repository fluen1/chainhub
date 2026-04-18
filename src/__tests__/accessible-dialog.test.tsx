// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccessibleDialog } from '@/components/ui/accessible-dialog'

describe('AccessibleDialog', () => {
  it('renderer ikke når open=false', () => {
    render(
      <AccessibleDialog open={false} onClose={() => {}} title="Test">
        <p>Indhold</p>
      </AccessibleDialog>
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renderer med role=dialog + aria-modal=true', () => {
    render(
      <AccessibleDialog open={true} onClose={() => {}} title="Test">
        <p>Indhold</p>
      </AccessibleDialog>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('aria-labelledby peger på titlen', () => {
    render(
      <AccessibleDialog open={true} onClose={() => {}} title="Test-titel" titleId="t1">
        <p>Indhold</p>
      </AccessibleDialog>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-labelledby')).toBe('t1')
    expect(screen.getByText('Test-titel').id).toBe('t1')
  })

  it('Escape-tast kalder onClose', () => {
    const onClose = vi.fn()
    render(
      <AccessibleDialog open={true} onClose={onClose} title="Test">
        <button>Knap</button>
      </AccessibleDialog>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('klik på backdrop kalder onClose', () => {
    const onClose = vi.fn()
    const { container } = render(
      <AccessibleDialog open={true} onClose={onClose} title="Test">
        <p>Indhold</p>
      </AccessibleDialog>
    )
    fireEvent.mouseDown(container.firstChild as Element)
    expect(onClose).toHaveBeenCalled()
  })
})
