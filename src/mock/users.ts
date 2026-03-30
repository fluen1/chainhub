import type { MockUser } from './types'

export const mockUsers: MockUser[] = [
  {
    id: 'user-philip',
    name: 'Philip Andersen',
    email: 'philip@chainhub.dk',
    role: 'GROUP_OWNER',
    roleLabel: 'Kædegruppe-ejer',
    companyIds: [],
  },
  {
    id: 'user-maria',
    name: 'Maria Christensen',
    email: 'maria@tandlaegegruppen.dk',
    role: 'GROUP_LEGAL',
    roleLabel: 'Juridisk chef',
    companyIds: [],
  },
  {
    id: 'user-thomas',
    name: 'Thomas Nielsen',
    email: 'thomas@tandlaegegruppen.dk',
    role: 'GROUP_FINANCE',
    roleLabel: 'Finansdirektør',
    companyIds: [],
  },
  {
    id: 'user-sara',
    name: 'Sara Larsen',
    email: 'sara@tandlaegegruppen.dk',
    role: 'GROUP_ADMIN',
    roleLabel: 'Administrator',
    companyIds: [],
  },
  {
    id: 'user-lars',
    name: 'Lars Pedersen',
    email: 'lars@odense-tandlaege.dk',
    role: 'COMPANY_MANAGER',
    roleLabel: 'Klinikmanager',
    companyIds: ['company-odense', 'company-svendborg', 'company-nyborg'],
  },
]

export function getUserById(id: string): MockUser | undefined {
  return mockUsers.find((u) => u.id === id)
}

export function getDefaultUser(): MockUser {
  return mockUsers[0]
}
