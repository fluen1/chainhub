'use client'
import { Wrench } from 'lucide-react'
import { usePrototype } from './PrototypeProvider'
import type { DataScenario } from '@/mock/types'

const companyCounts = [5, 22, 56] as const

const dataScenarioOptions: { value: DataScenario; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'many_warnings', label: 'Mange advarsler' },
  { value: 'empty', label: 'Tomt' },
]

export function RoleSwitcher() {
  const { activeUser, companyCount, dataScenario, setActiveUser, setCompanyCount, setDataScenario, allUsers } = usePrototype()

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 flex items-center gap-4 flex-wrap">
      {/* Label */}
      <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs shrink-0">
        <Wrench className="h-3.5 w-3.5" />
        <span>PROTOTYPE</span>
      </div>

      <div className="w-px h-4 bg-amber-200 shrink-0" />

      {/* Rolle */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-amber-600 shrink-0">Rolle:</span>
        <select
          className="text-xs bg-white border border-amber-300 rounded px-2 py-1 text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
          value={activeUser.id}
          onChange={(e) => {
            const user = allUsers.find((u) => u.id === e.target.value)
            if (user) setActiveUser(user)
          }}
        >
          {allUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} — {user.roleLabel}
              {user.companyIds.length > 0 ? ` (${user.companyIds.length} selskaber)` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Antal selskaber */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-amber-600 shrink-0">Selskaber:</span>
        <select
          className="text-xs bg-white border border-amber-300 rounded px-2 py-1 text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
          value={companyCount}
          onChange={(e) => setCompanyCount(Number(e.target.value))}
        >
          {companyCounts.map((count) => (
            <option key={count} value={count}>
              {count} selskaber
            </option>
          ))}
        </select>
      </div>

      {/* Datascenarie */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-amber-600 shrink-0">Scenarie:</span>
        <select
          className="text-xs bg-white border border-amber-300 rounded px-2 py-1 text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
          value={dataScenario}
          onChange={(e) => setDataScenario(e.target.value as DataScenario)}
        >
          {dataScenarioOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
