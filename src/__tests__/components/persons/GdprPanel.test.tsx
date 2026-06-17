import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GdprPanel } from '@/components/persons/GdprPanel'

vi.mock('@/actions/gdpr', () => ({
  prepareGdprExport: vi.fn(),
  executeGdprDelete: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/accessible-dialog', () => ({
  AccessibleDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
}))

describe('GdprPanel', () => {
  it('rendrer ikke når isAdmin=false', () => {
    const { container } = render(
      <GdprPanel personId="p-1" personFullName="Test Person" isAdmin={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('viser GDPR-panel når isAdmin=true', () => {
    render(<GdprPanel personId="p-1" personFullName="Test Person" isAdmin={true} />)
    expect(screen.getByText('GDPR — Persondata')).toBeInTheDocument()
  })
})
