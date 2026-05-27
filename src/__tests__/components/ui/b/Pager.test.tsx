import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Pager } from '@/components/ui/b/Pager'

describe('Pager — info text', () => {
  it('renders the info string', () => {
    render(<Pager info="1–10 af 184" />)
    expect(screen.getByText('1–10 af 184')).toBeInTheDocument()
  })
})

describe('Pager — pagination controls', () => {
  it('renders previous and next buttons when page props are supplied', () => {
    render(<Pager info="" page={2} maxPage={5} onPage={vi.fn()} />)
    expect(screen.getByLabelText('Forrige side')).toBeInTheDocument()
    expect(screen.getByLabelText('Næste side')).toBeInTheDocument()
  })

  it('shows current page / maxPage', () => {
    render(<Pager info="" page={3} maxPage={10} onPage={vi.fn()} />)
    expect(screen.getByText('3 / 10')).toBeInTheDocument()
  })

  it('disables previous button on first page', () => {
    render(<Pager info="" page={1} maxPage={5} onPage={vi.fn()} />)
    expect(screen.getByLabelText('Forrige side')).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(<Pager info="" page={5} maxPage={5} onPage={vi.fn()} />)
    expect(screen.getByLabelText('Næste side')).toBeDisabled()
  })

  it('calls onPage with page-1 when previous is clicked', () => {
    const onPage = vi.fn()
    render(<Pager info="" page={3} maxPage={5} onPage={onPage} />)
    fireEvent.click(screen.getByLabelText('Forrige side'))
    expect(onPage).toHaveBeenCalledWith(2)
  })

  it('calls onPage with page+1 when next is clicked', () => {
    const onPage = vi.fn()
    render(<Pager info="" page={3} maxPage={5} onPage={onPage} />)
    fireEvent.click(screen.getByLabelText('Næste side'))
    expect(onPage).toHaveBeenCalledWith(4)
  })

  it('does not render pagination controls when page props are absent', () => {
    render(<Pager info="10 resultater" />)
    expect(screen.queryByLabelText('Forrige side')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Næste side')).not.toBeInTheDocument()
  })
})

describe('Pager — page size selector', () => {
  it('renders page size buttons when pageSize + onPageSize are supplied', () => {
    render(<Pager info="" pageSize={10} onPageSize={vi.fn()} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('calls onPageSize with selected value', () => {
    const onPageSize = vi.fn()
    render(<Pager info="" pageSize={10} onPageSize={onPageSize} />)
    fireEvent.click(screen.getByText('25'))
    expect(onPageSize).toHaveBeenCalledWith(25)
  })

  it('supports custom sizes array', () => {
    render(<Pager info="" pageSize={5} onPageSize={vi.fn()} sizes={[5, 20, 100]} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('does not render page size controls when props are absent', () => {
    render(<Pager info="results" />)
    expect(screen.queryByText('Vis:')).not.toBeInTheDocument()
  })
})
