'use server'

import { prisma } from '@/lib/db'
import { getAccessibleCompanies, canAccessSensitivity } from '@/lib/permissions'
import { MIN_SEARCH_LENGTH, RESULTS_PER_TYPE } from '@/lib/search/constants'
import type { SensitivityLevel } from '@prisma/client'

// -----------------------------------------------------------------
// Output-typer
// -----------------------------------------------------------------

export interface SearchCompanyRow {
  id: string
  name: string
  cvr: string | null
  city: string | null
  status: string
}

export interface SearchContractRow {
  id: string
  display_name: string
  system_type: string
  status: string
  companyId: string
  companyName: string
}

export interface SearchCaseRow {
  id: string
  title: string
  case_type: string
  status: string
}

export interface SearchPersonRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
}

export interface SearchTaskRow {
  id: string
  title: string
  status: string
  priority: string
  due_date: Date | null
}

export interface SearchDocumentRow {
  id: string
  title: string
  file_name: string
  companyId: string | null
  companyName: string | null
}

export interface SearchResults {
  query: string
  companies: SearchCompanyRow[]
  contracts: SearchContractRow[]
  cases: SearchCaseRow[]
  persons: SearchPersonRow[]
  tasks: SearchTaskRow[]
  documents: SearchDocumentRow[]
  totalCount: number
}

// -----------------------------------------------------------------
// Server action
// -----------------------------------------------------------------

export async function runSearch(
  query: string,
  userId: string,
  orgId: string
): Promise<SearchResults | null> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_SEARCH_LENGTH) return null

  const companyIds = await getAccessibleCompanies(userId, orgId)
  const canSeeSensitive = await canAccessSensitivity(userId, 'FORTROLIG' as SensitivityLevel)

  // Hvis brugeren ikke har adgang til nogen selskaber, returner tomt resultat
  if (companyIds.length === 0) {
    return {
      query: trimmed,
      companies: [],
      contracts: [],
      cases: [],
      persons: [],
      tasks: [],
      documents: [],
      totalCount: 0,
    }
  }

  const insensitive = { contains: trimmed, mode: 'insensitive' as const }

  // Sensitivity-filter — kun FORTROLIG/STRENGT_FORTROLIG gemmes væk hvis bruger ikke har adgang
  const sensitivityFilter = canSeeSensitive
    ? undefined
    : { notIn: ['FORTROLIG', 'STRENGT_FORTROLIG'] as SensitivityLevel[] }

  const [companies, contracts, cases, persons, tasks, documents] = await Promise.all([
    // Selskaber — scope: accessible
    prisma.company.findMany({
      where: {
        organization_id: orgId,
        id: { in: companyIds },
        deleted_at: null,
        OR: [
          { name: insensitive },
          { cvr: insensitive },
          { city: insensitive },
        ],
      },
      select: { id: true, name: true, cvr: true, city: true, status: true },
      take: RESULTS_PER_TYPE,
      orderBy: { name: 'asc' },
    }),

    // Kontrakter — scope: accessible companies + sensitivity
    prisma.contract.findMany({
      where: {
        organization_id: orgId,
        company_id: { in: companyIds },
        deleted_at: null,
        ...(sensitivityFilter ? { sensitivity: sensitivityFilter } : {}),
        OR: [
          { display_name: insensitive },
          { notes: insensitive },
        ],
      },
      include: { company: { select: { id: true, name: true } } },
      take: RESULTS_PER_TYPE,
      orderBy: { display_name: 'asc' },
    }),

    // Sager — scope: kun sager tilknyttet accessible selskaber + sensitivity
    prisma.case.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        ...(sensitivityFilter ? { sensitivity: sensitivityFilter } : {}),
        OR: [
          { title: insensitive },
          { description: insensitive },
          { case_number: insensitive },
        ],
        case_companies: { some: { company_id: { in: companyIds } } },
      },
      select: { id: true, title: true, case_type: true, status: true },
      take: RESULTS_PER_TYPE,
      orderBy: { title: 'asc' },
    }),

    // Personer — scope: personer tilknyttet mindst ét accessible selskab ELLER uden selskabs-tilknytning
    prisma.person.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        OR: [
          { first_name: insensitive },
          { last_name: insensitive },
          { email: insensitive },
          { notes: insensitive },
        ],
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
      },
      take: RESULTS_PER_TYPE,
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    }),

    // Opgaver — scope: (ingen company_id) ELLER (company_id in accessible)
    prisma.task.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        OR: [
          { title: insensitive },
          { description: insensitive },
        ],
        AND: [
          {
            OR: [
              { company_id: null },
              { company_id: { in: companyIds } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        due_date: true,
      },
      take: RESULTS_PER_TYPE,
      orderBy: [{ due_date: 'asc' }, { priority: 'desc' }],
    }),

    // Dokumenter — scope: (ingen company_id) ELLER (company_id in accessible) + sensitivity
    prisma.document.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        ...(sensitivityFilter ? { sensitivity: sensitivityFilter } : {}),
        OR: [
          { title: insensitive },
          { file_name: insensitive },
          { description: insensitive },
        ],
        AND: [
          {
            OR: [
              { company_id: null },
              { company_id: { in: companyIds } },
            ],
          },
        ],
      },
      include: { company: { select: { id: true, name: true } } },
      take: RESULTS_PER_TYPE,
      orderBy: { uploaded_at: 'desc' },
    }),
  ])

  return {
    query: trimmed,
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      cvr: c.cvr,
      city: c.city,
      status: c.status ?? 'aktiv',
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      display_name: c.display_name,
      system_type: c.system_type,
      status: c.status,
      companyId: c.company.id,
      companyName: c.company.name,
    })),
    cases: cases.map((c) => ({
      id: c.id,
      title: c.title,
      case_type: c.case_type,
      status: c.status,
    })),
    persons: persons.map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      file_name: d.file_name,
      companyId: d.company?.id ?? null,
      companyName: d.company?.name ?? null,
    })),
    totalCount:
      companies.length +
      contracts.length +
      cases.length +
      persons.length +
      tasks.length +
      documents.length,
  }
}
