'use client'

import { ContractSystemType } from '@prisma/client'
import { cn } from '@/lib/utils'

interface ContractTypeBadgeProps {
  systemType: ContractSystemType
  className?: string
}

// Brugervenlige labels for alle 34 kontrakttyper
const TYPE_LABELS: Record<ContractSystemType, string> = {
  // Lag 1 — Universelle
  EJERAFTALE: 'Ejeraftale',
  DIREKTOERKONTRAKT: 'Direktørkontrakt',
  OVERDRAGELSESAFTALE: 'Overdragelsesaftale',
  AKTIONERLAN: 'Aktionærlån',
  PANTSAETNING: 'Pantsætning',
  VEDTAEGTER: 'Vedtægter',
  ANSAETTELSE_FUNKTIONAER: 'Ansættelse (funktionær)',
  ANSAETTELSE_IKKE_FUNKTIONAER: 'Ansættelse (ikke-funktionær)',
  VIKARAFTALE: 'Vikaraftale',
  UDDANNELSESAFTALE: 'Uddannelsesaftale',
  FRATRAEDELSESAFTALE: 'Fratrædelsesaftale',
  KONKURRENCEKLAUSUL: 'Konkurrenceklausul',
  PERSONALEHÅNDBOG: 'Personalehåndbog',
  LEJEKONTRAKT_ERHVERV: 'Lejekontrakt (erhverv)',
  LEASINGAFTALE: 'Leasingaftale',
  LEVERANDOERKONTRAKT: 'Leverandørkontrakt',
  SAMARBEJDSAFTALE: 'Samarbejdsaftale',
  NDA: 'Fortrolighedsaftale (NDA)',
  IT_SYSTEMAFTALE: 'IT-/Systemaftale',
  DBA: 'Databehandleraftale',
  FORSIKRING: 'Forsikring',
  GF_REFERAT: 'GF-referat',
  BESTYRELSESREFERAT: 'Bestyrelsesreferat',
  FORRETNINGSORDEN: 'Forretningsorden',
  DIREKTIONSINSTRUKS: 'Direktionsinstruks',
  VOA: 'Virksomhedsoverdragelse',
  // Lag 2 — Strukturtyper
  INTERN_SERVICEAFTALE: 'Intern serviceaftale',
  ROYALTY_LICENS: 'Royalty-/Licensaftale',
  OPTIONSAFTALE: 'Optionsaftale',
  TILTRAEDELSESDOKUMENT: 'Tiltrædelsesdokument',
  KASSEKREDIT: 'Kassekredit',
  CASH_POOL: 'Cash pool',
  INTERCOMPANY_LAN: 'Intercompany-lån',
  SELSKABSGARANTI: 'Selskabsgaranti',
}

// Kategorisering for gruppering
const TYPE_CATEGORIES: Record<ContractSystemType, string> = {
  EJERAFTALE: 'Ejerskab',
  DIREKTOERKONTRAKT: 'Ejerskab',
  OVERDRAGELSESAFTALE: 'Ejerskab',
  AKTIONERLAN: 'Ejerskab',
  PANTSAETNING: 'Ejerskab',
  VEDTAEGTER: 'Ejerskab',
  ANSAETTELSE_FUNKTIONAER: 'Ansættelse',
  ANSAETTELSE_IKKE_FUNKTIONAER: 'Ansættelse',
  VIKARAFTALE: 'Ansættelse',
  UDDANNELSESAFTALE: 'Ansættelse',
  FRATRAEDELSESAFTALE: 'Ansættelse',
  KONKURRENCEKLAUSUL: 'Ansættelse',
  PERSONALEHÅNDBOG: 'Ansættelse',
  LEJEKONTRAKT_ERHVERV: 'Lokaler',
  LEASINGAFTALE: 'Lokaler',
  LEVERANDOERKONTRAKT: 'Kommerciel',
  SAMARBEJDSAFTALE: 'Kommerciel',
  NDA: 'Kommerciel',
  IT_SYSTEMAFTALE: 'Kommerciel',
  DBA: 'Kommerciel',
  FORSIKRING: 'Governance',
  GF_REFERAT: 'Governance',
  BESTYRELSESREFERAT: 'Governance',
  FORRETNINGSORDEN: 'Governance',
  DIREKTIONSINSTRUKS: 'Governance',
  VOA: 'Kommerciel',
  INTERN_SERVICEAFTALE: 'Koncern',
  ROYALTY_LICENS: 'Koncern',
  OPTIONSAFTALE: 'Koncern',
  TILTRAEDELSESDOKUMENT: 'Koncern',
  KASSEKREDIT: 'Koncern',
  CASH_POOL: 'Koncern',
  INTERCOMPANY_LAN: 'Koncern',
  SELSKABSGARANTI: 'Koncern',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Ejerskab': 'bg-purple-100 text-purple-800 border-purple-200',
  'Ansættelse': 'bg-blue-100 text-blue-800 border-blue-200',
  'Lokaler': 'bg-green-100 text-green-800 border-green-200',
  'Kommerciel': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Governance': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Koncern': 'bg-red-100 text-red-800 border-red-200',
}

export function ContractTypeBadge({ systemType, className }: ContractTypeBadgeProps) {
  const label = TYPE_LABELS[systemType]
  const category = TYPE_CATEGORIES[systemType]
  const colorClass = CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        colorClass,
        className
      )}
      title={category}
    >
      {label}
    </span>
  )
}

export function getContractTypeLabel(systemType: ContractSystemType): string {
  return TYPE_LABELS[systemType]
}

export function getContractTypeCategory(systemType: ContractSystemType): string {
  return TYPE_CATEGORIES[systemType]
}