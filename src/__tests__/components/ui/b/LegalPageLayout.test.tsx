import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  LegalPageLayout,
  LegalListItem,
  LegalContactBox,
  LegalMailLink,
  LegalExternalLink,
} from '@/components/ui/b/LegalPageLayout'

// BrandMark bruger next/image + Link
vi.mock('@/components/ui/b/BrandMark', () => ({
  BrandMark: ({ withText }: { withText?: boolean }) => (
    <span data-testid="brandmark">{withText ? 'ChainHub' : '🔗'}</span>
  ),
}))

describe('LegalPageLayout', () => {
  const defaultProps = {
    title: 'Vilkår for brug',
    subtitle: 'Gælder for alle brugere',
    lastUpdated: '1. januar 2025',
    children: <p>Sektionsindhold</p>,
  }

  it('renders the title', () => {
    render(<LegalPageLayout {...defaultProps} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vilkår for brug')
  })

  it('renders the subtitle', () => {
    render(<LegalPageLayout {...defaultProps} />)
    expect(screen.getByText('Gælder for alle brugere')).toBeInTheDocument()
  })

  it('renders the lastUpdated date', () => {
    render(<LegalPageLayout {...defaultProps} />)
    expect(screen.getByText(/1. januar 2025/)).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(<LegalPageLayout {...defaultProps} />)
    expect(screen.getByText('Sektionsindhold')).toBeInTheDocument()
  })

  it('has a link back to login', () => {
    render(<LegalPageLayout {...defaultProps} />)
    const loginLinks = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href') === '/login')
    expect(loginLinks.length).toBeGreaterThan(0)
  })
})

describe('LegalListItem', () => {
  it('renders children', () => {
    render(
      <ul>
        <LegalListItem>Punkt A</LegalListItem>
      </ul>
    )
    expect(screen.getByText('Punkt A')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(
      <ul>
        <LegalListItem label="Ansvar:">Tekst her</LegalListItem>
      </ul>
    )
    expect(screen.getByText('Ansvar:')).toBeInTheDocument()
  })

  it('renders em-dash indicator', () => {
    render(
      <ul>
        <LegalListItem>X</LegalListItem>
      </ul>
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('LegalContactBox', () => {
  it('renders children', () => {
    render(<LegalContactBox>Kontaktoplysninger</LegalContactBox>)
    expect(screen.getByText('Kontaktoplysninger')).toBeInTheDocument()
  })
})

describe('LegalMailLink', () => {
  it('renders email as mailto link', () => {
    render(<LegalMailLink address="info@chainhub.dk" />)
    const link = screen.getByRole('link', { name: 'info@chainhub.dk' })
    expect(link).toHaveAttribute('href', 'mailto:info@chainhub.dk')
  })
})

describe('LegalExternalLink', () => {
  it('renders external link with correct href', () => {
    render(<LegalExternalLink href="https://example.com">Ekstern side</LegalExternalLink>)
    expect(screen.getByRole('link', { name: 'Ekstern side' })).toHaveAttribute(
      'href',
      'https://example.com'
    )
  })

  it('opens in new tab', () => {
    render(<LegalExternalLink href="https://example.com">Link</LegalExternalLink>)
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
  })
})
