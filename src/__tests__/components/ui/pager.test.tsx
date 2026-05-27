import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Pager } from '@/components/ui/b/Pager'

describe('Pager', () => {
  it('viser info-tekst', () => {
    render(<Pager info="1–10 af 184" />)
    expect(screen.getByText('1–10 af 184')).toBeInTheDocument()
  })

  it('viser side-navigation når page, maxPage og onPage er angivet', () => {
    render(<Pager info="" page={3} maxPage={10} onPage={vi.fn()} />)
    expect(screen.getByLabelText('Forrige side')).toBeInTheDocument()
    expect(screen.getByLabelText('Næste side')).toBeInTheDocument()
    expect(screen.getByText('3 / 10')).toBeInTheDocument()
  })

  it('kalder onPage med forrige side ved klik på ←', () => {
    const onPage = vi.fn()
    render(<Pager info="" page={5} maxPage={10} onPage={onPage} />)
    fireEvent.click(screen.getByLabelText('Forrige side'))
    expect(onPage).toHaveBeenCalledWith(4)
  })

  it('kalder onPage med næste side ved klik på →', () => {
    const onPage = vi.fn()
    render(<Pager info="" page={5} maxPage={10} onPage={onPage} />)
    fireEvent.click(screen.getByLabelText('Næste side'))
    expect(onPage).toHaveBeenCalledWith(6)
  })

  it('Forrige-knap er disabled på side 1', () => {
    render(<Pager info="" page={1} maxPage={10} onPage={vi.fn()} />)
    expect(screen.getByLabelText('Forrige side')).toBeDisabled()
  })

  it('Næste-knap er disabled på sidste side', () => {
    render(<Pager info="" page={10} maxPage={10} onPage={vi.fn()} />)
    expect(screen.getByLabelText('Næste side')).toBeDisabled()
  })

  it('begge knapper er aktive på en midterside', () => {
    render(<Pager info="" page={5} maxPage={10} onPage={vi.fn()} />)
    expect(screen.getByLabelText('Forrige side')).not.toBeDisabled()
    expect(screen.getByLabelText('Næste side')).not.toBeDisabled()
  })

  it('viser ikke side-navigation uden onPage', () => {
    render(<Pager info="1–10 af 10" page={1} maxPage={5} />)
    expect(screen.queryByLabelText('Forrige side')).toBeNull()
    expect(screen.queryByLabelText('Næste side')).toBeNull()
  })

  it('viser pageSize-knapper når pageSize og onPageSize er angivet', () => {
    render(<Pager info="" pageSize={10} onPageSize={vi.fn()} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('kalder onPageSize med valgt størrelse', () => {
    const onPageSize = vi.fn()
    render(<Pager info="" pageSize={10} onPageSize={onPageSize} />)
    fireEvent.click(screen.getByText('25'))
    expect(onPageSize).toHaveBeenCalledWith(25)
  })

  it('fremhæver aktiv pageSize', () => {
    render(<Pager info="" pageSize={25} onPageSize={vi.fn()} />)
    const btn25 = screen.getByText('25')
    // Aktiv knap har bg-[#e8eaee] klasse — tjek at den ikke har hover-bg-klasse fra inaktiv
    expect(btn25.className).toContain('bg-[#e8eaee]')
  })

  it('bruger custom sizes-array', () => {
    render(<Pager info="" pageSize={5} onPageSize={vi.fn()} sizes={[5, 20, 100]} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.queryByText('10')).toBeNull()
  })
})
