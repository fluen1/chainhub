'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { MockUser, DataScenario, PrototypeState } from '@/mock/types'
import { mockUsers, getDefaultUser } from '@/mock/users'

interface PrototypeContextType extends PrototypeState {
  setActiveUser: (user: MockUser) => void
  setCompanyCount: (count: number) => void
  setDataScenario: (scenario: DataScenario) => void
  allUsers: MockUser[]
}

const PrototypeContext = createContext<PrototypeContextType | null>(null)

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [activeUser, setActiveUser] = useState<MockUser>(getDefaultUser())
  const [companyCount, setCompanyCount] = useState(22)
  const [dataScenario, setDataScenario] = useState<DataScenario>('normal')

  return (
    <PrototypeContext.Provider value={{
      activeUser, companyCount, dataScenario,
      setActiveUser, setCompanyCount, setDataScenario,
      allUsers: mockUsers,
    }}>
      {children}
    </PrototypeContext.Provider>
  )
}

export function usePrototype(): PrototypeContextType {
  const context = useContext(PrototypeContext)
  if (!context) throw new Error('usePrototype must be used within a PrototypeProvider')
  return context
}
