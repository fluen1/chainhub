import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TableWrap, Th, Tr, Td, TableInner, TableEmpty, AIBadge } from '@/components/ui/b/DataTable'

describe('TableWrap', () => {
  it('renders children', () => {
    render(
      <TableWrap>
        <div>indhold</div>
      </TableWrap>
    )
    expect(screen.getByText('indhold')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <TableWrap className="extra-cls">
        <div />
      </TableWrap>
    )
    expect(container.firstChild).toHaveClass('extra-cls')
  })

  it('has overflow-x-auto for horizontal scroll', () => {
    const { container } = render(
      <TableWrap>
        <div />
      </TableWrap>
    )
    expect(container.firstChild).toHaveClass('overflow-x-auto')
  })
})

describe('Th', () => {
  it('renders children text', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th>Titel</Th>
          </tr>
        </thead>
      </table>
    )
    expect(screen.getByText('Titel')).toBeInTheDocument()
  })

  it('shows sort ascending indicator when active col and asc', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th col="name" sortCol="name" sortDir="asc">
              Navn
            </Th>
          </tr>
        </thead>
      </table>
    )
    expect(screen.getByText('↑')).toBeInTheDocument()
  })

  it('shows sort descending indicator when active col and desc', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th col="name" sortCol="name" sortDir="desc">
              Navn
            </Th>
          </tr>
        </thead>
      </table>
    )
    expect(screen.getByText('↓')).toBeInTheDocument()
  })

  it('calls onSort when clicked', () => {
    const onSort = vi.fn()
    render(
      <table>
        <thead>
          <tr>
            <Th col="name" onSort={onSort}>
              Navn
            </Th>
          </tr>
        </thead>
      </table>
    )
    fireEvent.click(screen.getByText('Navn'))
    expect(onSort).toHaveBeenCalledWith('name')
  })

  it('does not show sort indicator for inactive col', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th col="name" sortCol="other" sortDir="asc">
              Navn
            </Th>
          </tr>
        </thead>
      </table>
    )
    expect(screen.queryByText('↑')).not.toBeInTheDocument()
    expect(screen.queryByText('↓')).not.toBeInTheDocument()
  })
})

describe('Tr', () => {
  it('renders children', () => {
    render(
      <table>
        <tbody>
          <Tr>
            <td>Celle</td>
          </Tr>
        </tbody>
      </table>
    )
    expect(screen.getByText('Celle')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(
      <table>
        <tbody>
          <Tr onClick={onClick}>
            <td>Klik</td>
          </Tr>
        </tbody>
      </table>
    )
    fireEvent.click(screen.getByText('Klik'))
    expect(onClick).toHaveBeenCalled()
  })

  it('has cursor-pointer when onClick is set', () => {
    const { container } = render(
      <table>
        <tbody>
          <Tr onClick={vi.fn()}>
            <td>X</td>
          </Tr>
        </tbody>
      </table>
    )
    expect(container.querySelector('tr')).toHaveClass('cursor-pointer')
  })
})

describe('Td', () => {
  it('renders children', () => {
    render(
      <table>
        <tbody>
          <tr>
            <Td>Celleindhold</Td>
          </tr>
        </tbody>
      </table>
    )
    expect(screen.getByText('Celleindhold')).toBeInTheDocument()
  })

  it('applies text-right when alignRight', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <Td alignRight>123</Td>
          </tr>
        </tbody>
      </table>
    )
    expect(container.querySelector('td')).toHaveClass('text-right')
  })

  it('applies secondary text color when secondary prop', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <Td secondary>Sekundær</Td>
          </tr>
        </tbody>
      </table>
    )
    expect(container.querySelector('td')).toHaveClass('text-b-2')
  })
})

describe('TableInner', () => {
  it('renders as table element', () => {
    const { container } = render(
      <TableInner>
        <thead>
          <tr>
            <th>H</th>
          </tr>
        </thead>
      </TableInner>
    )
    expect(container.querySelector('table')).toBeInTheDocument()
  })

  it('has min-width class', () => {
    const { container } = render(
      <TableInner>
        <tbody />
      </TableInner>
    )
    expect(container.querySelector('table')).toHaveClass('min-w-[600px]')
  })
})

describe('TableEmpty', () => {
  it('renders children text', () => {
    render(<TableEmpty>Ingen resultater fundet</TableEmpty>)
    expect(screen.getByText('Ingen resultater fundet')).toBeInTheDocument()
  })
})

describe('AIBadge', () => {
  it('renders the lightning bolt symbol', () => {
    render(<AIBadge />)
    expect(screen.getByText('⚡')).toBeInTheDocument()
  })

  it('har dansk "AI-udlæst" title-attribut', () => {
    render(<AIBadge />)
    expect(screen.getByTitle('AI-udlæst')).toBeInTheDocument()
  })
})
