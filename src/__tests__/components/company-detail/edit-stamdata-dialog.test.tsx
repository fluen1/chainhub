import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditStamdataDialog } from '@/components/company-detail/edit-stamdata-dialog'

vi.mock('@/actions/companies', () => ({
  updateCompanyStamdata: vi.fn().mockResolvedValue({ data: undefined }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('EditStamdataDialog', () => {
  const initial = {
    name: 'Nordklinik ApS',
    cvr: '12345678',
    address: 'Hovedgaden 1',
    city: 'Odense',
    postal_code: '5000',
    founded_date: new Date('2019-01-15'),
  }

  it('viser trigger-button lukket initialt', () => {
    render(<EditStamdataDialog companyId="abc" initial={initial} />)
    expect(screen.getByText('Rediger stamdata')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('aabner modal ved klik paa trigger', () => {
    render(<EditStamdataDialog companyId="abc" initial={initial} />)
    fireEvent.click(screen.getByText('Rediger stamdata'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Nordklinik ApS')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12345678')).toBeInTheDocument()
  })

  it('lukker modal ved klik paa Annuller', () => {
    render(<EditStamdataDialog companyId="abc" initial={initial} />)
    fireEvent.click(screen.getByText('Rediger stamdata'))
    fireEvent.click(screen.getByText('Annuller'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('trigger-button er disabled ved disabled prop', () => {
    render(<EditStamdataDialog companyId="abc" initial={initial} disabled />)
    const btn = screen.getByText('Rediger stamdata') as HTMLButtonElement
    expect(btn).toBeDisabled()
  })
})
