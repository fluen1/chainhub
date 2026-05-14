import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import {
  getCompanyPersonRoleLabel,
  getContractStatusLabel,
  getContractTypeLabel,
  formatDate,
} from '@/lib/labels'
import { getPersonAIExtractions } from '@/actions/person-ai'
import {
  PersonDetailB,
  type PersonView,
  type PersonRoleData,
  type PersonOwnershipData,
  type PersonContractData,
  type PersonCaseData,
  type PersonAIFieldData,
} from './person-detail-b'

export const metadata: Metadata = { title: 'Person' }

// Map fra extracted_fields-nøgle → dansk vilkår-label.
// Vi viser kun ansættelses-relevante felter; ejeraftale-extractions ignoreres.
const FIELD_TO_LABEL: Record<string, string> = {
  salary: 'Løn',
  monthly_salary: 'Løn',
  notice_period: 'Opsigelsesvarsel',
  notice_period_months: 'Opsigelsesvarsel',
  vacation_days: 'Ferie',
  start_date: 'Start-dato',
  bonus: 'Bonus',
  pension: 'Pensionsbidrag',
  non_compete: 'Konkurrenceklausul',
  confidentiality: 'Tavshedspligt',
}

function formatValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nej'
  if (typeof v === 'number') return v.toLocaleString('da-DK')
  return String(v)
}

function yearsSince(d: Date | null): string {
  if (!d) return '—'
  const ms = Date.now() - d.getTime()
  const years = ms / (1000 * 60 * 60 * 24 * 365.25)
  if (years >= 1) return `${Math.floor(years)} år`
  const months = Math.floor(years * 12)
  return `${months} md`
}

export default async function PersonDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const person = await prisma.person.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      company_persons: {
        include: {
          company: { select: { id: true, name: true } },
          contract: {
            select: {
              id: true,
              display_name: true,
              system_type: true,
              status: true,
              expiry_date: true,
            },
          },
        },
        orderBy: { start_date: 'desc' },
      },
      contract_parties: {
        include: {
          contract: {
            select: {
              id: true,
              display_name: true,
              system_type: true,
              status: true,
              expiry_date: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
      },
      ownerships: {
        include: {
          company: { select: { id: true, name: true } },
          contract: { select: { id: true, status: true } },
        },
        orderBy: { effective_date: 'desc' },
      },
      case_persons: {
        include: {
          case: { select: { id: true, title: true, case_number: true, status: true } },
        },
      },
    },
  })

  if (!person) notFound()

  // Hent AI-extractions (handles permission internally)
  const aiResult = await getPersonAIExtractions(params.id)
  const aiData = 'data' in aiResult && aiResult.data ? aiResult.data : []

  const activeRoles = person.company_persons.filter((cp) => !cp.end_date)
  const historicRoles = person.company_persons.filter((cp) => cp.end_date)

  // Status afledt af aktive roller
  const status =
    activeRoles.length > 0 ? 'Aktiv' : person.company_persons.length > 0 ? 'Opsagt' : 'Inaktiv'

  // Anciennitet = ældste anciennity_start på aktiv role, ellers første start_date
  const oldestActive = activeRoles
    .map((cp) => cp.anciennity_start ?? cp.start_date)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime())[0]
  const anciennitet = yearsSince(oldestActive ?? null)

  // Kontrakter via company_persons.contract + contract_parties.contract
  const contractMap = new Map<
    string,
    {
      id: string
      display_name: string
      system_type: string
      status: string
      expiry_date: Date | null
      companyName: string
    }
  >()
  for (const cp of person.company_persons) {
    if (cp.contract) {
      contractMap.set(cp.contract.id, {
        ...cp.contract,
        companyName: cp.company.name,
      })
    }
  }
  for (const cpty of person.contract_parties) {
    if (cpty.contract) {
      contractMap.set(cpty.contract.id, {
        id: cpty.contract.id,
        display_name: cpty.contract.display_name,
        system_type: cpty.contract.system_type,
        status: cpty.contract.status,
        expiry_date: cpty.contract.expiry_date,
        companyName: cpty.contract.company.name,
      })
    }
  }

  const aiContractIds = new Set(aiData.map((a) => a.contractId))

  const contracts: PersonContractData[] = Array.from(contractMap.values()).map((c) => ({
    id: c.id,
    ver: 'v1', // Vi har ikke version-info pr. kontrakt her; default v1
    type: getContractTypeLabel(c.system_type),
    selskab: c.companyName,
    ai: aiContractIds.has(c.id),
    status: getContractStatusLabel(c.status),
    rawStatus: c.status,
    udlob: c.expiry_date ? formatDate(c.expiry_date) : '—',
  }))

  const roller: PersonRoleData[] = activeRoles.map((cp) => ({
    id: cp.id,
    rolle: getCompanyPersonRoleLabel(cp.role),
    rawRole: cp.role,
    selskab: cp.company.name,
    selskabId: cp.company.id,
    type: cp.employment_type ?? 'Funktionær',
    aktivSiden: cp.start_date ? formatDate(cp.start_date) : '—',
  }))

  const ejerskab: PersonOwnershipData[] = person.ownerships.map((o) => ({
    id: o.id,
    selskab: o.company.name,
    selskabId: o.company.id,
    pct: Number(o.ownership_pct),
    type: o.share_class ?? 'Direkte',
    siden: o.effective_date ? formatDate(o.effective_date) : '—',
    isEnded: !!o.end_date,
    contractStatus: o.contract?.status ?? null,
  }))

  const sager: PersonCaseData[] = person.case_persons.map((cp) => ({
    id: cp.case.id,
    nr: cp.case.case_number ?? cp.case.id.slice(0, 6),
    title: cp.case.title,
    status: cp.case.status,
  }))

  // Vælg første AI-extraction til vilkår-panel + flat vilkår-liste
  const firstExtraction = aiData[0] ?? null
  const aiVilkaar: PersonAIFieldData[] = firstExtraction
    ? Object.entries(firstExtraction.fields)
        .filter(([key]) => FIELD_TO_LABEL[key])
        .slice(0, 6)
        .map(([key, field]) => ({
          label: FIELD_TO_LABEL[key]!,
          value: formatValue(field.value),
          confidence: field.confidence,
        }))
    : []

  // Find evt. løn fra AI til strip-cellen
  const lonField =
    firstExtraction &&
    (firstExtraction.fields.salary ?? firstExtraction.fields.monthly_salary ?? null)
  const lonStr =
    lonField && typeof lonField.value === 'number'
      ? `${Math.round(lonField.value / 1000)}k`
      : lonField && typeof lonField.value === 'string'
        ? lonField.value
        : '—'

  const view: PersonView = {
    id: person.id,
    firstName: person.first_name,
    lastName: person.last_name,
    fullName: `${person.first_name} ${person.last_name}`,
    initials: `${person.first_name[0] ?? ''}${person.last_name[0] ?? ''}`.toUpperCase(),
    email: person.email ?? null,
    phone: person.phone ?? null,
    notes: person.notes ?? null,
    activeRolesCount: activeRoles.length,
    historicRolesCount: historicRoles.length,
    companiesCount: new Set(person.company_persons.map((cp) => cp.company.id)).size,
    contractsCount: contractMap.size,
    casesCount: person.case_persons.length,
    status,
    activeSince: oldestActive ? formatDate(oldestActive) : null,
    anciennitet,
    lonStr,
    primaryRoles: activeRoles.slice(0, 2).map((r) => ({
      label: getCompanyPersonRoleLabel(r.role),
      rawRole: r.role,
    })),
  }

  return (
    <PersonDetailB
      person={view}
      roller={roller}
      ejerskab={ejerskab}
      contracts={contracts}
      sager={sager}
      aiVilkaar={aiVilkaar}
      aiSourceDoc={firstExtraction ? firstExtraction.documentId : null}
    />
  )
}
