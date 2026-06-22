import * as fs from 'fs'
import { describe, it, expect } from 'vitest'

function read(path: string): string {
  return fs.readFileSync(`${process.cwd()}/${path}`, 'utf-8')
}

describe('Mobil kortvisning — ContractsCardView', () => {
  const src = read('src/components/contracts/ContractsCardView.tsx')
  it('eksporterer ContractsCardView', () => {
    expect(src).toContain('export function ContractsCardView')
  })
  it('bruger memo', () => {
    expect(src).toContain('memo')
  })
  it('har kortknap med korrekt styling', () => {
    expect(src).toContain('rounded-[4px] border border-b-border')
  })
  it('har tom-tilstand', () => {
    expect(src).toContain('Ingen kontrakter')
  })
})

describe('Mobil kortvisning — CasesCardView', () => {
  const src = read('src/components/cases/CasesCardView.tsx')
  it('eksporterer CasesCardView', () => {
    expect(src).toContain('export function CasesCardView')
  })
  it('har kortknap med korrekt styling', () => {
    expect(src).toContain('rounded-[4px] border border-b-border')
  })
  it('har tom-tilstand', () => {
    expect(src).toContain('Ingen sager')
  })
})

describe('Mobil kortvisning — TasksCardView', () => {
  const src = read('src/components/tasks/TasksCardView.tsx')
  it('eksporterer TasksCardView', () => {
    expect(src).toContain('export function TasksCardView')
  })
  it('har kortknap med korrekt styling', () => {
    expect(src).toContain('rounded-[4px] border border-b-border')
  })
  it('har tom-tilstand', () => {
    expect(src).toContain('Ingen opgaver')
  })
})

describe('Mobil kortvisning — PersonsCardView', () => {
  const src = read('src/components/persons/PersonsCardView.tsx')
  it('eksporterer PersonsCardView', () => {
    expect(src).toContain('export function PersonsCardView')
  })
  it('har kortknap med korrekt styling', () => {
    expect(src).toContain('rounded-[4px] border border-b-border')
  })
  it('har tom-tilstand', () => {
    expect(src).toContain('Ingen personer')
  })
})

describe('Mobil kortvisning — DocumentsCardView', () => {
  const src = read('src/components/documents/DocumentsCardView.tsx')
  it('eksporterer DocumentsCardView', () => {
    expect(src).toContain('export function DocumentsCardView')
  })
  it('har kortknap med korrekt styling', () => {
    expect(src).toContain('rounded-[4px] border border-b-border')
  })
  it('har tom-tilstand', () => {
    expect(src).toContain('Ingen dokumenter')
  })
})

describe('Responsive toggle — list-b filer', () => {
  it('contracts-list-b har sm:hidden kortvisning', () => {
    const src = read('src/app/(dashboard)/contracts/contracts-list-b.tsx')
    expect(src).toContain('sm:hidden')
    expect(src).toContain('hidden sm:block')
    expect(src).toContain('ContractsCardView')
  })
  it('cases-list-b har sm:hidden kortvisning', () => {
    const src = read('src/app/(dashboard)/cases/cases-list-b.tsx')
    expect(src).toContain('sm:hidden')
    expect(src).toContain('hidden sm:block')
    expect(src).toContain('CasesCardView')
  })
  it('tasks-list-b har sm:hidden kortvisning', () => {
    const src = read('src/app/(dashboard)/tasks/tasks-list-b.tsx')
    expect(src).toContain('sm:hidden')
    expect(src).toContain('hidden sm:block')
    expect(src).toContain('TasksCardView')
  })
  it('persons-list-b har sm:hidden kortvisning', () => {
    const src = read('src/app/(dashboard)/persons/persons-list-b.tsx')
    expect(src).toContain('sm:hidden')
    expect(src).toContain('hidden sm:block')
    expect(src).toContain('PersonsCardView')
  })
  it('documents-list-b har sm:hidden kortvisning', () => {
    const src = read('src/app/(dashboard)/documents/documents-list-b.tsx')
    expect(src).toContain('sm:hidden')
    expect(src).toContain('hidden sm:block')
    expect(src).toContain('DocumentsCardView')
  })
})
