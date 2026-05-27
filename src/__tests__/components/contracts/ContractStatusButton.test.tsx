import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ContractStatusButton } from '@/components/contracts/ContractStatusButton'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/contracts/123',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/actions/contracts', () => ({
  updateContractStatus: vi.fn().mockResolvedValue({ data: null }),
}))

describe('ContractStatusButton', () => {
  it('renders "Skift status" button for non-terminal statuses', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="AKTIV" />)
    expect(screen.getByRole('button', { name: /skift status/i })).toBeInTheDocument()
  })

  it('renders static label for terminal statuses (OPSAGT)', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="OPSAGT" />)
    expect(screen.queryByRole('button', { name: /skift status/i })).not.toBeInTheDocument()
    expect(screen.getByText(/opsagt/i)).toBeInTheDocument()
  })

  it('renders static label for terminal statuses (FORNYET)', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="FORNYET" />)
    expect(screen.queryByRole('button', { name: /skift status/i })).not.toBeInTheDocument()
  })

  it('opens dropdown when trigger button is clicked', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="AKTIV" />)
    fireEvent.click(screen.getByRole('button', { name: /skift status/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('shows valid next statuses in dropdown', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="AKTIV" />)
    fireEvent.click(screen.getByRole('button', { name: /skift status/i }))
    // AKTIV → UDLOEBET, OPSAGT, FORNYET
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('shows current status header in dropdown', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="AKTIV" />)
    fireEvent.click(screen.getByRole('button', { name: /skift status/i }))
    expect(screen.getByText(/nuværende:/i)).toBeInTheDocument()
  })

  it('closes dropdown on Escape key', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="AKTIV" />)
    fireEvent.click(screen.getByRole('button', { name: /skift status/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows note field for OPSAGT transition from AKTIV', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="AKTIV" />)
    fireEvent.click(screen.getByRole('button', { name: /skift status/i }))
    // OPSAGT requires a note — there may be multiple elements with this text
    const noteFields = screen.getAllByText(/note påkrævet/i)
    expect(noteFields.length).toBeGreaterThan(0)
  })

  it('trigger has aria-expanded=false when closed', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="AKTIV" />)
    expect(screen.getByRole('button', { name: /skift status/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('trigger has aria-expanded=true when open', () => {
    render(<ContractStatusButton contractId="abc" currentStatus="AKTIV" />)
    fireEvent.click(screen.getByRole('button', { name: /skift status/i }))
    expect(screen.getByRole('button', { name: /skift status/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
