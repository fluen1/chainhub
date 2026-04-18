import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskContext } from '@/components/task-detail/task-context'

describe('TaskContext', () => {
  it('viser links til alle fire relationer', () => {
    render(
      <TaskContext
        relatedCompany={{ id: 'c1', name: 'Tandlæge Østerbro ApS' }}
        relatedCase={{ id: 'ca1', title: 'Opkøb af Nordhavn' }}
        relatedContract={{ id: 'ct1', display_name: 'Direktørkontrakt' }}
        assignee={{ id: 'u1', name: 'Philip Larsen' }}
      />
    )
    const companyLink = screen.getByRole('link', { name: 'Tandlæge Østerbro ApS' })
    expect(companyLink).toHaveAttribute('href', '/companies/c1')
    expect(screen.getByRole('link', { name: 'Opkøb af Nordhavn' })).toHaveAttribute(
      'href',
      '/cases/ca1'
    )
    expect(screen.getByRole('link', { name: 'Direktørkontrakt' })).toHaveAttribute(
      'href',
      '/contracts/ct1'
    )
    expect(screen.getByText('Philip Larsen')).toBeInTheDocument()
  })

  it('viser em-dash for manglende relationer', () => {
    render(
      <TaskContext
        relatedCompany={null}
        relatedCase={null}
        relatedContract={null}
        assignee={null}
      />
    )
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBe(4)
  })
})
