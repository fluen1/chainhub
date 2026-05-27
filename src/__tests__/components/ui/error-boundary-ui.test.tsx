import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

describe('ErrorBoundaryUI', () => {
  it('renderer default title "Noget gik galt"', () => {
    render(<ErrorBoundaryUI reset={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Noget gik galt' })).toBeInTheDocument()
  })

  it('renderer custom title', () => {
    render(<ErrorBoundaryUI title="Siden findes ikke" reset={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Siden findes ikke' })).toBeInTheDocument()
  })

  it('renderer default fejlbesked', () => {
    render(<ErrorBoundaryUI reset={vi.fn()} />)
    expect(screen.getByText(/Vi kunne ikke indlæse denne side/)).toBeInTheDocument()
  })

  it('renderer custom besked', () => {
    render(<ErrorBoundaryUI message="Noget gik galt med kalendermodulet." reset={vi.fn()} />)
    expect(screen.getByText('Noget gik galt med kalendermodulet.')).toBeInTheDocument()
  })

  it('renderer "Prøv igen"-knap', () => {
    render(<ErrorBoundaryUI reset={vi.fn()} />)
    expect(screen.getByRole('button', { name: /prøv igen/i })).toBeInTheDocument()
  })

  it('kalder reset ved klik på "Prøv igen"', () => {
    const reset = vi.fn()
    render(<ErrorBoundaryUI reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: /prøv igen/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('viser dashboard-link som standard', () => {
    render(<ErrorBoundaryUI reset={vi.fn()} />)
    expect(screen.getByRole('link', { name: /gå til dashboard/i })).toBeInTheDocument()
  })

  it('skjuler dashboard-link når showDashboardLink=false', () => {
    render(<ErrorBoundaryUI reset={vi.fn()} showDashboardLink={false} />)
    expect(screen.queryByRole('link', { name: /gå til dashboard/i })).toBeNull()
  })

  it('renderer digest/reference-kode når angivet', () => {
    render(<ErrorBoundaryUI reset={vi.fn()} digest="abc-123-xyz" />)
    expect(screen.getByText('abc-123-xyz')).toBeInTheDocument()
    expect(screen.getByText('Reference')).toBeInTheDocument()
  })

  it('viser ikke reference-blok når digest ikke er angivet', () => {
    render(<ErrorBoundaryUI reset={vi.fn()} />)
    expect(screen.queryByText('Reference')).toBeNull()
  })

  it('dashboard-link peger på /dashboard', () => {
    render(<ErrorBoundaryUI reset={vi.fn()} />)
    expect(screen.getByRole('link', { name: /gå til dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard'
    )
  })
})
