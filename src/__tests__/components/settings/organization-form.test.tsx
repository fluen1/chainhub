import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrganizationForm } from '@/components/settings/organization-form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/actions/organizations', () => ({
  updateOrganization: vi.fn().mockResolvedValue({ data: { name: 'x' } }),
}))

describe('OrganizationForm', () => {
  it('renderer navn, CVR og kædestruktur med initialværdier', () => {
    render(
      <OrganizationForm
        initialName="TandlægeGruppen A/S"
        initialCvr="10000001"
        initialChainStructure={true}
      />
    )
    expect(screen.getByDisplayValue('TandlægeGruppen A/S')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10000001')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('håndterer null CVR som tomt input', () => {
    render(
      <OrganizationForm
        initialName="Test ApS"
        initialCvr={null}
        initialChainStructure={false}
      />
    )
    const cvrInput = screen.getByPlaceholderText('12345678') as HTMLInputElement
    expect(cvrInput.value).toBe('')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('disabler submit når formen er uændret', () => {
    render(
      <OrganizationForm
        initialName="Test ApS"
        initialCvr="10000001"
        initialChainStructure={false}
      />
    )
    const button = screen.getByRole('button', { name: /Gem ændringer/ })
    expect(button).toBeDisabled()
  })

  it('aktiverer submit når navnet ændres', () => {
    render(
      <OrganizationForm
        initialName="Test ApS"
        initialCvr="10000001"
        initialChainStructure={false}
      />
    )
    const nameInput = screen.getByDisplayValue('Test ApS')
    fireEvent.change(nameInput, { target: { value: 'Test ApS 2' } })
    const button = screen.getByRole('button', { name: /Gem ændringer/ })
    expect(button).not.toBeDisabled()
  })

  it('filterer ikke-cifre væk fra CVR-input', () => {
    render(
      <OrganizationForm
        initialName="Test ApS"
        initialCvr=""
        initialChainStructure={false}
      />
    )
    const cvrInput = screen.getByPlaceholderText('12345678') as HTMLInputElement
    fireEvent.change(cvrInput, { target: { value: '12-34 5678abc' } })
    expect(cvrInput.value).toBe('12345678')
  })
})
